import express from "express";
import request from "supertest";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyBaseSchema } from "../../bootstrap/schema/base-schema.ts";
import { applyTaskSchemaMigrations } from "../../bootstrap/schema/task-schema-migrations.ts";

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function createHarness(now = 1_717_171_717_000) {
  process.env.SESSION_SECRET = "api-provider-test-secret";
  vi.resetModules();

  const db = new DatabaseSync(":memory:");
  applyBaseSchema(db);
  applyTaskSchemaMigrations(db);

  const app = express();
  app.use(express.json());

  const { registerApiProviderRoutes } = await import("./api-providers.ts");
  registerApiProviderRoutes({
    app,
    db,
    nowMs: () => now,
  });

  return { app, db };
}

async function createProviderTools(db: DatabaseSync) {
  const { createApiProviderTools } = await import("../../workflow/agents/providers/api-provider-tools.ts");
  return createApiProviderTools({
    db,
    logsDir: ".tmp",
    activeProcesses: new Map(),
    broadcast: vi.fn(),
    normalizeStreamChunk: String,
    handleTaskRunComplete: vi.fn(),
    createSafeLogStreamOps: () => ({ safeWrite: () => true, safeEnd: vi.fn(), isClosed: () => false }),
    parseSSEStream: vi.fn().mockResolvedValue(undefined),
    parseGeminiSSEStream: vi.fn().mockResolvedValue(undefined),
  });
}

