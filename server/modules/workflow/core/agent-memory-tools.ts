import { randomUUID } from "node:crypto";

type DbLike = {
  prepare: (sql: string) => {
    get: (...args: any[]) => unknown;
    all: (...args: any[]) => unknown;
    run: (...args: any[]) => unknown;
  };
};

type AgentMemoryRow = {
  title: string;
  content: string;
  project_id: string | null;
  confidence: number;
};

export function createAgentMemoryTools(deps: { db: DbLike; nowMs: () => number }) {
  const { db, nowMs } = deps;

  function getAgentMemoryContext(agentId: string, projectId: string | null = null, limit = 8): string {
    const rows = db
      .prepare(
        `
        SELECT title, content, project_id, confidence
        FROM agent_memories
        WHERE agent_id = ?
          AND (project_id IS NULL OR project_id = ?)
        ORDER BY CASE WHEN project_id = ? THEN 0 ELSE 1 END, confidence DESC, updated_at DESC
        LIMIT ?
      `,
      )
      .all(agentId, projectId, projectId, Math.max(1, Math.min(limit, 12))) as AgentMemoryRow[];
    if (rows.length === 0) return "";

    const usedAt = nowMs();
    db.prepare(
      `
      UPDATE agent_memories
      SET last_used_at = ?, use_count = use_count + 1
      WHERE agent_id = ? AND (project_id IS NULL OR project_id = ?)
    `,
    ).run(usedAt, agentId, projectId);

    return [
      "\n--- Agent long-term memory ---",
      ...rows.map((row) => `- ${row.title}: ${row.content}`),
      "--- End agent long-term memory ---",
    ].join("\n");
  }

  function rememberTaskResult(input: {
    agentId: string;
    projectId: string | null;
    taskId: string;
    taskTitle: string;
    exitCode: number;
    result: string;
  }): void {
    const content = input.result
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(-1400);
    if (!content) return;
    const status = input.exitCode === 0 ? "berhasil" : "gagal";
    const now = nowMs();
    db.prepare(
      `
      INSERT INTO agent_memories
        (id, agent_id, project_id, memory_type, title, content, source_task_id, confidence, created_at, updated_at)
      VALUES (?, ?, ?, 'task_result', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id, source_task_id, memory_type) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        project_id = excluded.project_id,
        confidence = excluded.confidence,
        updated_at = excluded.updated_at
    `,
    ).run(
      randomUUID(),
      input.agentId,
      input.projectId,
      `Pekerjaan ${status}: ${input.taskTitle}`,
      content,
      input.taskId,
      input.exitCode === 0 ? 0.9 : 0.8,
      now,
      now,
    );
  }

  return { getAgentMemoryContext, rememberTaskResult };
}
