import { randomUUID } from "node:crypto";
import type { RuntimeContext } from "../../../types/runtime-context.ts";

const RESOURCE_KINDS = new Set(["url", "repository", "skill", "plugin", "app", "dataset", "document"]);

function parsePublicUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (![
    "http:",
    "https:",
  ].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return null;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
  const private172 = host.match(/^172\.(\d+)\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
  return url;
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export function registerExternalResourceRoutes(ctx: RuntimeContext): void {
  const { app, db, nowMs } = ctx;

  async function syncResource(id: string): Promise<Record<string, unknown> | null> {
    const resource = db.prepare("SELECT * FROM external_resources WHERE id = ?").get(id) as
      | { id: string; url: string }
      | undefined;
    if (!resource) return null;
    const stamp = nowMs();
    try {
      const response = await fetch(resource.url, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "Claw-Empire-ResourceHub/1.0" },
      });
      const available = response.status >= 200 && response.status < 400;
      const title = response.headers.get("x-resource-title") || new URL(resource.url).hostname;
      db.prepare(
        `UPDATE external_resources
         SET status = ?, title = ?, content_type = ?, etag = ?, last_modified = ?,
             metadata_json = ?, error_message = ?, last_synced_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        available ? "available" : "error",
        title,
        response.headers.get("content-type"),
        response.headers.get("etag"),
        response.headers.get("last-modified"),
        JSON.stringify({ http_status: response.status, checked_url: resource.url }),
        available ? null : `HTTP ${response.status}`,
        stamp,
        stamp,
        id,
      );
    } catch (error) {
      db.prepare(
        `UPDATE external_resources SET status = 'error', error_message = ?, last_synced_at = ?, updated_at = ? WHERE id = ?`,
      ).run(String(error instanceof Error ? error.message : error).slice(0, 500), stamp, stamp, id);
    }
    return db.prepare("SELECT * FROM external_resources WHERE id = ?").get(id) as Record<string, unknown>;
  }

  app.get("/api/external-resources", (req, res) => {
    const projectId = asText(req.query.project_id);
    const rows = projectId
      ? db.prepare("SELECT * FROM external_resources WHERE project_id = ? ORDER BY updated_at DESC").all(projectId)
      : db.prepare("SELECT * FROM external_resources ORDER BY updated_at DESC LIMIT 200").all();
    res.json({ ok: true, resources: rows });
  });

  app.post("/api/external-resources", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const url = parsePublicUrl(body.url);
    const name = asText(body.name) || (url ? url.hostname : "");
    const kind = asText(body.kind, "url");
    if (!url) return res.status(400).json({ error: "public_http_url_required" });
    if (!name) return res.status(400).json({ error: "name_required" });
    if (!RESOURCE_KINDS.has(kind)) return res.status(400).json({ error: "invalid_resource_kind" });
    if (body.project_id && !db.prepare("SELECT id FROM projects WHERE id = ?").get(String(body.project_id))) {
      return res.status(400).json({ error: "project_not_found" });
    }
    if (body.agent_id && !db.prepare("SELECT id FROM agents WHERE id = ?").get(String(body.agent_id))) {
      return res.status(400).json({ error: "agent_not_found" });
    }
    const id = randomUUID();
    const stamp = nowMs();
    db.prepare(
      `INSERT INTO external_resources
       (id, project_id, agent_id, name, kind, url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).run(id, asText(body.project_id) || null, asText(body.agent_id) || null, name.slice(0, 160), kind, url.toString(), stamp, stamp);
    const resource = await syncResource(id);
    res.status(201).json({ ok: true, resource });
  });

  app.post("/api/external-resources/:id/sync", async (req, res) => {
    const resource = await syncResource(String(req.params.id));
    if (!resource) return res.status(404).json({ error: "resource_not_found" });
    res.json({ ok: true, resource });
  });

  app.patch("/api/external-resources/:id", (req, res) => {
    const id = String(req.params.id);
    if (!db.prepare("SELECT id FROM external_resources WHERE id = ?").get(id)) return res.status(404).json({ error: "resource_not_found" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [];
    if (typeof body.name === "string" && body.name.trim()) { updates.push("name = ?"); values.push(body.name.trim().slice(0, 160)); }
    if (body.status === "available" || body.status === "disabled") { updates.push("status = ?"); values.push(body.status); }
    if (updates.length === 0) return res.status(400).json({ error: "no_fields_to_update" });
    updates.push("updated_at = ?");
    values.push(nowMs(), id);
    db.prepare(`UPDATE external_resources SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    res.json({ ok: true, resource: db.prepare("SELECT * FROM external_resources WHERE id = ?").get(id) });
  });

  app.delete("/api/external-resources/:id", (req, res) => {
    const result = db.prepare("DELETE FROM external_resources WHERE id = ?").run(String(req.params.id));
    if (!result.changes) return res.status(404).json({ error: "resource_not_found" });
    res.json({ ok: true });
  });
}
