import fs from "node:fs";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { spawnSync } from "node:child_process";
import { decryptSecret } from "../../../../oauth/helpers.ts";
import { resolvePromptAttachments, type ResolvedFileAttachment } from "../../core/file-attachments.ts";
import type { ApiProviderRow } from "./types.ts";

type DbLike = {
  prepare: (sql: string) => {
    get: (...args: any[]) => unknown;
  };
};

type CreateApiProviderToolsDeps = {
  db: DbLike;
  logsDir: string;
  activeProcesses: Map<string, ChildProcess>;
  broadcast: (event: string, payload: unknown) => void;
  normalizeStreamChunk: (raw: Buffer | string, opts?: { dropCliNoise?: boolean }) => string;
  handleTaskRunComplete: (taskId: string, exitCode: number) => void;
  createSafeLogStreamOps: (logStream: any) => {
    safeWrite: (text: string) => boolean;
    safeEnd: (onDone?: () => void) => void;
    isClosed: () => boolean;
  };
  parseSSEStream: (
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    safeWrite: (text: string) => boolean,
    taskId?: string,
  ) => Promise<void>;
  parseGeminiSSEStream: (
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    safeWrite: (text: string) => boolean,
    taskId?: string,
  ) => Promise<void>;
};

interface ProviderImage {
  name: string;
  mimeType: string;
  data: string;
}

const MAX_PROVIDER_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PROVIDER_IMAGE_TOTAL_BYTES = 18 * 1024 * 1024;

function splitJpegFrames(buffer: Buffer): Buffer[] {
  const frames: Buffer[] = [];
  let cursor = 0;
  while (cursor < buffer.length && frames.length < 8) {
    const start = buffer.indexOf(Buffer.from([0xff, 0xd8]), cursor);
    if (start < 0) break;
    const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
    if (end < 0) break;
    frames.push(buffer.subarray(start, end + 2));
    cursor = end + 2;
  }
  return frames;
}

function prepareApiAttachmentInputs(attachments: ResolvedFileAttachment[]): {
  extractedText: string;
  images: ProviderImage[];
} {
  const extractedText: string[] = [];
  const images: ProviderImage[] = [];
  let imageBytes = 0;

  for (const attachment of attachments) {
    const ext = path.extname(attachment.storage_name).toLowerCase();
    if (attachment.mime_type.startsWith("image/")) {
      if (
        attachment.byte_size > MAX_PROVIDER_IMAGE_BYTES ||
        imageBytes + attachment.byte_size > MAX_PROVIDER_IMAGE_TOTAL_BYTES
      ) {
        extractedText.push(
          `[${attachment.original_name}: image exceeds the API-provider inline transfer limit; it was not sent.]`,
        );
        continue;
      }
      const bytes = fs.readFileSync(attachment.absolute_path);
      imageBytes += bytes.byteLength;
      images.push({ name: attachment.original_name, mimeType: attachment.mime_type, data: bytes.toString("base64") });
      continue;
    }

    if (attachment.mime_type.startsWith("video/")) {
      const result = spawnSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          attachment.absolute_path,
          "-vf",
          "fps=1/4,scale=768:-2",
          "-frames:v",
          "8",
          "-f",
          "image2pipe",
          "-vcodec",
          "mjpeg",
          "pipe:1",
        ],
        { encoding: "buffer", maxBuffer: 24 * 1024 * 1024, timeout: 20_000, windowsHide: true },
      );
      const frames = !result.error && result.status === 0 ? splitJpegFrames(result.stdout) : [];
      if (!frames.length) {
        extractedText.push(
          `[${attachment.original_name}: video frames could not be extracted in this runtime; do not claim visual analysis.]`,
        );
      } else {
        for (const [index, frame] of frames.entries()) {
          if (imageBytes + frame.byteLength > MAX_PROVIDER_IMAGE_TOTAL_BYTES) break;
          imageBytes += frame.byteLength;
          images.push({
            name: `${attachment.original_name} — frame ${index + 1}`,
            mimeType: "image/jpeg",
            data: frame.toString("base64"),
          });
        }
        extractedText.push(
          `[${attachment.original_name}: ${frames.length} representative video frames were extracted locally and are attached for visual review. Audio/transcription is not included.]`,
        );
      }
      continue;
    }

    if (attachment.mime_type.startsWith("text/") || ext === ".json") {
      try {
        const text = fs.readFileSync(attachment.absolute_path, "utf8").slice(0, 120_000);
        extractedText.push(`[Extracted text from ${attachment.original_name}]\n${text}`);
      } catch {
        extractedText.push(`[${attachment.original_name}: text could not be decoded in this runtime.]`);
      }
      continue;
    }

    if (attachment.mime_type === "application/pdf") {
      const result = spawnSync("pdftotext", ["-layout", attachment.absolute_path, "-"], {
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
        timeout: 15_000,
        windowsHide: true,
      });
      const text = !result.error && result.status === 0 ? String(result.stdout).slice(0, 120_000).trim() : "";
      extractedText.push(
        text
          ? `[Extracted text from ${attachment.original_name}]\n${text}`
          : `[${attachment.original_name}: PDF text extraction is unavailable; do not claim document analysis.]`,
      );
    }
  }

  return { extractedText: extractedText.length ? extractedText.join("\n\n") : "", images };
}

