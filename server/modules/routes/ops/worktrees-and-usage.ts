import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import type { CliUsageEntry } from "../shared/types.ts";
import { createProjectGovernanceTools } from "../../workflow/core/project-governance-tools.ts";

function readGitLines(cwd: string, args: string[], timeout = 8000): string[] {
  const output = execFileSync("git", args, { cwd, stdio: "pipe", timeout }).toString().trim();
  return output
    ? output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
}

function tryReadGitLines(cwd: string, args: string[], timeout = 8000): string[] {
  try {
    return readGitLines(cwd, args, timeout);
  } catch {
    return [];
  }
}

function refExists(cwd: string, ref: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", ref], { cwd, stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function resolveCompareRef(projectPath: string, worktreePath: string): string | null {
  const preferredCandidates: string[] = [];

  try {
    const currentBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: projectPath,
      stdio: "pipe",
      timeout: 5000,
    })
      .toString()
      .trim();
    if (currentBranch && currentBranch !== "HEAD") {
      preferredCandidates.push(`origin/${currentBranch}`, currentBranch);
    }
  } catch {
    // ignore and fall back to generic candidates
  }

  preferredCandidates.push("origin/main", "main", "origin/master", "master");

  for (const candidate of preferredCandidates) {
    if (refExists(worktreePath, candidate)) return candidate;
  }
  return null;
}

function parsePorcelainPath(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const pathPart = trimmed.slice(3).trim();
  if (!pathPart) return null;
  const renamed = pathPart.split(" -> ").pop()?.trim();
  return renamed || pathPart;
}

function isCodeLikePath(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|html|css|scss|py|md|yml|yaml|sh|ps1|sql)$/i.test(filePath);
}

function isIgnoredWorktreeArtifact(filePath: string): boolean {
  return filePath === ".claude/skills" || filePath.startsWith(".claude/skills/");
}

type VerifyCommitState = {
  ok: true;
  hasWorktree: boolean;
  worktreePath: string | null;
  branchName?: string;
  compareRef: string | null;
  hasCommit: boolean;
  commitCount: number;
  commits: string[];
  files: string[];
  uncommittedFiles: string[];
  hasUncommittedChanges: boolean;
  hasRealCode: boolean;
  verdict: "no_worktree" | "no_commit" | "dirty_without_commit" | "commit_but_no_code" | "ok";
};

function inspectWorktreeVerification(wtInfo?: {
  worktreePath: string;
  branchName: string;
  projectPath: string;
}): VerifyCommitState {
  const worktreePath = wtInfo?.worktreePath ?? null;
  if (!wtInfo || !worktreePath) {
    return {
      ok: true,
      hasWorktree: false,
      worktreePath: null,
      compareRef: null,
      hasCommit: false,
      commitCount: 0,
      commits: [],
      files: [],
      uncommittedFiles: [],
      hasUncommittedChanges: false,
      hasRealCode: false,
      verdict: "no_worktree",
    };
  }

  const compareRef = resolveCompareRef(wtInfo.projectPath, worktreePath);
  const commits = compareRef ? readGitLines(worktreePath, ["log", `${compareRef}..HEAD`, "--oneline"]) : [];
  const changedFiles = (
    compareRef ? tryReadGitLines(worktreePath, ["diff", `${compareRef}..HEAD`, "--name-only"]) : []
  ).filter((filePath) => !isIgnoredWorktreeArtifact(filePath));
  const uncommittedFiles = tryReadGitLines(worktreePath, ["status", "--porcelain"])
    .map(parsePorcelainPath)
    .filter((value): value is string => Boolean(value))
    .filter((filePath) => !isIgnoredWorktreeArtifact(filePath));
  const hasRealCode = changedFiles.some(isCodeLikePath);
  const hasUncommittedChanges = uncommittedFiles.length > 0;

  const verdict =
    commits.length === 0
      ? hasUncommittedChanges
        ? "dirty_without_commit"
        : "no_commit"
      : hasRealCode
        ? "ok"
        : "commit_but_no_code";

  return {
    ok: true,
    hasWorktree: true,
    worktreePath,
    branchName: wtInfo.branchName,
    compareRef,
    hasCommit: commits.length > 0,
    commitCount: commits.length,
    commits,
    files: changedFiles,
    uncommittedFiles,
    hasUncommittedChanges,
    hasRealCode,
    verdict,
  };
}

