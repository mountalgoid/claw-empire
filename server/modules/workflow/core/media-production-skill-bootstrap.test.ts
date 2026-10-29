import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureMediaProductionSkills } from "./media-production-skill-bootstrap.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function createDb() {
  const rows = new Set<string>();
  return {
    prepare(sql: string) {
      return {
        get: (_provider: string, _repo: string, skillId: string) =>
          sql.startsWith("SELECT") && rows.has(skillId) ? { ok: 1 } : undefined,
        run: (...args: unknown[]) => {
          const skillId = String(args[4] ?? "");
          rows.add(skillId);
        },
      };
    },
  };
}

describe("media production skill bootstrap", () => {
  it("installs video and voice skills only for a matching media task", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "claw-media-skills-"));
    const logsDir = path.join(baseDir, "logs");
    fs.mkdirSync(logsDir);
    tempDirs.push(baseDir);
    const logs: string[] = [];
    const installed = ensureMediaProductionSkills({
      db: createDb(),
      logsDir,
      provider: "codex",
      taskText: "Buat video reel dengan voice over bahasa Indonesia, tone profesional dan transisi film.",
      taskId: "task-1",
      appendTaskLog: (_id, _kind, message) => logs.push(message),
    });

    expect(installed).toEqual(["video-editing-pro", "voice-production-pro"]);
    expect(fs.existsSync(path.join(logsDir, "..", "custom-skills", "video-editing-pro", "skills.md"))).toBe(true);
    expect(fs.existsSync(path.join(logsDir, "..", "custom-skills", "voice-production-pro", "skills.md"))).toBe(true);
    expect(logs[0]).toContain("codex");
  });

  it("does not install media skills for an unrelated task", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "claw-media-skills-"));
    const logsDir = path.join(baseDir, "logs");
    fs.mkdirSync(logsDir);
    tempDirs.push(baseDir);
    expect(
      ensureMediaProductionSkills({ db: createDb(), logsDir, provider: "codex", taskText: "Buat laporan stok toko." }),
    ).toEqual([]);
  });
});