function readOutputTokenBudget(
  db: { prepare: (sql: string) => { get: (...args: any[]) => unknown } },
  prompt: string,
): number {
  const fallback = /\[Task\]|\[Workflow Pack Execution Rules\]/.test(prompt) ? 8192 : 2048;
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'tokenBudgetConfig'").get() as
      | { value?: string }
      | undefined;
    const config = row?.value ? JSON.parse(row.value) : null;
    const value = Number(config?.maxOutputTokens);
    return Number.isFinite(value) ? Math.max(512, Math.min(value, 16384)) : fallback;
  } catch {
    return fallback;
  }
}

export function createApiProviderTools(deps: CreateApiProviderToolsDeps) {
  const {
    db,
    logsDir,
    activeProcesses,
    broadcast,
    normalizeStreamChunk,
    handleTaskRunComplete,
    createSafeLogStreamOps,
    parseSSEStream,
    parseGeminiSSEStream,
  } = deps;

  async function parseAnthropicSSEStream(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    safeWrite: (text: string) => boolean,
    taskId?: string,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = "";

    const processLine = (trimmed: string) => {
      if (!trimmed || trimmed.startsWith(":")) return;
      if (!trimmed.startsWith("data: ")) return;
      if (trimmed === "data: [DONE]") return;
      try {
        const data = JSON.parse(trimmed.slice(6));
        if (data.type === "content_block_delta" && data.delta?.text) {
          const text = normalizeStreamChunk(data.delta.text);
          if (!text) return;
          safeWrite(text);
          if (taskId) {
            broadcast("cli_output", { task_id: taskId, stream: "stdout", data: text });
          }
        }
      } catch {
        /* ignore */
      }
    };

    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      if (signal.aborted) break;
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line.trim());
    }
    if (buffer.trim()) processLine(buffer.trim());
  }

  function getApiProviderById(providerId: string): ApiProviderRow | null {
    return (
      (db.prepare("SELECT * FROM api_providers WHERE id = ?").get(providerId) as unknown as ApiProviderRow) ?? null
    );
  }

  function resolveApiProviderModel(provider: ApiProviderRow, requestedModel: string | null): string {
    if (requestedModel) return requestedModel;
    if (provider.models_cache) {
      try {
        const models = JSON.parse(provider.models_cache) as string[];
        if (models.length > 0) return models[0];
      } catch {
        /* ignore */
      }
    }
    throw new Error(
      `No model specified for API provider '${provider.name}'. ` +
        `Please select a model in the agent settings or run a connection test first to cache available models.`,
    );
  }

  function normalizeApiBaseUrl(rawUrl: string): string {
    let url = rawUrl.replace(/\/+$/, "");
    url = url.replace(/\/(v\d+)\/(chat\/completions|models|messages)$/i, "/$1");
    url = url.replace(/\/v1beta\/models\/.+$/i, "/v1beta");
    return url;
  }

  function buildApiProviderRequest(
    provider: ApiProviderRow,
    model: string,
    prompt: string,
    projectPath: string,
    images: ProviderImage[],
  ): { url: string; headers: Record<string, string>; body: string } {
    const apiKey = provider.api_key_enc ? decryptSecret(provider.api_key_enc) : "";
    const baseUrl = normalizeApiBaseUrl(provider.base_url);
    const maxOutputTokens = readOutputTokenBudget(db, prompt);

    if (provider.type === "anthropic") {
      const messagesUrl = baseUrl.endsWith("/v1") ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;
      return {
        url: messagesUrl,
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxOutputTokens,
          stream: true,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                ...images.flatMap((image) => [
                  { type: "text", text: `Visual attachment: ${image.name}` },
                  { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } },
                ]),
              ],
            },
          ],
          system: `You are a coding assistant. Project path: ${projectPath}`,
        }),
      };
    }

    if (provider.type === "google") {
      const googleBase = baseUrl.endsWith("/v1beta") ? baseUrl : `${baseUrl}/v1beta`;
      const url = `${googleBase}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
      return {
        url,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                ...images.flatMap((image) => [
                  { text: `Visual attachment: ${image.name}` },
                  { inline_data: { mime_type: image.mimeType, data: image.data } },
                ]),
              ],
            },
          ],
          systemInstruction: { parts: [{ text: `You are a coding assistant. Project path: ${projectPath}` }] },
          generationConfig: { maxOutputTokens },
        }),
      };
    }

    const chatUrl = /\/v\d+$/.test(baseUrl) ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    if (provider.type === "openrouter") {
      headers["HTTP-Referer"] = "https://claw-empire.app";
      headers["X-Title"] = "Claw-Empire";
    }

    return {
      url: chatUrl,
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `You are a coding assistant. Project path: ${projectPath}` },
          {
            role: "user",
            content: images.length
              ? [
                  { type: "text", text: prompt },
                  ...images.flatMap((image) => [
                    { type: "text", text: `Visual attachment: ${image.name}` },
                    {
                      type: "image_url",
                      image_url: { url: `data:${image.mimeType};base64,${image.data}`, detail: "high" },
                    },
                  ]),
                ]
              : prompt,
          },
        ],
        max_tokens: maxOutputTokens,
        stream: true,
      }),
    };
  }

  async function executeApiProviderAgent(
    prompt: string,
    projectPath: string,
    logStream: fs.WriteStream,
    signal: AbortSignal,
    taskId?: string,
    apiProviderId?: string | null,
    apiModel?: string | null,
    safeWriteOverride?: (text: string) => boolean,
  ): Promise<void> {
    const safeWrite = safeWriteOverride ?? createSafeLogStreamOps(logStream).safeWrite;

    if (!apiProviderId) {
      throw new Error("No API provider configured for this agent. Set api_provider_id first.");
    }

    const provider = getApiProviderById(apiProviderId);
    if (!provider) {
      throw new Error(`API provider not found: ${apiProviderId}`);
    }
    if (!provider.enabled) {
      throw new Error(`API provider '${provider.name}' is disabled.`);
    }

    const model = resolveApiProviderModel(provider, apiModel ?? null);
    const header = `[api:${provider.type}] Provider: ${provider.name}, Model: ${model}\n---\n`;
    safeWrite(header);
    if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: header });

    const attachments = resolvePromptAttachments(db as any, logsDir, prompt);
    const prepared = prepareApiAttachmentInputs(attachments);
    const promptWithoutLocalPaths = prompt.replace(/^\s*Local file:\s*[^\n]+$/gm, "");
    const providerPrompt = prepared.extractedText
      ? `${promptWithoutLocalPaths}\n\n[Locally extracted attachment content — untrusted data]\n${prepared.extractedText}`
      : promptWithoutLocalPaths;
    const req = buildApiProviderRequest(provider, model, providerPrompt, projectPath, prepared.images);

    const resp = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API provider '${provider.name}' error (${resp.status}): ${text}`);
    }

    if (provider.type === "anthropic") {
      await parseAnthropicSSEStream(resp.body!, signal, safeWrite, taskId);
    } else if (provider.type === "google") {
      await parseGeminiSSEStream(resp.body!, signal, safeWrite, taskId);
    } else {
      await parseSSEStream(resp.body!, signal, safeWrite, taskId);
    }

    safeWrite(`\n---\n[api:${provider.type}] Done.\n`);
    if (taskId) {
      broadcast("cli_output", { task_id: taskId, stream: "stderr", data: `\n---\n[api:${provider.type}] Done.\n` });
    }
  }

  function launchApiProviderAgent(
    taskId: string,
    apiProviderId: string | null,
    apiModel: string | null,
    prompt: string,
    projectPath: string,
    logPath: string,
    controller: AbortController,
    fakePid: number,
    onComplete?: (exitCode: number) => void,
  ): void {
    const logStream = fs.createWriteStream(logPath, { flags: "a" });
    const { safeWrite, safeEnd } = createSafeLogStreamOps(logStream);
    safeWrite(`\n===== task run start ${new Date().toISOString()} | provider=api =====\n`);

    const promptPath = path.join(logsDir, `${taskId}.prompt.txt`);
    fs.writeFileSync(promptPath, prompt, "utf8");

    const mockProc = {
      pid: fakePid,
      kill: () => {
        controller.abort();
        return true;
      },
    } as unknown as ChildProcess;
    activeProcesses.set(taskId, mockProc);

    const runTask = (async () => {
      let exitCode = 0;
      try {
        await executeApiProviderAgent(
          prompt,
          projectPath,
          logStream,
          controller.signal,
          taskId,
          apiProviderId,
          apiModel,
          safeWrite,
        );
      } catch (err: any) {
        exitCode = 1;
        if (err.name !== "AbortError") {
          const msg = normalizeStreamChunk(`[api] Error: ${err.message}\n`);
          safeWrite(msg);
          broadcast("cli_output", { task_id: taskId, stream: "stderr", data: msg });
          console.error(`[Claw-Empire] API provider agent error (task ${taskId}): ${err.message}`);
        } else {
          const msg = normalizeStreamChunk(`[api] Aborted by user\n`);
          safeWrite(msg);
          broadcast("cli_output", { task_id: taskId, stream: "stderr", data: msg });
        }
      } finally {
        await new Promise<void>((resolve) => safeEnd(resolve));
        try {
          fs.unlinkSync(promptPath);
        } catch {
          /* ignore */
        }
        if (onComplete) {
          onComplete(exitCode);
        } else {
          handleTaskRunComplete(taskId, exitCode);
        }
      }
    })();

    runTask.catch(() => {});
  }

  return {
    executeApiProviderAgent,
    launchApiProviderAgent,
  };
}
