import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { createWorktreeLifecycleTools } from "../../workflow/core/worktree/lifecycle.ts";
import { registerWorktreeAndUsageRoutes } from "./worktrees-and-usage.ts";

type RouteHandler = (req: any, res: any) => any;

type FakeResponse = {
  statusCode: number;
  payload: unknown;
  status: (code: number) => FakeResponse;
  json: (body: unknown) => FakeResponse;
};

function createFakeResponse(): FakeResponse {
  return {
    statusCode: 200,
    payload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      return this;
    },
  };
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, stdio: "pipe", timeout: 15000 }).toString().trim();
}

function initRepo(basePrefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), basePrefix));
  try {
    runGit(dir, ["init", "-b", "main"]);
  } catch {
    runGit(dir, ["init"]);
    runGit(dir, ["checkout", "-B", "main"]);
  }
  runGit(dir, ["config", "user.name", "Claw-Empire Test"]);
  runGit(dir, ["config", "user.email", "claw-empire-test@example.local"]);
  fs.writeFileSync(path.join(dir, "README.md"), "seed\n", "utf8");
  runGit(dir, ["add", "."]);
  runGit(dir, ["commit", "-m", "seed"]);
  return dir;
}

function createHarness(taskWorktrees: Map<string, { worktreePath: string; branchName: string; projectPath: string }>) {
  const appendLogCalls: Array<{ taskId: string | null; kind: string; message: string }> = [];
  const getRoutes = new Map<string, RouteHandler>();
  const postRoutes = new Map<string, RouteHandler>();
  const app = {
    get(path: string, handler: RouteHandler) {
      getRoutes.set(path, handler);
      return this;
    },
    post(path: string, handler: RouteHandler) {
      postRoutes.set(path, handler);
      return this;
    },
  };

  const db = new DatabaseSync(":memory:");
  registerWorktreeAndUsageRoutes({
    app: app as any,
    taskWorktrees,
    mergeWorktree: () => ({ success: true, message: "merged", conflicts: [] }),
    cleanupWorktree: () => {},
    appendTaskLog: (taskId: string | null, kind: string, message: string) => {
      appendLogCalls.push({ taskId, kind, message });
    },
    resolveLang: () => "en",
    pickL: (value: string) => value,
    l: (_ko: string[], en: string[]) => en.join(""),
    notifyCeo: () => {},
    db: db as any,
    nowMs: () => Date.now(),
    CLI_TOOLS: [],
    fetchClaudeUsage: async () => ({ windows: [], error: "not_implemented" }),
    fetchCodexUsage: async () => ({ windows: [], error: "not_implemented" }),
    fetchGeminiUsage: async () => ({ windows: [], error: "not_implemented" }),
    broadcast: () => {},
  } as any);

  return { db, getRoutes, postRoutes, appendLogCalls };
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("task media artifacts route", () => {
  it("lists only supported media files inside task output directories", () => {
    const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), "climpire-artifacts-"));
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "climpire-artifacts-project-"));
    tempDirs.push(worktreePath, projectPath);
    fs.mkdirSync(path.join(worktreePath, "content", "week-01"), { recursive: true });
    fs.mkdirSync(path.join(projectPath, "content", "week-01"), { recursive: true });
    fs.writeFileSync(path.join(worktreePath, "content", "week-01", "post.png"), "png-data");
    fs.writeFileSync(path.join(worktreePath, "content", "week-01", "reel.mp4"), "video-data");
    fs.writeFileSync(path.join(worktreePath, "content", "week-01", "notes.txt"), "not media");
    fs.writeFileSync(path.join(projectPath, "content", "week-01", "project-post.png"), "project-png");
    const outsideFile = path.join(os.tmpdir(), `climpire-secret-${Date.now()}.png`);
    fs.writeFileSync(outsideFile, "outside");
    fs.symlinkSync(outsideFile, path.join(worktreePath, "content", "week-01", "linked.png"));
    tempDirs.push(outsideFile);

    const taskId = "artifact-task-0000-0000-000000000000";
    const worktrees = new Map([[taskId, { worktreePath, branchName: "test", projectPath }]]);
    const { db, getRoutes } = createHarness(worktrees);
    try {
      db.exec("CREATE TABLE tasks (id TEXT PRIMARY KEY, project_path TEXT)");
      db.prepare("INSERT INTO tasks (id, project_path) VALUES (?, ?)").run(taskId, projectPath);
      const handler = getRoutes.get("/api/tasks/:id/artifacts");
      expect(handler).toBeTypeOf("function");
      const res = createFakeResponse();
      handler?.({ params: { id: taskId } }, res);
      expect(res.statusCode).toBe(200);
      const payload = res.payload as { ok: boolean; assets: Array<{ path: string; kind: string; mime: string; url: string }> };
      expect(payload.ok).toBe(true);
      expect(payload.assets).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "content/week-01/post.png", kind: "image", mime: "image/png" }),
        expect.objectContaining({ path: "content/week-01/reel.mp4", kind: "video", mime: "video/mp4" }),
        expect.objectContaining({ path: "content/week-01/notes.txt", kind: "file", mime: "text/plain" }),
        expect.objectContaining({
          path: "content/week-01/project-post.png",
          kind: "image",
          mime: "image/png",
          url: expect.stringContaining("?source=project"),
        }),
      ]));
      expect(JSON.stringify(res.payload)).not.toContain("linked.png");
    } finally {
      db.close();
    }
  });

  it("moves and deletes only listed assets while rejecting paths outside output roots", () => {
    const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), "climpire-artifact-manage-"));
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "climpire-artifact-manage-project-"));
    tempDirs.push(worktreePath, projectPath);
    fs.mkdirSync(path.join(worktreePath, "content", "week-01"), { recursive: true });
    fs.writeFileSync(path.join(worktreePath, "content", "week-01", "post.png"), "png-data");
    const taskId = "artifact-manage-task-0000-0000-000000000000";
    const { db, postRoutes } = createHarness(new Map([[taskId, { worktreePath, branchName: "test", projectPath }]]));
    try {
      db.exec("CREATE TABLE tasks (id TEXT PRIMARY KEY, project_path TEXT)");
      db.prepare("INSERT INTO tasks (id, project_path) VALUES (?, ?)").run(taskId, projectPath);
      const handler = postRoutes.get("/api/tasks/:id/artifacts/manage");
      expect(handler).toBeTypeOf("function");

      const moveResponse = createFakeResponse();
      handler?.({ params: { id: taskId }, body: { operation: "move", source: "task", path: "content/week-01/post.png", destination: "content/week-02/final.png" } }, moveResponse);
      expect(moveResponse.statusCode).toBe(200);
      expect(fs.existsSync(path.join(worktreePath, "content", "week-02", "final.png"))).toBe(true);

      const unsafeResponse = createFakeResponse();
      handler?.({ params: { id: taskId }, body: { operation: "delete", source: "task", path: "../../README.md" } }, unsafeResponse);
      expect(unsafeResponse.statusCode).toBe(400);

      const deleteResponse = createFakeResponse();
      handler?.({ params: { id: taskId }, body: { operation: "delete", source: "task", path: "content/week-02/final.png" } }, deleteResponse);
      expect(deleteResponse.statusCode).toBe(200);
      expect(fs.existsSync(path.join(worktreePath, "content", "week-02", "final.png"))).toBe(false);
    } finally {
      db.close();
    }
  });
});

