import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiProviderTools, type ApiProviderRunOptions } from "./api-provider-tools.ts";
import { createStreamTools } from "./stream-tools.ts";
import { createSessionReviewTools } from "../../orchestration/session-review-tools.ts";
import type { ApiProviderRow } from "./types.ts";
import * as oauthHelpers from "../../../../oauth/helpers.ts";

type Message = { role: string; content?: string; tool_call_id?: string; tool_calls?: unknown[] };
type ModelRequest = {
  model: string;
  messages: Message[];
  tools?: Array<{ function: { name: string; parameters: { properties: object } } }>;
  tool_choice?: string;
};
type McpRequest = {
  jsonrpc: string;
  id?: number;
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown>; protocolVersion?: string };
};
type ObservedRequest = { url: string; method: string; headers: Headers; body: ModelRequest | McpRequest | null };

const MODEL_URL = "https://configured-model.example/v1/chat/completions";
const MCP_URL = "https://search.parallel.ai/mcp";
const SOURCE_URL = "https://example.com/reference";
const SEARCH_ARGS = { objective: "Find current source material", search_queries: ["current reference documentation"] };

function event(delta: object, finishReason: string | null = null) {
  return { choices: [{ index: 0, delta, finish_reason: finishReason }] };
}

function sse(events: object[], completed = true): Response {
  // Split even JSON tokens and CRLFs across chunks, and omit the final newline.
  const raw =
    events.map((value) => `data: ${JSON.stringify(value)}\r\n\r\n`).join("") + (completed ? "data: [DONE]" : "");
  const bytes = new TextEncoder().encode(raw);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let index = 0; index < bytes.length; index += 11) controller.enqueue(bytes.slice(index, index + 11));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}

function answer(text = "A cited answer from the configured model.") {
  return sse([event({ content: text }), event({}, "stop")]);
}

function tool(name: string, args: object | string = SEARCH_ARGS, id = "search-1") {
  const argumentText = typeof args === "string" ? args : JSON.stringify(args);
  const split = Math.floor(argumentText.length / 2);
  return sse([
    event({
      tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: argumentText.slice(0, split) } }],
    }),
    event({ tool_calls: [{ index: 0, function: { arguments: argumentText.slice(split) } }] }),
    event({}, "tool_calls"),
  ]);
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function network(
  model: (body: ModelRequest, index: number) => Response | Promise<Response>,
  call?: (rpc: McpRequest, signal: AbortSignal) => unknown | Promise<unknown>,
) {
  const observed: ObservedRequest[] = [];
  const modelRequests: ModelRequest[] = [];
  const calls: McpRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      const raw = request.method === "POST" ? await request.text() : "";
      const body = raw ? JSON.parse(raw) : null;
      observed.push({ url: request.url, method: request.method, headers: request.headers, body });
      if (request.url === MODEL_URL) {
        modelRequests.push(body);
        return model(body, modelRequests.length - 1);
      }
      expect(request.url).toBe(MCP_URL);
      if (request.method === "GET") return new Response(null, { status: 405 });
      if (request.method === "DELETE") return new Response(null, { status: 204 });
      const rpc = body as McpRequest;
      if (rpc.id === undefined) return new Response(null, { status: 202 });
      let result: unknown;
      if (rpc.method === "initialize") {
        result = {
          protocolVersion: rpc.params?.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "test-parallel", version: "1" },
        };
      } else if (rpc.method === "tools/list") {
        result = {
          tools: ["web_search", "web_fetch"].map((name) => ({ name, inputSchema: { type: "object", properties: {} } })),
        };
      } else if (rpc.method === "tools/call") {
        calls.push(rpc);
        result = call
          ? await call(rpc, request.signal)
          : {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ results: [{ url: SOURCE_URL, excerpts: ["Verified source material."] }] }),
                },
              ],
            };
        if (result instanceof Response) return result;
      } else throw new Error(`Unexpected MCP method ${rpc.method}`);
      return json({ jsonrpc: "2.0", id: rpc.id, result });
    }),
  );
  return { observed, modelRequests, calls };
}