describe("api provider routes", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, SESSION_SECRET: "api-provider-test-secret" };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns generic presets and official preset catalog", async () => {
    const { app, db } = await createHarness();

    try {
      const response = await request(app).get("/api/api-providers/presets").expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.presets.openai.base_url).toBe("https://api.openai.com/v1");
      expect(response.body.official_presets["opencode-go-openai"]).toMatchObject({
        type: "openai",
        base_url: "https://opencode.ai/zen/go/v1",
      });
      expect(response.body.official_presets["alibaba-coding-plan-openai"].fallback_models).toContain("qwen3.5-plus");
    } finally {
      db.close();
    }
  });

  it("returns MiniMax regional presets with current model IDs", async () => {
    const { app, db } = await createHarness();

    try {
      const response = await request(app).get("/api/api-providers/presets").expect(200);
      const expectedPresets = {
        "minimax-global-openai": { type: "openai", base_url: "https://api.minimax.io/v1" },
        "minimax-global-anthropic": { type: "anthropic", base_url: "https://api.minimax.io/anthropic" },
        "minimax-cn-openai": { type: "openai", base_url: "https://api.minimaxi.com/v1" },
        "minimax-cn-anthropic": { type: "anthropic", base_url: "https://api.minimaxi.com/anthropic" },
      };

      for (const [key, expected] of Object.entries(expectedPresets)) {
        expect(response.body.official_presets[key]).toMatchObject({
          ...expected,
          fallback_models: ["MiniMax-M3.1-Flash", "MiniMax-M3"],
        });
      }
    } finally {
      db.close();
    }
  });

  it.each([
    ["minimax-global-openai", "https://api.minimax.io/v1/models"],
    ["minimax-global-anthropic", "https://api.minimax.io/anthropic/v1/models"],
    ["minimax-cn-openai", "https://api.minimaxi.com/v1/models"],
    ["minimax-cn-anthropic", "https://api.minimaxi.com/anthropic/v1/models"],
  ])("keeps %s choices current across cached, refreshed and stale discovery", async (presetKey, modelsUrl) => {
    const { app, db } = await createHarness();
    const expected = ["MiniMax-M3.1-Flash", "MiniMax-M3"];
    try {
      const created = await request(app).post("/api/api-providers").send({ name: "MiniMax", preset_key: presetKey });
      const id = created.body.id;
      const seeded = await request(app).get(`/api/api-providers/${id}/models`).expect(200);
      expect(seeded.body.models).toEqual(expected);
      const legacyCache = JSON.stringify(["MiniMax-M2.7", "MiniMax-M3", "speech-02-hd"]);
      db.prepare("UPDATE api_providers SET models_cache = ? WHERE id = ?").run(legacyCache, id);
      const cached = await request(app).get(`/api/api-providers/${id}/models`).expect(200);
      expect(cached.body.models).toEqual([...expected, "speech-02-hd"]);
      const listed = await request(app).get("/api/api-providers").expect(200);
      expect(listed.body.providers[0].models_cache).toEqual(cached.body.models);
      expect(db.prepare("SELECT models_cache FROM api_providers WHERE id = ?").get(id)?.models_cache).toBe(legacyCache);

      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "MiniMax-M2.7" }, { id: "MiniMax-M3" }] }));
      vi.stubGlobal("fetch", fetchMock);
      const tested = await request(app).post(`/api/api-providers/${id}/test`).expect(200);
      expect(tested.body.models).toEqual(expected);
      expect(fetchMock.mock.calls[0][0]).toBe(modelsUrl);
      const refreshed = await request(app).get(`/api/api-providers/${id}/models?refresh=true`).expect(200);
      expect(refreshed.body.models).toEqual(expected);
      expect(fetchMock.mock.calls[1][0]).toBe(modelsUrl);
      fetchMock.mockResolvedValue(jsonResponse({}, 503));
      const stale = await request(app).get(`/api/api-providers/${id}/models?refresh=true`).expect(200);
      expect(stale.body).toMatchObject({ models: expected, cached: true, stale: true });
    } finally {
      db.close();
    }
  });

  it.each([
    ["minimax-global-openai", "https://api.minimax.io/v1/chat/completions"],
    ["minimax-global-anthropic", "https://api.minimax.io/anthropic/v1/messages"],
    ["minimax-cn-openai", "https://api.minimaxi.com/v1/chat/completions"],
    ["minimax-cn-anthropic", "https://api.minimaxi.com/anthropic/v1/messages"],
  ])("sends the default and explicit models unchanged through %s", async (presetKey, url) => {
    const { app, db } = await createHarness();
    try {
      const created = await request(app).post("/api/api-providers").send({ name: "MiniMax", preset_key: presetKey });
      const tools = await createProviderTools(db);
      const fetchMock = vi.fn().mockImplementation(async () => new Response("data: [DONE]\n\n"));
      vi.stubGlobal("fetch", fetchMock);
      for (const selected of [null, "MiniMax-M3", "MiniMax-M2.7", "custom-model"]) {
        await tools.executeApiProviderAgent(
          "Preserve this prompt",
          "/project",
          null!,
          new AbortController().signal,
          undefined,
          created.body.id,
          selected,
          () => true,
        );
        const [requestUrl, requestInit] = fetchMock.mock.calls.at(-1)!;
        expect(requestUrl).toBe(url);
        expect(requestInit.method).toBe("POST");
        const body = JSON.parse(requestInit.body);
        expect(body.model).toBe(selected ?? "MiniMax-M3.1-Flash");
        expect(body.stream).toBe(true);
        expect(body.messages.at(-1)).toEqual({ role: "user", content: "Preserve this prompt" });
        expect(body).not.toHaveProperty("thinking");
        expect(body).not.toHaveProperty("reasoning_effort");
        expect(body).not.toHaveProperty("output_config");
        expect(body).not.toHaveProperty("service_tier");
        expect(body).not.toHaveProperty("reasoning_split");
        if (presetKey.endsWith("anthropic")) expect(body.max_tokens).toBe(16384);
      }
      for (const cache of [null, "not-json", JSON.stringify(["MiniMax-M2.7"])]) {
        db.prepare("UPDATE api_providers SET models_cache = ? WHERE id = ?").run(cache, created.body.id);
        await tools.executeApiProviderAgent(
          "Default",
          "/project",
          null!,
          new AbortController().signal,
          undefined,
          created.body.id,
          null,
          () => true,
        );
        expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).model).toBe("MiniMax-M3.1-Flash");
      }
    } finally {
      db.close();
    }
  });

  it("uses the documented M3 gateway route without seeding an unverified protocol", async () => {
    const { app, db } = await createHarness();
    try {
      const presets = await request(app).get("/api/api-providers/presets").expect(200);
      expect(presets.body.official_presets["opencode-go-anthropic"]).toMatchObject({
        base_url: "https://opencode.ai/inference/go/anthropic/v1",
        fallback_models: ["minimax-m3"],
      });
      const created = await request(app)
        .post("/api/api-providers")
        .send({ name: "Gateway", preset_key: "opencode-go-anthropic" });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: [{ id: "minimax-m2.5" }, { id: "minimax-m3" }, { id: "minimax-m3.1-flash" }] }),
        );
      vi.stubGlobal("fetch", fetchMock);
      const tested = await request(app).post(`/api/api-providers/${created.body.id}/test`).expect(200);
      expect(tested.body.models).toEqual(["minimax-m3"]);
      expect(fetchMock.mock.calls[0][0]).toBe("https://opencode.ai/inference/go/v1/models");
      const tools = await createProviderTools(db);
      fetchMock.mockImplementation(async () => new Response("data: [DONE]\n\n"));
      await tools.executeApiProviderAgent(
        "Gateway prompt",
        "/project",
        null!,
        new AbortController().signal,
        "test-session",
        created.body.id,
        null,
        () => true,
      );
      const [url, init] = fetchMock.mock.calls.at(-1)!;
      expect(url).toBe("https://opencode.ai/inference/go/anthropic/v1/messages");
      expect(JSON.parse(init.body)).toMatchObject({ model: "minimax-m3", max_tokens: 16384, stream: true });
      expect(init.headers).toMatchObject({ "User-Agent": "claw-empire", "x-opencode-session": "test-session" });
    } finally {
      db.close();
    }
  });

  it("creates a preset-backed provider with authoritative type/base_url and seeded models", async () => {
    const { app, db } = await createHarness();

    try {
      const createResponse = await request(app).post("/api/api-providers").send({
        name: "OpenCode Go",
        type: "custom",
        base_url: "https://example.com/not-used",
        preset_key: "opencode-go-openai",
        api_key: "sk-test-open",
      });

      expect(createResponse.status).toBe(200);
      expect(createResponse.body.ok).toBe(true);

      const row = db
        .prepare(
          `
            SELECT name, type, base_url, preset_key, models_cache, models_cached_at
            FROM api_providers
            WHERE id = ?
          `,
        )
        .get(createResponse.body.id) as
        | {
            name: string;
            type: string;
            base_url: string;
            preset_key: string | null;
            models_cache: string | null;
            models_cached_at: number | null;
          }
        | undefined;

      expect(row).toMatchObject({
        name: "OpenCode Go",
        type: "openai",
        base_url: "https://opencode.ai/zen/go/v1",
        preset_key: "opencode-go-openai",
      });
      expect(JSON.parse(String(row?.models_cache))).toEqual(["glm-5", "kimi-k2.5"]);
      expect(row?.models_cached_at).toBe(1_717_171_717_000);

      const listResponse = await request(app).get("/api/api-providers").expect(200);
      expect(listResponse.body.providers[0]).toMatchObject({
        preset_key: "opencode-go-openai",
        type: "openai",
        base_url: "https://opencode.ai/zen/go/v1",
        models_cache: ["glm-5", "kimi-k2.5"],
      });
    } finally {
      db.close();
    }
  });

  it("rejects invalid Bailian Coding Plan API keys on update", async () => {
    const { app, db } = await createHarness();

    try {
      const insertResult = db
        .prepare(
          `
            INSERT INTO api_providers (id, name, type, base_url, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
          `,
        )
        .run("provider-1", "Legacy", "openai", "https://api.openai.com/v1", 1_000, 1_000);

      expect(insertResult.changes).toBe(1);

      const response = await request(app).put("/api/api-providers/provider-1").send({
        preset_key: "alibaba-coding-plan-openai",
        api_key: "sk-invalid-prefix",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("sk-sp-");

      const row = db.prepare("SELECT preset_key, models_cache FROM api_providers WHERE id = ?").get("provider-1") as {
        preset_key: string | null;
        models_cache: string | null;
      };
      expect(row.preset_key).toBeNull();
      expect(row.models_cache).toBeNull();
    } finally {
      db.close();
    }
  });

  it("rejects retained invalid keys when switching to a Bailian preset", async () => {
    const { app, db } = await createHarness();

    try {
      const { encryptSecret } = await import("../../../oauth/helpers.ts");
      const insertResult = db
        .prepare(
          `
            INSERT INTO api_providers (id, name, type, base_url, api_key_enc, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
          `,
        )
        .run(
          "provider-legacy-key",
          "Legacy",
          "openai",
          "https://api.openai.com/v1",
          encryptSecret("sk-legacy-openai"),
          1_000,
          1_000,
        );

      expect(insertResult.changes).toBe(1);

      const response = await request(app).put("/api/api-providers/provider-legacy-key").send({
        preset_key: "alibaba-coding-plan-openai",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("sk-sp-");

      const row = db
        .prepare("SELECT preset_key, type, base_url FROM api_providers WHERE id = ?")
        .get("provider-legacy-key") as {
        preset_key: string | null;
        type: string;
        base_url: string;
      };
      expect(row).toMatchObject({
        preset_key: null,
        type: "openai",
        base_url: "https://api.openai.com/v1",
      });
    } finally {
      db.close();
    }
  });

  it("prefers an explicitly entered replacement key over a retained incompatible key during preset switch", async () => {
    const { app, db } = await createHarness();

    try {
      const { encryptSecret } = await import("../../../oauth/helpers.ts");
      const insertResult = db
        .prepare(
          `
            INSERT INTO api_providers (id, name, type, base_url, api_key_enc, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
          `,
        )
        .run(
          "provider-explicit-key",
          "Legacy",
          "openai",
          "https://api.openai.com/v1",
          encryptSecret("sk-legacy-openai"),
          1_000,
          1_000,
        );

      expect(insertResult.changes).toBe(1);

      const response = await request(app).put("/api/api-providers/provider-explicit-key").send({
        preset_key: "alibaba-coding-plan-openai",
        api_key: "sk-sp-valid-replacement",
      });

      expect(response.status).toBe(200);

      const row = db
        .prepare("SELECT preset_key, type, base_url FROM api_providers WHERE id = ?")
        .get("provider-explicit-key") as {
        preset_key: string | null;
        type: string;
        base_url: string;
      };
      expect(row).toEqual({
        preset_key: "alibaba-coding-plan-openai",
        type: "openai",
        base_url: "https://coding-intl.dashscope.aliyuncs.com/v1",
      });
    } finally {
      db.close();
    }
  });

  it("replaces stale cached models when switching into a preset", async () => {
    const { app, db } = await createHarness();

    try {
      const insertResult = db
        .prepare(
          `
            INSERT INTO api_providers (
              id, name, type, base_url, enabled, models_cache, models_cached_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
          `,
        )
        .run(
          "provider-stale-cache",
          "Legacy",
          "openai",
          "https://api.openai.com/v1",
          JSON.stringify(["gpt-4.1", "claude-3-7-sonnet"]),
          999,
          1_000,
          1_000,
        );

      expect(insertResult.changes).toBe(1);

      const response = await request(app).put("/api/api-providers/provider-stale-cache").send({
        preset_key: "opencode-go-openai",
      });

      expect(response.status).toBe(200);

      const row = db
        .prepare("SELECT preset_key, type, base_url, models_cache, models_cached_at FROM api_providers WHERE id = ?")
        .get("provider-stale-cache") as {
        preset_key: string | null;
        type: string;
        base_url: string;
        models_cache: string | null;
        models_cached_at: number | null;
      };

      expect(row.preset_key).toBe("opencode-go-openai");
      expect(row.type).toBe("openai");
      expect(row.base_url).toBe("https://opencode.ai/zen/go/v1");
      expect(JSON.parse(String(row.models_cache))).toEqual(["glm-5", "kimi-k2.5"]);
      expect(row.models_cached_at).toBe(1_717_171_717_000);
    } finally {
      db.close();
    }
  });

  it("clears cached models when leaving preset mode", async () => {
    const { app, db } = await createHarness();

    try {
      const insertResult = db
        .prepare(
          `
            INSERT INTO api_providers (
              id, name, type, base_url, preset_key, enabled, models_cache, models_cached_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
          `,
        )
        .run(
          "provider-leave-preset",
          "Preset Provider",
          "openai",
          "https://opencode.ai/zen/go/v1",
          "opencode-go-openai",
          JSON.stringify(["glm-5", "kimi-k2.5"]),
          1_111,
          1_000,
          1_000,
        );

      expect(insertResult.changes).toBe(1);

      const response = await request(app).put("/api/api-providers/provider-leave-preset").send({
        preset_key: null,
        type: "custom",
        base_url: "https://custom.example/v1",
      });

      expect(response.status).toBe(200);

      const row = db
        .prepare("SELECT preset_key, type, base_url, models_cache, models_cached_at FROM api_providers WHERE id = ?")
        .get("provider-leave-preset") as {
        preset_key: string | null;
        type: string;
        base_url: string;
        models_cache: string | null;
        models_cached_at: number | null;
      };

      expect(row).toEqual({
        preset_key: null,
        type: "custom",
        base_url: "https://custom.example/v1",
        models_cache: null,
        models_cached_at: null,
      });
    } finally {
      db.close();
    }
  });

  it("merges fetched models with preset fallback models during test", async () => {
    const { app, db } = await createHarness();

    try {
      const createResponse = await request(app).post("/api/api-providers").send({
        name: "OpenCode Go",
        type: "openai",
        base_url: "https://ignored.example",
        preset_key: "opencode-go-openai",
      });

      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [{ id: "glm-5" }, { id: "deepseek-v3" }] }));
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const response = await request(app).post(`/api/api-providers/${createResponse.body.id}/test`).expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        model_count: 3,
        models: ["glm-5", "kimi-k2.5", "deepseek-v3"],
      });

      const row = db.prepare("SELECT models_cache FROM api_providers WHERE id = ?").get(createResponse.body.id) as {
        models_cache: string | null;
      };
      expect(JSON.parse(String(row.models_cache))).toEqual(["glm-5", "kimi-k2.5", "deepseek-v3"]);
    } finally {
      db.close();
    }
  });

  it("keeps seeded fallback cache when model refresh fails", async () => {
    const { app, db } = await createHarness();

    try {
      const createResponse = await request(app).post("/api/api-providers").send({
        name: "Bailian Coding Plan",
        type: "openai",
        base_url: "https://ignored.example",
        preset_key: "alibaba-coding-plan-openai",
      });

      const fetchMock = vi.fn().mockResolvedValueOnce(new Response("upstream failed", { status: 502 }));
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const response = await request(app)
        .get(`/api/api-providers/${createResponse.body.id}/models?refresh=true`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.cached).toBe(true);
      expect(response.body.stale).toBe(true);
      expect(response.body.models).toEqual([
        "qwen3.5-plus",
        "kimi-k2.5",
        "glm-5",
        "qwen3-max-2026-01-23",
        "qwen3-coder-next",
        "qwen3-coder-plus",
        "glm-4.7",
      ]);
    } finally {
      db.close();
    }
  });
});
