import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { registerModelRoutes } from "./models-routes.ts";

const discovered = [
  "opencode/minimax-m2.5-free",
  "opencode/minimax-m3",
  "opencode/minimax-m3.1-flash-free",
  "minimax/MiniMax-M2.7",
  "minimax/MiniMax-M3",
  "minimax/MiniMax-M3.1-Flash",
  "openrouter/minimax/minimax-m3.1-flash:free",
  "openrouter/minimax/minimax-m2.5",
  "custom/model-id",
  "minimax/speech-02-hd",
  "minimax/image-01",
];
const expected = [
  "opencode/minimax-m3.1-flash-free",
  "minimax/MiniMax-M3.1-Flash",
  "openrouter/minimax/minimax-m3.1-flash:free",
  "opencode/minimax-m3",
  "minimax/MiniMax-M3",
  "custom/model-id",
  "minimax/speech-02-hd",
  "minimax/image-01",
];

function harness(cache?: Record<string, unknown>) {
  const app = express();
  const execWithTimeout = vi.fn().mockResolvedValue(discovered.join("\n"));
  const run = vi.fn();
  const ctx = {
    app,
    db: {
      prepare: () => ({
        get: (key: string) => (cache?.[key] ? { value: JSON.stringify(cache[key]) } : undefined),
        run,
      }),
    },
    execWithTimeout,
    getPreferredOAuthAccounts: () => [],
  } as unknown as RuntimeContext;
  registerModelRoutes(ctx);
  return { app, execWithTimeout, run };
}

describe("MiniMax discovery choices", () => {
  it("filters fresh CLI discovery and subsequent memory cache without rewriting custom or nontext IDs", async () => {
    const { app, execWithTimeout } = harness();
    for (let i = 0; i < 2; i++) {
      const result = await request(app).get("/api/cli-models").expect(200);
      expect(result.body.models.opencode.map((model: { slug: string }) => model.slug)).toEqual(expected);
    }
    expect(execWithTimeout).toHaveBeenCalledTimes(1);
  });

  it("filters persisted CLI choices without overwriting the stored history", async () => {
    const models = discovered.map((slug) => ({ slug, displayName: slug, description: "retained metadata" }));
    const { app, execWithTimeout, run } = harness({ cli_models_cache: { opencode: models } });
    const result = await request(app).get("/api/cli-models").expect(200);
    expect(result.body.models.opencode.map((model: { slug: string }) => model.slug)).toEqual(expected);
    expect(result.body.models.opencode[0].description).toBe("retained metadata");
    expect(execWithTimeout).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("filters fresh, memory and persisted OAuth discovery", async () => {
    const { app } = harness();
    for (let i = 0; i < 2; i++) {
      const result = await request(app).get("/api/oauth/models").expect(200);
      expect(result.body.models.opencode).toEqual(expected);
    }
    const cached = harness({ oauth_models_cache: { opencode: discovered } });
    const result = await request(cached.app).get("/api/oauth/models").expect(200);
    expect(result.body.models.opencode).toEqual(expected);
    expect(cached.run).not.toHaveBeenCalled();
  });
});