const tempDirs: string[] = [];

function harness(providerOverrides: Partial<ApiProviderRow> = {}) {
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), "claw-api-search-"));
  tempDirs.push(logsDir);
  const provider: ApiProviderRow = {
    id: "saved-provider",
    name: "My selected provider",
    type: "custom",
    base_url: "https://configured-model.example/v1",
    api_key_enc: null,
    enabled: 1,
    models_cache: JSON.stringify(["saved-model"]),
    models_cached_at: null,
    ...providerOverrides,
  };
  const db = {
    prepare: (sql: string) => ({
      get: () =>
        sql.includes("FROM api_providers")
          ? provider
          : sql.includes("SELECT cli_tool_use_id FROM subtasks")
            ? { cli_tool_use_id: "created-subtask-marker" }
            : undefined,
    }),
  };
  const broadcast = vi.fn();
  const createSubtaskFromCli = vi.fn();
  const completeSubtaskFromCli = vi.fn();
  const stream = createStreamTools({
    db,
    broadcast,
    normalizeStreamChunk: String,
    createSubtaskFromCli,
    completeSubtaskFromCli,
  });
  const activeProcesses = new Map<string, ChildProcess>();
  const tools = createApiProviderTools({
    db,
    logsDir,
    activeProcesses,
    broadcast,
    normalizeStreamChunk: String,
    handleTaskRunComplete: vi.fn(),
    ...stream,
  });
  const taskExecutionSessions = new Map();
  const sessions = createSessionReviewTools({
    taskExecutionSessions,
    randomUUID,
    nowMs: Date.now,
    appendTaskLog: vi.fn(),
  });
  const output: string[] = [];
  const run = (
    prompt = "Research the reference",
    options: ApiProviderRunOptions = {},
    signal = new AbortController().signal,
    model: string | null = null,
  ) =>
    tools.executeApiProviderAgent(
      prompt,
      logsDir,
      {} as fs.WriteStream,
      signal,
      "task-a",
      provider.id,
      model,
      (text) => {
        output.push(text);
        return true;
      },
      options,
    );
  return {
    ...tools,
    logsDir,
    output,
    run,
    sessions,
    broadcast,
    provider,
    activeProcesses,
    createSubtaskFromCli,
    completeSubtaskFromCli,
  };
}

