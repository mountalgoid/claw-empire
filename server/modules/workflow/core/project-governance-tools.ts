import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

type DbLike = { prepare: (sql: string) => { get: (...args: any[]) => any; all: (...args: any[]) => any; run: (...args: any[]) => any } };

function readCommit(cwd: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd, stdio: "pipe", timeout: 5000 }).toString().trim() || null;
  } catch {
    return null;
  }
}

export function createProjectGovernanceTools(deps: { db: DbLike; nowMs: () => number }) {
  const { db, nowMs } = deps;
  const DEFAULT_PERMISSIONS = ["filesystem_read", "filesystem_write", "terminal", "git", "external_resources"] as const;

  function getAgentPermissionContext(agentId: string): string {
    const rows = db.prepare("SELECT permission, enabled FROM agent_permissions WHERE agent_id = ? ORDER BY permission").all(agentId) as Array<{ permission?: unknown; enabled?: unknown }>;
    const configured = new Map(rows.map((row) => [String(row.permission ?? ""), Number(row.enabled) === 1]));
    const permissions = new Set<string>(DEFAULT_PERMISSIONS);
    for (const [permission, enabled] of configured) {
      if (enabled) permissions.add(permission);
      else permissions.delete(permission);
    }
    return [
      "[Agent Permissions / Izin Agent]",
      `- Granted capabilities: ${Array.from(permissions).sort().join(", ") || "none"}`,
      "- Never read or expose secrets (.env, private keys, tokens) unless the task explicitly requires a safe, redacted value.",
      "- Network access, database access, and destructive commands require an explicit granted capability and task scope.",
      "- Verified project resources are the only approved external sources; use them only for the current project and task.",
      "- If a required capability is not granted, stop and report the missing permission instead of bypassing it.",
    ].join("\n");
  }

  function getProjectExternalResourceContext(projectId: string | null, agentId?: string | null, taskText = ""): string {
    const rows = projectId
      ? (db.prepare(
          `SELECT name, kind, url, title FROM external_resources
           WHERE project_id = ? AND status = 'available'
             AND (agent_id IS NULL OR agent_id = ?)
           ORDER BY updated_at DESC LIMIT 20`,
        ).all(projectId, agentId ?? "") as Array<{ name?: unknown; kind?: unknown; url?: unknown; title?: unknown }>)
      : [];
    const safeTaskHint = taskText
      .replace(/(?:token|secret|password|api[_ -]?key|private[_ -]?key)\s*[:=]\s*\S+/gi, "$1=[redacted]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);
    return [
      "[External Resources / Sumber Daya Eksternal]",
      "Automatically inspect the approved project list first. If it is empty or insufficient, perform controlled public discovery without waiting for the user to register a resource.",
      "Discovery allowlist: api.github.com and github.com, registry.npmjs.org and npmjs.com, pypi.org, crates.io, rubygems.org, developer.mozilla.org, and official documentation domains of the selected tool/vendor.",
      "Use GET/HEAD only, at most 3 focused searches and 5 MB per downloaded resource. Prefer official repositories, signed releases, stable versions, clear licenses, and recent security advisories.",
      "Search with generic task keywords only. Never send source code, credentials, private paths, personal data, or unredacted task contents to external sites. Never execute downloaded code before inspection.",
      "Validate hostname, HTTPS, redirect target, package/repository identity, license, checksum or release signature when available, and relevance. Record discovered URLs and why each was used in the final report.",
      `[Task relevance hint - sanitized] ${safeTaskHint || "No additional hint; infer the smallest required resource search from the task."}`,
      ...rows.map((row) => `- [APPROVED] ${String(row.name ?? "Resource")} (${String(row.kind ?? "url")}): ${String(row.url ?? "")}${row.title ? ` — ${String(row.title)}` : ""}`),
      "Before completion, report: approved resources consulted, automatically discovered resources used, resources skipped with a short reason, and any resource that could not be reached.",
    ].join("\n");
  }

  function captureCheckpoint(input: {
    projectId: string | null;
    taskId: string;
    worktreePath?: string | null;
    branchName?: string | null;
    status: "captured" | "review" | "approved" | "failed";
    evidence?: Record<string, unknown>;
  }): void {
    if (!input.projectId) return;
    const commitSha = input.worktreePath ? readCommit(input.worktreePath) : null;
    db.prepare(
      `INSERT INTO project_checkpoints
       (id, project_id, task_id, branch_name, commit_sha, status, evidence_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
    ).run(
      randomUUID(),
      input.projectId,
      input.taskId,
      input.branchName ?? null,
      commitSha,
      input.status,
      JSON.stringify(input.evidence ?? {}),
      nowMs(),
    );
  }

  function recordExecutionMetrics(input: {
    taskId: string;
    agentId: string | null;
    projectId: string | null;
    provider: string | null;
    exitCode: number;
    startedAt: number | null;
    result: string;
  }): void {
    const usage = input.result.match(/"usage"\s*:\s*\{[^}]*"input_tokens"\s*:\s*(\d+)[^}]*"output_tokens"\s*:\s*(\d+)/s);
    db.prepare(
      `INSERT INTO agent_execution_metrics
       (id, task_id, agent_id, project_id, provider, exit_code, duration_ms, input_tokens, output_tokens, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    ).run(
      randomUUID(),
      input.taskId,
      input.agentId,
      input.projectId,
      input.provider,
      input.exitCode,
      input.startedAt ? Math.max(0, nowMs() - input.startedAt) : null,
      usage ? Number(usage[1]) : null,
      usage ? Number(usage[2]) : null,
      nowMs(),
    );
  }

  function getProjectHealth(projectId: string): Record<string, unknown> {
    const tasks = db.prepare(
      `SELECT status, COUNT(*) AS count FROM tasks WHERE project_id = ? GROUP BY status`,
    ).all(projectId) as Array<{ status: string; count: number }>;
    const latestCheckpoint = db.prepare(
      `SELECT id, task_id, branch_name, commit_sha, status, evidence_json, created_at
       FROM project_checkpoints WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).get(projectId) as Record<string, unknown> | undefined;
    const metrics = db.prepare(
      `SELECT COUNT(*) AS runs, SUM(CASE WHEN exit_code = 0 THEN 1 ELSE 0 END) AS successful_runs,
              SUM(COALESCE(input_tokens, 0)) AS input_tokens, SUM(COALESCE(output_tokens, 0)) AS output_tokens,
              AVG(duration_ms) AS average_duration_ms
       FROM agent_execution_metrics WHERE project_id = ?`,
    ).get(projectId) as Record<string, unknown>;
    const taskCounts = Object.fromEntries(tasks.map((row) => [row.status, Number(row.count)]));
    const runs = Number(metrics?.runs ?? 0);
    const successfulRuns = Number(metrics?.successful_runs ?? 0);
    return {
      project_id: projectId,
      task_counts: taskCounts,
      latest_checkpoint: latestCheckpoint ?? null,
      metrics: {
        runs,
        successful_runs: successfulRuns,
        success_rate: runs > 0 ? Math.round((successfulRuns / runs) * 100) : null,
        input_tokens: Number(metrics?.input_tokens ?? 0),
        output_tokens: Number(metrics?.output_tokens ?? 0),
        average_duration_ms: metrics?.average_duration_ms ? Math.round(Number(metrics.average_duration_ms)) : null,
      },
      health: taskCounts.failed || taskCounts.inbox ? "needs_attention" : "healthy",
      health_hash: createHash("sha256").update(JSON.stringify({ taskCounts, latestCheckpoint, metrics })).digest("hex").slice(0, 16),
    };
  }

  return { captureCheckpoint, recordExecutionMetrics, getProjectHealth, getAgentPermissionContext, getProjectExternalResourceContext };
}