export function registerWorktreeAndUsageRoutes(ctx: RuntimeContext): {
  refreshCliUsageData: () => Promise<Record<string, CliUsageEntry>>;
} {
  const {
    app,
    taskWorktrees,
    mergeWorktree,
    cleanupWorktree,
    appendTaskLog,
    resolveLang,
    pickL,
    l,
    notifyCeo,
    db,
    nowMs,
    CLI_TOOLS,
    fetchClaudeUsage,
    fetchCodexUsage,
    fetchGeminiUsage,
    broadcast,
  } = ctx;
  const { getProjectHealth } = createProjectGovernanceTools({ db: db as any, nowMs });

  function resolvePreviewRoot(taskId: string, projectPath: string | null): string | null {
    const active = taskWorktrees.get(taskId)?.worktreePath;
    const candidates = [
      active,
      projectPath ? path.join(projectPath, ".climpire-worktrees", taskId.slice(0, 8)) : null,
      projectPath ? path.join(projectPath, ".climpire-worktrees", `${taskId.slice(0, 8)}-1`) : null,
      projectPath,
    ].filter((candidate): candidate is string => Boolean(candidate));
    for (const candidate of candidates) {
      try {
        if (fs.statSync(candidate).isDirectory()) return path.resolve(candidate);
      } catch {
        // Try the next safe candidate.
      }
    }
    return null;
  }

  function listTaskMediaAssets(taskId: string, roots: Array<{ path: string; source: "task" | "project" }>) {
    const allowedRoots = ["content", "output", "video_output", "public", "dist", "assets"];
    const mimeByExt: Record<string, { kind: "image" | "video"; mime: string }> = {
      ".png": { kind: "image", mime: "image/png" },
      ".jpg": { kind: "image", mime: "image/jpeg" },
      ".jpeg": { kind: "image", mime: "image/jpeg" },
      ".webp": { kind: "image", mime: "image/webp" },
      ".avif": { kind: "image", mime: "image/avif" },
      ".gif": { kind: "image", mime: "image/gif" },
      ".mp4": { kind: "video", mime: "video/mp4" },
      ".webm": { kind: "video", mime: "video/webm" },
      ".mov": { kind: "video", mime: "video/quicktime" },
    };
    const fileMimeByExt: Record<string, string> = {
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".csv": "text/csv",
      ".json": "application/json",
      ".pdf": "application/pdf",
      ".zip": "application/zip",
      ".py": "text/x-python",
      ".html": "text/html",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
    const assetsByPath = new Map<
      string,
      {
        name: string;
        path: string;
        source: "task" | "project";
        kind: "image" | "video" | "file";
        mime: string;
        size_bytes: number;
        url: string;
      }
    >();
    const visit = (
      root: string,
      source: "task" | "project",
      directory: string,
      relativeDirectory: string,
      depth: number,
    ): void => {
      if (depth > 6 || assetsByPath.size >= 100) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (assetsByPath.size >= 100 || entry.name.startsWith(".")) continue;
        const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(root, source, absolute, relative, depth + 1);
          continue;
        }
        if (!entry.isFile()) continue;
        const extension = path.extname(entry.name).toLowerCase();
        const media = mimeByExt[extension];
        const fileMime = fileMimeByExt[extension];
        if (!media && !fileMime) continue;
        try {
          const stat = fs.lstatSync(absolute);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) continue;
          const encodedPath = relative.split("/").map(encodeURIComponent).join("/");
          const sourceQuery = source === "project" ? "?source=project" : "";
          const assetKey = `${source}:${relative}`;
          if (!assetsByPath.has(assetKey))
            assetsByPath.set(assetKey, {
              name: entry.name,
              path: relative,
              source,
              kind: media?.kind ?? "file",
              mime: media?.mime ?? fileMime!,
              size_bytes: stat.size,
              url: `/api/tasks/${encodeURIComponent(taskId)}/preview/${encodedPath}${sourceQuery}`,
            });
        } catch {
          // Files may disappear while a task is finishing; omit them safely.
        }
      }
    };

    const uniqueRoots = roots.filter(
      (item, index, all) =>
        all.findIndex((candidate) => path.resolve(candidate.path) === path.resolve(item.path)) === index,
    );
    for (const { path: root, source } of uniqueRoots) {
      for (const directoryName of allowedRoots) {
        if (assetsByPath.size >= 100) break;
        const directory = path.resolve(root, directoryName);
        if (!directory.startsWith(`${root}${path.sep}`)) continue;
        try {
          const stat = fs.lstatSync(directory);
          if (stat.isDirectory() && !stat.isSymbolicLink()) {
            visit(root, source, directory, directoryName, 0);
          }
        } catch {
          // An output directory is optional.
        }
      }
    }
    return [...assetsByPath.values()].sort((a, b) => a.path.localeCompare(b.path) || a.source.localeCompare(b.source));
  }

  app.get("/api/tasks/:id/artifacts", (req, res) => {
    const taskId = String(req.params.id ?? "").trim();
    const task = db.prepare("SELECT id, project_path FROM tasks WHERE id = ?").get(taskId) as
      | { id: string; project_path: string | null }
      | undefined;
    if (!task) return res.status(404).json({ ok: false, error: "task_not_found" });
    const taskRoot = resolvePreviewRoot(taskId, task.project_path);
    const roots: Array<{ path: string; source: "task" | "project" }> = [];
    if (taskRoot) roots.push({ path: taskRoot, source: "task" });
    if (task.project_path) roots.push({ path: path.resolve(task.project_path), source: "project" });
    if (roots.length === 0) return res.status(200).json({ ok: true, assets: [] });
    return res.json({ ok: true, assets: listTaskMediaAssets(taskId, roots) });
  });

  app.post("/api/tasks/:id/artifacts/manage", (req, res) => {
    const taskId = String(req.params.id ?? "").trim();
    const task = db.prepare("SELECT id, project_path FROM tasks WHERE id = ?").get(taskId) as
      | { id: string; project_path: string | null }
      | undefined;
    if (!task) return res.status(404).json({ ok: false, error: "task_not_found" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const operation = body.operation;
    const source = body.source;
    const assetPath = body.path;
    const destination = body.destination;
    if (!["rename", "move", "delete"].includes(String(operation)) || !["task", "project"].includes(String(source))) {
      return res.status(400).json({ ok: false, error: "invalid_asset_operation" });
    }
    if (
      typeof assetPath !== "string" ||
      assetPath.length > 1024 ||
      assetPath.includes("\\") ||
      assetPath.startsWith("/")
    ) {
      return res.status(400).json({ ok: false, error: "invalid_asset_path" });
    }
    if (
      operation !== "delete" &&
      (typeof destination !== "string" ||
        destination.length > 1024 ||
        destination.includes("\\") ||
        destination.startsWith("/"))
    ) {
      return res.status(400).json({ ok: false, error: "invalid_asset_destination" });
    }

    const taskRoot = resolvePreviewRoot(taskId, task.project_path);
    const root = source === "project" ? (task.project_path ? path.resolve(task.project_path) : null) : taskRoot;
    if (!root) return res.status(404).json({ ok: false, error: "asset_root_not_found" });
    let realRoot: string;
    try {
      realRoot = fs.realpathSync(root);
      if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw new Error("unsafe root");
    } catch {
      return res.status(400).json({ ok: false, error: "unsafe_asset_root" });
    }

    const allowedRoots = new Set(["content", "output", "video_output", "public", "dist", "assets"]);
    const parseRelative = (value: string): string[] | null => {
      const segments = value.split("/");
      if (
        segments.length < 2 ||
        segments.some((part) => !part || part === "." || part === ".." || part.startsWith("."))
      )
        return null;
      if (!allowedRoots.has(segments[0])) return null;
      return segments;
    };
    const sourceSegments = parseRelative(assetPath);
    const destinationSegments = operation === "delete" ? null : parseRelative(destination as string);
    if (!sourceSegments || (operation !== "delete" && !destinationSegments)) {
      return res.status(400).json({ ok: false, error: "asset_path_outside_output" });
    }

    const roots = [
      ...(taskRoot ? [{ path: taskRoot, source: "task" as const }] : []),
      ...(task.project_path ? [{ path: path.resolve(task.project_path), source: "project" as const }] : []),
    ];
    const listedAsset = listTaskMediaAssets(taskId, roots).find(
      (asset) => asset.source === source && asset.path === assetPath,
    );
    if (!listedAsset) return res.status(404).json({ ok: false, error: "asset_not_found_or_unsupported" });

    const resolveSafe = (segments: string[], createParents: boolean): string | null => {
      let current = realRoot;
      for (let index = 0; index < segments.length; index += 1) {
        current = path.join(current, segments[index]);
        if (!current.startsWith(`${realRoot}${path.sep}`)) return null;
        const isFinal = index === segments.length - 1;
        try {
          const stat = fs.lstatSync(current);
          if (stat.isSymbolicLink() || (isFinal ? !stat.isFile() : !stat.isDirectory())) return null;
        } catch {
          if (!createParents || isFinal) return null;
          try {
            fs.mkdirSync(current);
          } catch {
            return null;
          }
        }
      }
      return current;
    };

    const sourcePath = resolveSafe(sourceSegments, false);
    if (!sourcePath) return res.status(400).json({ ok: false, error: "unsafe_asset_path" });
    if (operation === "delete") {
      try {
        fs.unlinkSync(sourcePath);
        try {
          appendTaskLog(taskId, "system", `CEO deleted ${source} asset: ${assetPath}`);
        } catch (error) {
          console.warn("Failed to audit asset deletion", error);
        }
        return res.json({ ok: true, operation, path: assetPath });
      } catch {
        return res.status(500).json({ ok: false, error: "asset_delete_failed" });
      }
    }

    const targetSegments = destinationSegments as string[];
    if (path.extname(targetSegments.at(-1) ?? "").toLowerCase() !== path.extname(assetPath).toLowerCase()) {
      return res.status(400).json({ ok: false, error: "asset_extension_must_not_change" });
    }
    const targetPath = path.resolve(realRoot, ...targetSegments);
    if (!targetPath.startsWith(`${realRoot}${path.sep}`))
      return res.status(400).json({ ok: false, error: "unsafe_asset_destination" });
    if (fs.existsSync(targetPath)) return res.status(409).json({ ok: false, error: "asset_destination_exists" });
    const parentSegments = targetSegments.slice(0, -1);
    let parentPath = realRoot;
    for (const segment of parentSegments) {
      parentPath = path.join(parentPath, segment);
      try {
        const stat = fs.lstatSync(parentPath);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          return res.status(400).json({ ok: false, error: "unsafe_asset_destination" });
      } catch {
        try {
          fs.mkdirSync(parentPath);
        } catch {
          return res.status(400).json({ ok: false, error: "unsafe_asset_destination" });
        }
      }
    }
    try {
      fs.renameSync(sourcePath, targetPath);
      try {
        appendTaskLog(taskId, "system", `CEO ${operation}d ${source} asset: ${assetPath} -> ${destination}`);
      } catch (error) {
        console.warn("Failed to audit asset update", error);
      }
      return res.json({ ok: true, operation, path: assetPath, destination });
    } catch {
      return res.status(500).json({ ok: false, error: "asset_update_failed" });
    }
  });

  function sendProjectPreview(req: any, res: any): void {
    const taskId = String(req.params.id ?? "").trim();
    const task = db.prepare("SELECT id, project_path, status FROM tasks WHERE id = ?").get(taskId) as
      | { id: string; project_path: string | null; status: string }
      | undefined;
    if (!task) return res.status(404).json({ error: "task_not_found" });
    const root =
      req.query?.source === "project" && task.project_path
        ? path.resolve(task.project_path)
        : resolvePreviewRoot(taskId, task.project_path);
    if (!root) return res.status(404).json({ error: "preview_not_available" });
    const requested = typeof req.params[0] === "string" ? req.params[0] : "index.html";
    const relative = requested.trim() || "index.html";
    if (relative.includes("\\") || relative.split("/").includes("..") || relative.startsWith(".")) {
      return res.status(400).json({ error: "invalid_preview_path" });
    }
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      return res.status(400).json({ error: "invalid_preview_path" });
    }

    const sendArtifactFallback = (): void => {
      const assets = listTaskMediaAssets(taskId, [{ path: root, source: "task" }]);
      const escapeHtml = (value: string): string =>
        value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
      const cards = assets
        .map((asset) => {
          const url = escapeHtml(asset.url);
          const name = escapeHtml(asset.name);
          const preview =
            asset.kind === "image"
              ? `<img src="${url}" alt="${name}">`
              : asset.kind === "video"
                ? `<video src="${url}" controls playsinline preload="metadata"></video>`
                : `<p>File tersedia untuk diunduh.</p>`;
          return `<article>${preview}<div><strong>${name}</strong><small>${escapeHtml(asset.path)}</small><a href="${url}" download="${name}">Unduh</a></div></article>`;
        })
        .join("");
      const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hasil tugas</title><style>body{margin:0;padding:20px;background:#0b1220;color:#e2e8f0;font:15px system-ui,sans-serif}main{max-width:1100px;margin:auto}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px}article{overflow:hidden;border:1px solid #334155;border-radius:14px;background:#111c2d}img,video{display:block;width:100%;max-height:70vh;object-fit:contain;background:#020617}article div{display:grid;gap:6px;padding:12px}small{color:#94a3b8;overflow-wrap:anywhere}a{color:#93c5fd}</style></head><body><main><h1>Hasil tugas</h1>${cards ? `<section>${cards}</section>` : "<p>Belum ada aset hasil yang dapat dipratinjau.</p>"}</main></body></html>`;
      res.type("html").send(html);
    };

    try {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink()) return res.status(404).json({ error: "preview_file_not_found" });
    } catch {
      if (relative.toLowerCase() === "index.html") return sendArtifactFallback();
      return res.status(404).json({ error: "preview_file_not_found" });
    }
    try {
      return res.type(path.extname(target) || "text/plain").send(fs.readFileSync(target));
    } catch {
      return res.status(404).json({ error: "preview_file_not_found" });
    }
  }

  function sendProjectPreviewForProject(req: any, res: any): void {
    const projectId = String(req.params.id ?? "").trim();
    const task = db
      .prepare(
        `SELECT id, project_path, status FROM tasks
       WHERE project_id = ? AND status IN ('done', 'review')
       ORDER BY CASE status WHEN 'done' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`,
      )
      .get(projectId) as { id: string; project_path: string | null; status: string } | undefined;
    if (!task) return res.status(404).json({ error: "preview_not_available" });
    return sendProjectPreview({ ...req, params: { ...req.params, id: task.id, 0: "index.html" } }, res);
  }

  function sendProjectPreviewAssetForProject(req: any, res: any): void {
    const projectId = String(req.params.id ?? req.params[0] ?? "").trim();
    const task = db
      .prepare(
        `SELECT id FROM tasks WHERE project_id = ? AND status IN ('done', 'review')
       ORDER BY CASE status WHEN 'done' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`,
      )
      .get(projectId) as { id: string } | undefined;
    if (!task) return res.status(404).json({ error: "preview_not_available" });
    const match = req.path.match(/^\/api\/projects\/[^/]+\/preview\/(.+)$/);
    return sendProjectPreview({ ...req, params: { id: task.id, 0: match?.[1] ?? "" } }, res);
  }

  app.get("/api/tasks/:id/preview", (req, res) =>
    sendProjectPreview({ ...req, params: { ...req.params, 0: "index.html" } }, res),
  );
  app.get("/api/tasks/:id/preview/index.html", (req, res) =>
    sendProjectPreview({ ...req, params: { ...req.params, 0: "index.html" } }, res),
  );
  app.get("/api/projects/:id/preview", sendProjectPreviewForProject);
  app.get("/api/projects/:id/preview/index.html", sendProjectPreviewForProject);
  app.get(/^\/api\/projects\/([^/]+)\/preview\/(.+)$/, sendProjectPreviewAssetForProject);
  app.get(/^\/api\/tasks\/([^/]+)\/preview\/(.+)$/, (req, res) => {
    const match = req.path.match(/^\/api\/tasks\/([^/]+)\/preview\/(.+)$/);
    return sendProjectPreview({ ...req, params: { id: match?.[1] ?? "", 0: match?.[2] ?? "" } }, res);
  });

  app.get("/api/projects/:id/health", (req, res) => {
    const projectId = String(req.params.id ?? "").trim();
    if (!projectId) return res.status(400).json({ error: "project_id_required" });
    const project = db.prepare("SELECT id, name, project_path, core_goal FROM projects WHERE id = ?").get(projectId);
    if (!project) return res.status(404).json({ error: "project_not_found" });
    res.json({ ok: true, project, health: getProjectHealth(projectId) });
  });

  app.get("/api/projects/:id/checkpoints", (req, res) => {
    const projectId = String(req.params.id ?? "").trim();
    if (!projectId) return res.status(400).json({ error: "project_id_required" });
    const rows = db
      .prepare(
        `SELECT id, task_id, branch_name, commit_sha, status, evidence_json, created_at
         FROM project_checkpoints WHERE project_id = ? ORDER BY created_at DESC LIMIT 50`,
      )
      .all(projectId);
    res.json({ ok: true, checkpoints: rows });
  });

  app.get("/api/tasks/:id/diff", (req, res) => {
    const id = String(req.params.id);
    const wtInfo = taskWorktrees.get(id);
    if (!wtInfo) {
      return res.json({ ok: true, hasWorktree: false, diff: "", stat: "" });
    }

    try {
      const currentBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: wtInfo.projectPath,
        stdio: "pipe",
        timeout: 5000,
      })
        .toString()
        .trim();

      const stat = execFileSync("git", ["diff", `${currentBranch}...${wtInfo.branchName}`, "--stat"], {
        cwd: wtInfo.projectPath,
        stdio: "pipe",
        timeout: 10000,
      })
        .toString()
        .trim();

      const diff = execFileSync("git", ["diff", `${currentBranch}...${wtInfo.branchName}`], {
        cwd: wtInfo.projectPath,
        stdio: "pipe",
        timeout: 15000,
      }).toString();

      res.json({
        ok: true,
        hasWorktree: true,
        branchName: wtInfo.branchName,
        stat,
        diff: diff.length > 50000 ? diff.slice(0, 50000) + "\n... (truncated)" : diff,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.json({ ok: false, error: msg });
    }
  });

  app.post("/api/tasks/:id/merge", (req, res) => {
    const id = String(req.params.id);
    const wtInfo = taskWorktrees.get(id);
    if (!wtInfo) {
      return res.status(404).json({ error: "no_worktree", message: "No worktree found for this task" });
    }

    let verificationState: VerifyCommitState | null = null;
    try {
      verificationState = inspectWorktreeVerification(wtInfo);
    } catch (err: unknown) {
      appendTaskLog(
        id,
        "system",
        `Final branch verification: skipped (${err instanceof Error ? err.message : String(err)})`,
      );
    }

    if (verificationState?.verdict === "ok") {
      appendTaskLog(
        id,
        "system",
        `Final branch verification: passed (ref=${verificationState.compareRef ?? "unknown"}, commits=${verificationState.commitCount}, files=${verificationState.files.length})`,
      );
    } else if (verificationState && verificationState.verdict !== "no_worktree") {
      appendTaskLog(
        id,
        "system",
        `Final branch verification: warning (verdict=${verificationState.verdict}, commits=${verificationState.commitCount}, uncommitted=${verificationState.uncommittedFiles.length})`,
      );
    }

    const result = mergeWorktree(wtInfo.projectPath, id);
    const lang = resolveLang();

    if (result.success) {
      cleanupWorktree(wtInfo.projectPath, id);
      appendTaskLog(id, "system", `Manual merge completed: ${result.message}`);
      notifyCeo(
        pickL(
          l(
            [`수동 병합 완료: ${result.message}`],
            [`Manual merge completed: ${result.message}`],
            [`手動マージ完了: ${result.message}`],
            [`手动合并完成: ${result.message}`],
          ),
          lang,
        ),
        id,
      );
    } else {
      appendTaskLog(id, "system", `Manual merge failed: ${result.message}`);
    }

    res.json({ ok: result.success, message: result.message, conflicts: result.conflicts });
  });

  app.post("/api/tasks/:id/discard", (req, res) => {
    const id = String(req.params.id);
    const wtInfo = taskWorktrees.get(id);
    if (!wtInfo) {
      return res.status(404).json({ error: "no_worktree", message: "No worktree found for this task" });
    }

    cleanupWorktree(wtInfo.projectPath, id);
    appendTaskLog(id, "system", "Worktree discarded (changes abandoned)");
    const lang = resolveLang();
    notifyCeo(
      pickL(
        l(
          [`작업 브랜치가 폐기되었습니다: climpire/${id.slice(0, 8)}`],
          [`Task branch discarded: climpire/${id.slice(0, 8)}`],
          [`タスクブランチを破棄しました: climpire/${id.slice(0, 8)}`],
          [`任务分支已丢弃: climpire/${id.slice(0, 8)}`],
        ),
        lang,
      ),
      id,
    );

    res.json({ ok: true, message: "Worktree discarded" });
  });

  app.get("/api/tasks/:id/verify-commit", (req, res) => {
    const id = String(req.params.id);
    const wtInfo = taskWorktrees.get(id);

    try {
      return res.json(inspectWorktreeVerification(wtInfo));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.json({ ok: false, error: msg, verdict: "error" });
    }
  });

  app.get("/api/worktrees", (_req, res) => {
    const entries: Array<{ taskId: string; branchName: string; worktreePath: string; projectPath: string }> = [];
    for (const [taskId, info] of taskWorktrees) {
      entries.push({ taskId, ...info });
    }
    res.json({ ok: true, worktrees: entries });
  });

  function readCliUsageFromDb(): Record<string, CliUsageEntry> {
    const rows = db.prepare("SELECT provider, data_json FROM cli_usage_cache").all() as Array<{
      provider: string;
      data_json: string;
    }>;
    const usage: Record<string, CliUsageEntry> = {};
    for (const row of rows) {
      try {
        usage[row.provider] = JSON.parse(row.data_json);
      } catch {
        // invalid json row
      }
    }
    return usage;
  }

  async function refreshCliUsageData(): Promise<Record<string, CliUsageEntry>> {
    const providers = ["claude", "codex", "gemini", "copilot", "antigravity"];
    const usage: Record<string, CliUsageEntry> = {};

    const fetchMap: Record<string, () => Promise<CliUsageEntry>> = {
      claude: fetchClaudeUsage,
      codex: fetchCodexUsage,
      gemini: fetchGeminiUsage,
    };

    const fetches = providers.map(async (p) => {
      const tool = CLI_TOOLS.find((t) => t.name === p);
      if (!tool) {
        usage[p] = { windows: [], error: "not_implemented" };
        return;
      }
      if (!tool.checkAuth()) {
        usage[p] = { windows: [], error: "unauthenticated" };
        return;
      }
      const fetcher = fetchMap[p];
      if (fetcher) {
        usage[p] = await fetcher();
      } else {
        usage[p] = { windows: [], error: "not_implemented" };
      }
    });

    await Promise.all(fetches);

    const upsert = db.prepare(
      "INSERT INTO cli_usage_cache (provider, data_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(provider) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at",
    );
    const now = nowMs();
    for (const [p, entry] of Object.entries(usage)) {
      upsert.run(p, JSON.stringify(entry), now);
    }

    return usage;
  }

  app.get("/api/cli-usage", async (_req, res) => {
    let usage = readCliUsageFromDb();
    if (Object.keys(usage).length === 0) {
      usage = await refreshCliUsageData();
    }
    res.json({ ok: true, usage });
  });

  app.post("/api/cli-usage/refresh", async (_req, res) => {
    try {
      const usage = await refreshCliUsageData();
      broadcast("cli_usage_update", usage);
      res.json({ ok: true, usage });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  return { refreshCliUsageData };
}