describe("API task search through the provider runtime", () => {
  beforeEach(() => {
    vi.stubEnv("CLAW_EMPIRE_API_SEARCH", undefined);
    vi.stubEnv("PARALLEL_API_KEY", undefined);
    vi.stubEnv("OPENAI_API_KEY", undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    for (const directory of tempDirs.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
  });

  it("launches a no-key task, consumes search/fetch/follow-up results, and streams a cited answer", async () => {
    const h = harness();
    const session = h.sessions.ensureTaskExecutionSession("task-a", "agent-a", "api");
    const n = network((request) => {
      expect(request.model).toBe("saved-model");
      expect(request.tools?.map((value) => value.function.name)).toEqual(["web_search", "web_fetch"]);
      for (const value of request.tools ?? []) {
        expect(value.function.parameters.properties).not.toHaveProperty("session_id");
        expect(value.function.parameters.properties).not.toHaveProperty("model_name");
      }
      const results = request.messages.filter((message) => message.role === "tool");
      if (!results.length) return tool("web_search", SEARCH_ARGS, "first-search");
      expect(results.at(-1)?.content).toContain(SOURCE_URL);
      if (results.length === 1)
        return tool("web_fetch", { urls: [SOURCE_URL], objective: "Verify the reference" }, "fetch-source");
      if (results.length === 2) return tool("web_search", SEARCH_ARGS, "follow-up-search");
      return answer(`Verified reference: ${SOURCE_URL}`);
    });
    const logPath = path.join(h.logsDir, "task-a.log");
    const code = await new Promise<number>((resolve) =>
      h.launchApiProviderAgent(
        "task-a",
        h.provider.id,
        null,
        "Research the reference",
        h.logsDir,
        logPath,
        new AbortController(),
        -1,
        resolve,
        { searchSessionId: session.sessionId },
      ),
    );
    expect(code).toBe(0);
    expect(fs.readFileSync(logPath, "utf8")).toContain(`Verified reference: ${SOURCE_URL}`);
    expect(fs.existsSync(path.join(h.logsDir, "task-a.prompt.txt"))).toBe(false);
    expect(h.broadcast).toHaveBeenCalledWith(
      "cli_output",
      expect.objectContaining({ stream: "stdout", data: `Verified reference: ${SOURCE_URL}` }),
    );
    expect(n.calls.map((rpc) => rpc.params?.name)).toEqual(["web_search", "web_fetch", "web_search"]);
    expect(
      n.calls.every(
        (rpc) =>
          rpc.params?.arguments?.session_id === session.sessionId &&
          rpc.params?.arguments?.model_name === "saved-model",
      ),
    ).toBe(true);
    const mcpRequests = n.observed.filter((request) => request.url === MCP_URL);
    expect(mcpRequests.some((request) => (request.body as McpRequest | null)?.method === "initialize")).toBe(true);
    expect(mcpRequests.some((request) => (request.body as McpRequest | null)?.method === "tools/list")).toBe(true);
    for (const request of mcpRequests) {
      expect(request.headers.get("user-agent")).toMatch(/^Claw-Empire\/.*github.com\/GreenSheep01201\/claw-empire/);
      expect(request.headers.has("authorization")).toBe(false);
    }
    expect(n.modelRequests[1].messages).toContainEqual(
      expect.objectContaining({
        role: "assistant",
        tool_calls: [
          expect.objectContaining({
            id: "first-search",
            function: { name: "web_search", arguments: JSON.stringify(SEARCH_ARGS) },
          }),
        ],
      }),
    );
    expect(n.modelRequests[1].messages).toContainEqual(
      expect.objectContaining({ role: "tool", tool_call_id: "first-search" }),
    );
  });

  it("uses the production session owner for concurrent tasks, follow-ups, retries and reset", async () => {
    const h = harness();
    const n = network((request) =>
      request.messages.some((message) => message.role === "tool")
        ? answer()
        : tool("web_search", { ...SEARCH_ARGS, objective: request.messages[1].content }),
    );
    const first = h.sessions.ensureTaskExecutionSession("task-a", "agent-a", "api");
    const second = h.sessions.ensureTaskExecutionSession("task-b", "agent-b", "api");
    expect(first.sessionId).not.toBe(second.sessionId);
    await Promise.all([
      h.run("task A", { searchSessionId: first.sessionId }),
      h.run("task B", { searchSessionId: second.sessionId }),
    ]);
    const resumed = h.sessions.ensureTaskExecutionSession("task-a", "agent-a", "api");
    await h.run("task A follow-up", { searchSessionId: resumed.sessionId });
    h.sessions.endTaskExecutionSession("task-a", "new research run");
    const reset = h.sessions.ensureTaskExecutionSession("task-a", "agent-a", "api");
    await h.run("task A reset", { searchSessionId: reset.sessionId });
    const ids = Object.fromEntries(
      n.calls.map((call) => [call.params?.arguments?.objective, call.params?.arguments?.session_id]),
    );
    expect(ids["task A"]).toBe(ids["task A follow-up"]);
    expect(ids["task A"]).not.toBe(ids["task B"]);
    expect(ids["task A reset"]).not.toBe(ids["task A"]);
    expect(Object.values(ids).every((id) => /^[a-f0-9-]{36}$/.test(String(id)))).toBe(true);
  });

  it("preserves automatic subtask markers split across search-enabled model deltas", async () => {
    const h = harness();
    const n = network(() =>
      sse([
        event({ content: '{"subtasks":[{"title":"Verify ' }),
        event({ content: 'source"}]}' }),
        event({ content: '\n{"subtask_' }),
        event({ content: 'done":"Verify source"}' }),
        event({}, "stop"),
      ]),
    );
    await h.run("Research", { searchSessionId: "opaque-task-session" });
    expect(n.modelRequests[0].tools).toHaveLength(2);
    expect(h.createSubtaskFromCli).toHaveBeenCalledExactlyOnceWith(
      "task-a",
      expect.stringMatching(/^http-plan-/),
      "Verify source",
    );
    expect(h.completeSubtaskFromCli).toHaveBeenCalledExactlyOnceWith("created-subtask-marker");
    expect(h.output.join("")).toContain('{"subtasks":[{"title":"Verify source"}]}');
  });

  it.each([
    ["one-shot", {}, undefined],
    ["noTools", { searchSessionId: "opaque-task-session", noTools: true }, undefined],
    ["explicit off", { searchSessionId: "opaque-task-session" }, "off"],
  ] as const)("preserves tool-free %s calls", async (_label, options, mode) => {
    if (mode) vi.stubEnv("CLAW_EMPIRE_API_SEARCH", mode);
    const h = harness();
    const n = network(() => answer("Original text-only path"));
    await h.run("Write a response", options);
    expect(n.modelRequests).toHaveLength(1);
    expect(n.modelRequests[0]).not.toHaveProperty("tools");
    expect(n.observed.every((request) => request.url === MODEL_URL)).toBe(true);
    expect(h.output.join("")).toContain("Original text-only path");
  });

  it.each([undefined, "parallel"])(
    "keeps an explicit model override and enables search for mode %s without eager MCP setup",
    async (mode) => {
      vi.stubEnv("CLAW_EMPIRE_API_SEARCH", mode);
      const h = harness();
      const n = network(() => answer());
      await h.run("Answer from memory", { searchSessionId: "opaque-task-session" }, undefined, "my-model-override");
      expect(n.modelRequests[0].model).toBe("my-model-override");
      expect(n.modelRequests[0].tools?.map((value) => value.function.name)).toEqual(["web_search", "web_fetch"]);
      expect(n.observed).toHaveLength(1);
    },
  );

  it("preserves saved model credentials without forwarding them to Parallel", async () => {
    const decrypt = vi.spyOn(oauthHelpers, "decryptSecret").mockReturnValue("configured-model-token");
    const h = harness({ api_key_enc: "stored-encrypted-credential" });
    const n = network((request) =>
      request.messages.some((message) => message.role === "tool") ? answer() : tool("web_search"),
    );
    await h.run("Research", { searchSessionId: "opaque-task-session" });
    expect(decrypt).toHaveBeenCalledWith("stored-encrypted-credential");
    expect(
      n.observed
        .filter((request) => request.url === MODEL_URL)
        .every((request) => request.headers.get("authorization") === "Bearer configured-model-token"),
    ).toBe(true);
    expect(
      n.observed.filter((request) => request.url === MCP_URL).every((request) => !request.headers.has("authorization")),
    ).toBe(true);
  });

  it.each(["anthropic", "google"] as const)(
    "preserves the existing %s protocol without enabling search",
    async (type) => {
      const h = harness({ type });
      const requests: object[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init: RequestInit) => {
          requests.push(JSON.parse(String(init.body)));
          const payload =
            type === "anthropic"
              ? { type: "content_block_delta", delta: { text: "Existing protocol output" } }
              : { candidates: [{ content: { parts: [{ text: "Existing protocol output" }] } }] };
          return new Response(`data: ${JSON.stringify(payload)}\n\n`, {
            headers: { "content-type": "text/event-stream" },
          });
        }),
      );
      await h.run("Research", { searchSessionId: "opaque-task-session" });
      expect(requests).toHaveLength(1);
      expect(requests[0]).not.toHaveProperty("tools");
      expect(h.output.join("")).toContain("Existing protocol output");
    },
  );

  it("rejects a disabled provider or unknown search choice before network access", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(harness({ enabled: 0 }).run("Research", { searchSessionId: "opaque-task-session" })).rejects.toThrow(
      "disabled",
    );
    vi.stubEnv("CLAW_EMPIRE_API_SEARCH", "my-explicit-provider");
    await expect(harness().run("Research", { searchSessionId: "opaque-task-session" })).rejects.toThrow(
      "must be parallel or off",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reconstructs interleaved tool-call fragments and consumes both results", async () => {
    const h = harness();
    const n = network((request) => {
      if (request.messages.some((message) => message.role === "tool")) return answer();
      return sse([
        event({
          tool_calls: [
            { index: 1, id: "fetch", type: "function", function: { name: "web_", arguments: '{"urls":[' } },
            {
              index: 0,
              id: "search",
              type: "function",
              function: { name: "web_search", arguments: JSON.stringify(SEARCH_ARGS) },
            },
          ],
        }),
        event({ tool_calls: [{ index: 1, function: { name: "fetch", arguments: `"${SOURCE_URL}"]}` } }] }),
        event({}, "tool_calls"),
      ]);
    });
    await h.run("Research", { searchSessionId: "opaque-task-session" });
    expect(n.calls.map((call) => call.params?.name)).toEqual(["web_search", "web_fetch"]);
    expect(
      n.modelRequests[1].messages.filter((message) => message.role === "tool").map((message) => message.tool_call_id),
    ).toEqual(["search", "fetch"]);
  });

  it.each([
    ["invalid JSON", "web_search", "{"],
    ["unsupported tool", "run_shell", {}],
    ["non-HTTP URL", "web_fetch", { urls: ["file:///etc/passwd"] }],
    ["URL credentials", "web_fetch", { urls: ["https://user:secret@example.com/"] }],
  ])("returns %s as a tool error without making a search request", async (_label, name, args) => {
    const h = harness();
    const n = network((request) => {
      const result = request.messages.find((message) => message.role === "tool");
      if (!result) return tool(String(name), args as string | object);
      expect(JSON.parse(result.content ?? "{}").isError).toBe(true);
      return answer("Search could not be completed.");
    });
    await h.run("Research", { searchSessionId: "opaque-task-session" });
    expect(n.calls).toHaveLength(0);
    expect(n.observed.every((request) => request.url === MODEL_URL)).toBe(true);
  });

  it("retains session identity after a quota/error response and on retry", async () => {
    const h = harness();
    const session = h.sessions.ensureTaskExecutionSession("task-a", "agent-a", "api");
    const n = network(
      (request) => {
        const result = request.messages.find((message) => message.role === "tool");
        if (!result) return tool("web_search");
        expect(JSON.parse(result.content ?? "{}").isError).toBe(true);
        return answer("The search service is unavailable.");
      },
      () => ({ isError: true, content: [{ type: "text", text: "Anonymous quota exceeded" }] }),
    );
    await h.run("Research", { searchSessionId: session.sessionId });
    const retry = h.sessions.ensureTaskExecutionSession("task-a", "agent-a", "api");
    await h.run("Retry research", { searchSessionId: retry.sessionId });
    expect(n.calls.map((call) => call.params?.arguments?.session_id)).toEqual([session.sessionId, session.sessionId]);
    expect(n.modelRequests).toHaveLength(4);
  });

  it("passes MCP HTTP errors back to the configured model without provider fallback", async () => {
    const h = harness();
    const n = network(
      (request) => {
        const result = request.messages.find((message) => message.role === "tool");
        if (!result) return tool("web_search");
        expect(result.content).toContain("Quota exceeded");
        expect(JSON.parse(result.content ?? "{}").isError).toBe(true);
        return answer("Search is currently unavailable.");
      },
      () => new Response("Quota exceeded", { status: 429, headers: { "retry-after": "60" } }),
    );
    await h.run("Research", { searchSessionId: "opaque-task-session" });
    expect(n.calls).toHaveLength(1);
    expect(n.modelRequests).toHaveLength(2);
    expect(n.observed.every((request) => [MODEL_URL, MCP_URL].includes(request.url))).toBe(true);
  });

  it("does not let the model replace the task identity or analytics model", async () => {
    const h = harness();
    const n = network((request) =>
      request.messages.some((message) => message.role === "tool")
        ? answer()
        : tool("web_search", { ...SEARCH_ARGS, session_id: "model-supplied", model_name: "wrong-model" }),
    );
    await h.run("Research", { searchSessionId: "actual-task-session" });
    expect(n.calls[0].params?.arguments).toMatchObject({
      session_id: "actual-task-session",
      model_name: "saved-model",
    });
  });

  it("surfaces model HTTP errors without retrying or falling back", async () => {
    const h = harness();
    const n = network(() => new Response("Configured model failed", { status: 503 }));
    await expect(h.run("Research", { searchSessionId: "opaque-task-session" })).rejects.toThrow("503");
    expect(n.observed).toHaveLength(1);
  });

  it("rejects truncated model streams rather than executing partial tool calls", async () => {
    const h = harness();
    const n = network(() =>
      sse(
        [
          event({
            tool_calls: [
              {
                index: 0,
                id: "unfinished",
                type: "function",
                function: { name: "web_search", arguments: JSON.stringify(SEARCH_ARGS) },
              },
            ],
          }),
        ],
        false,
      ),
    );
    await expect(h.run("Research", { searchSessionId: "opaque-task-session" })).rejects.toThrow(/truncated|finish/i);
    expect(n.calls).toHaveLength(0);
  });

  it("cancels an in-flight MCP call without another model turn", async () => {
    const h = harness();
    const controller = new AbortController();
    let started!: () => void;
    const pendingCall = new Promise<void>((resolve) => {
      started = resolve;
    });
    const n = network(
      () => tool("web_search"),
      (_rpc, signal) =>
        new Promise((_resolve, reject) => {
          started();
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );
    const running = h.run("Research", { searchSessionId: "opaque-task-session" }, controller.signal);
    await pendingCall;
    const reason = new DOMException("Stopped by user", "AbortError");
    controller.abort(reason);
    await expect(running).rejects.toThrow("Stopped by user");
    expect(n.modelRequests).toHaveLength(1);
  });

  it("bounds MCP requests and returns timeout errors for model consumption", async () => {
    const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
    const deadlines: number[] = [];
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      deadlines.push(milliseconds);
      return originalTimeout(10);
    });
    const h = harness();
    const n = network(
      (request) => {
        const result = request.messages.find((message) => message.role === "tool");
        if (!result) return tool("web_search");
        expect(JSON.parse(result.content ?? "{}").isError).toBe(true);
        expect(result.content).toMatch(/timeout|aborted/i);
        return answer("The search timed out.");
      },
      (_rpc, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
        ),
    );
    await h.run("Research", { searchSessionId: "opaque-task-session" });
    expect(deadlines.length).toBeGreaterThan(0);
    expect(deadlines).toContain(30_000);
    expect(deadlines.every((milliseconds) => [30_000, 180_000].includes(milliseconds))).toBe(true);
    expect(n.modelRequests).toHaveLength(2);
  });

  it("limits repeated tool rounds and asks the configured model to finish", async () => {
    const h = harness();
    const n = network((request, index) =>
      request.tool_choice === "none"
        ? answer("Summary after bounded research.")
        : tool("web_search", SEARCH_ARGS, `search-${index}`),
    );
    await h.run("Research", { searchSessionId: "opaque-task-session" });
    expect(n.calls).toHaveLength(8);
    expect(n.modelRequests).toHaveLength(9);
    expect(n.modelRequests.at(-1)?.tool_choice).toBe("none");
    expect(h.output.join("")).toContain("Summary after bounded research.");
  });
});
