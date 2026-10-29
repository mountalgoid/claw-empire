import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { RuntimeContext } from "../../../types/runtime-context.ts";

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUPPORTED: Record<string, { mime: string; category: "image" | "video" | "document" }> = {
  ".png": { mime: "image/png", category: "image" },
  ".jpg": { mime: "image/jpeg", category: "image" },
  ".jpeg": { mime: "image/jpeg", category: "image" },
  ".gif": { mime: "image/gif", category: "image" },
  ".webp": { mime: "image/webp", category: "image" },
  ".mp4": { mime: "video/mp4", category: "video" },
  ".mov": { mime: "video/quicktime", category: "video" },
  ".webm": { mime: "video/webm", category: "video" },
  ".pdf": { mime: "application/pdf", category: "document" },
  ".txt": { mime: "text/plain", category: "document" },
  ".md": { mime: "text/markdown", category: "document" },
  ".csv": { mime: "text/csv", category: "document" },
  ".json": { mime: "application/json", category: "document" },
};

function safeOriginalName(raw: string): string {
  const decoded = decodeURIComponent(raw);
  const name = path.basename(decoded.replace(/\\/g, "/"));
  return name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);
}

function hasValidSignature(buffer: Buffer, ext: string): boolean {
  if (ext === ".png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === ".jpg" || ext === ".jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === ".gif")
    return (
      buffer
        .subarray(0, 6)
        .toString("ascii")
        .match(/^GIF8[79]a$/) !== null
    );
  if (ext === ".webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (ext === ".mp4" || ext === ".mov") return buffer.toString("ascii", 4, 8) === "ftyp";
  if (ext === ".webm") return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (ext === ".pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    if (ext === ".json") JSON.parse(buffer.toString("utf8"));
    return true;
  } catch {
    return false;
  }
}

function sendError(res: Response, status: number, error: string) {
  return res.status(status).json({ error });
}

export function registerAttachmentRoutes(ctx: Pick<RuntimeContext, "app" | "db" | "logsDir">): void {
  const { app, db, logsDir } = ctx;
  const directory = path.join(logsDir, "attachments");

  app.post(
    "/api/attachments",
    express.raw({ type: "application/octet-stream", limit: MAX_ATTACHMENT_BYTES }),
    (req: Request, res: Response) => {
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const originalName = safeOriginalName(String(req.headers["x-file-name"] ?? ""));
      const ext = path.extname(originalName).toLowerCase();
      const format = SUPPORTED[ext];

      if (!originalName || !format) return sendError(res, 400, "unsupported_attachment_type");
      if (!buffer.byteLength) return sendError(res, 400, "empty_attachment");
      if (buffer.byteLength > MAX_ATTACHMENT_BYTES) return sendError(res, 413, "attachment_too_large");
      if (!hasValidSignature(buffer, ext)) return sendError(res, 415, "attachment_content_mismatch");

      const id = randomUUID();
      const storageName = `${id}${ext}`;
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const destination = path.join(directory, storageName);
      try {
        fs.writeFileSync(destination, buffer, { flag: "wx", mode: 0o600 });
        const sha256 = createHash("sha256").update(buffer).digest("hex");
        db.prepare(
          "INSERT INTO attachments (id, original_name, mime_type, byte_size, sha256, storage_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(id, originalName, format.mime, buffer.byteLength, sha256, storageName, Date.now());
        return res.status(201).json({
          id,
          name: originalName,
          mime_type: format.mime,
          size: buffer.byteLength,
          category: format.category,
          sha256,
        });
      } catch (error) {
        try {
          fs.unlinkSync(destination);
        } catch {
          // The file may not have been created.
        }
        console.error("[attachments] upload failed", error);
        return sendError(res, 500, "attachment_save_failed");
      }
    },
  );

  app.get("/api/attachments/:id", (req, res) => {
    const id = String(req.params.id ?? "");
    if (!ID_RE.test(id)) return sendError(res, 404, "attachment_not_found");
    const row = db.prepare("SELECT original_name, mime_type, storage_name FROM attachments WHERE id = ?").get(id) as
      | { original_name: string; mime_type: string; storage_name: string }
      | undefined;
    if (!row || !Object.values(SUPPORTED).some((entry) => entry.mime === row.mime_type)) {
      return sendError(res, 404, "attachment_not_found");
    }
    const ext = path.extname(row.storage_name);
    const expectedName = `${id}${ext}`;
    if (row.storage_name !== expectedName || !SUPPORTED[ext]) return sendError(res, 404, "attachment_not_found");
    res.setHeader("Content-Type", row.mime_type);
    res.setHeader("Content-Disposition", `inline; filename="attachment${ext}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    return res.sendFile(row.storage_name, { root: directory, dotfiles: "deny" });
  });

  app.delete("/api/attachments/:id", (req, res) => {
    const id = String(req.params.id ?? "");
    if (!ID_RE.test(id)) return sendError(res, 404, "attachment_not_found");
    const marker = `%[[attachment:${id}]]%`;
    const usedByTask = db.prepare("SELECT 1 FROM tasks WHERE description LIKE ? LIMIT 1").get(marker);
    const usedByMessage = db.prepare("SELECT 1 FROM messages WHERE content LIKE ? LIMIT 1").get(marker);
    if (usedByTask || usedByMessage) return sendError(res, 409, "attachment_in_use");
    const row = db.prepare("SELECT storage_name FROM attachments WHERE id = ?").get(id) as
      | { storage_name: string }
      | undefined;
    if (!row) return sendError(res, 404, "attachment_not_found");
    db.prepare("DELETE FROM attachments WHERE id = ?").run(id);
    const ext = path.extname(row.storage_name);
    if (row.storage_name === `${id}${ext}` && SUPPORTED[ext]) {
      try {
        fs.unlinkSync(path.join(directory, row.storage_name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.warn("[attachments] cleanup failed", error);
      }
    }
    return res.json({ ok: true });
  });
}