describe("worktree verify-commit route", () => {
  it("worktree가 없으면 no_worktree 판정을 돌려준다", () => {
    const { db, getRoutes } = createHarness(new Map());
    try {
      const handler = getRoutes.get("/api/tasks/:id/verify-commit");
      expect(handler).toBeTypeOf("function");

      const res = createFakeResponse();
      handler?.({ params: { id: "task-1" } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload).toMatchObject({
        ok: true,
        hasWorktree: false,
        hasCommit: false,
        verdict: "no_worktree",
      });
    } finally {
      db.close();
    }
  });

  it("커밋 없이 변경만 있으면 dirty_without_commit 판정을 돌려준다", () => {
    const repo = initRepo("climpire-verify-dirty-");
    tempDirs.push(repo);
    const taskId = "verify-dirty-0000-0000-0000-000000000000";
    const taskWorktrees = new Map<string, { worktreePath: string; branchName: string; projectPath: string }>();
    const tools = createWorktreeLifecycleTools({ appendTaskLog: () => {}, taskWorktrees });
    const worktreePath = tools.createWorktree(repo, taskId, "Tester");
    expect(worktreePath).toBeTruthy();

    fs.writeFileSync(path.join(String(worktreePath), "src-dirty.ts"), "export const dirty = true;\n", "utf8");

    const { db, getRoutes } = createHarness(taskWorktrees);
    try {
      const handler = getRoutes.get("/api/tasks/:id/verify-commit");
      expect(handler).toBeTypeOf("function");

      const res = createFakeResponse();
      handler?.({ params: { id: taskId } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload).toMatchObject({
        ok: true,
        hasWorktree: true,
        hasCommit: false,
        hasUncommittedChanges: true,
        verdict: "dirty_without_commit",
      });
    } finally {
      db.close();
      tools.cleanupWorktree(repo, taskId);
    }
  });

  it("커밋된 코드 변경이 있으면 ok 판정을 돌려준다", () => {
    const repo = initRepo("climpire-verify-ok-");
    tempDirs.push(repo);
    const taskId = "verify-okay-0000-0000-0000-000000000000";
    const taskWorktrees = new Map<string, { worktreePath: string; branchName: string; projectPath: string }>();
    const tools = createWorktreeLifecycleTools({ appendTaskLog: () => {}, taskWorktrees });
    const worktreePath = tools.createWorktree(repo, taskId, "Tester");
    expect(worktreePath).toBeTruthy();

    const worktreeDir = String(worktreePath);
    fs.mkdirSync(path.join(worktreeDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(worktreeDir, "src", "verify.ts"), "export const verified = true;\n", "utf8");
    runGit(worktreeDir, ["add", "."]);
    runGit(worktreeDir, ["commit", "-m", "feat: add verify file"]);

    const { db, getRoutes } = createHarness(taskWorktrees);
    try {
      const handler = getRoutes.get("/api/tasks/:id/verify-commit");
      expect(handler).toBeTypeOf("function");

      const res = createFakeResponse();
      handler?.({ params: { id: taskId } }, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload).toMatchObject({
        ok: true,
        hasWorktree: true,
        hasCommit: true,
        verdict: "ok",
      });
      expect(res.payload).toMatchObject({
        files: ["src/verify.ts"],
      });
    } finally {
      db.close();
      tools.cleanupWorktree(repo, taskId);
    }
  });

  it("수동 merge 전에 최종 브랜치 검증 통과 로그를 남긴다", () => {
    const repo = initRepo("climpire-verify-merge-");
    tempDirs.push(repo);
    const taskId = "verify-merge-0000-0000-0000-000000000000";
    const taskWorktrees = new Map<string, { worktreePath: string; branchName: string; projectPath: string }>();
    const tools = createWorktreeLifecycleTools({ appendTaskLog: () => {}, taskWorktrees });
    const worktreePath = tools.createWorktree(repo, taskId, "Tester");
    expect(worktreePath).toBeTruthy();

    const worktreeDir = String(worktreePath);
    fs.mkdirSync(path.join(worktreeDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(worktreeDir, "src", "verify.ts"), "export const verified = true;\n", "utf8");
    runGit(worktreeDir, ["add", "."]);
    runGit(worktreeDir, ["commit", "-m", "feat: ready for merge"]);

    const { db, postRoutes, appendLogCalls } = createHarness(taskWorktrees);
    try {
      const handler = postRoutes.get("/api/tasks/:id/merge");
      expect(handler).toBeTypeOf("function");

      const res = createFakeResponse();
      handler?.({ params: { id: taskId } }, res);

      expect(res.statusCode).toBe(200);
      expect(appendLogCalls.some((entry) => entry.message.includes("Final branch verification: passed"))).toBe(true);
    } finally {
      db.close();
      tools.cleanupWorktree(repo, taskId);
    }
  });
});
