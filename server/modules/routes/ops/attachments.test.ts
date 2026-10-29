import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { registerAttachmentRoutes } from "./attachments.ts";

const tempDirs: string[] = [];

function setup() {
  const app = express();
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE attachments (id TEXT PRIMARY KEY, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, sha256 TEXT NOT NULL, storage_name TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
    CREATE TABLE tasks (description TEXT);
    CREATE TABLE messages (content TEXT);
  `);
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), "claw-attachment-route-"));
  tempDirs.push(logsDir);
  registerAttachmentRoutes({ app, db: db as any, logsDir });
  return { app, db, logsDir };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("attachment routes", () => {
  it("stores only allowlisted file types under a generated name and serves them inline safely", async () => {
    const { app, db, logsDir } = setup();
    const response = await request(app)
      .post("/api/attachments")
      .set("content-type", "application/octet-stream")
      .set("x-file-name", encodeURIComponent("../../sample.txt"))
      .send(Buffer.from("Read this brief"));

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("sample.txt");
    const saved = fs.readdirSync(path.join(logsDir, "attachments"));
    expect(saved).toEqual([`${response.body.id}.txt`]);

    const downloaded = await request(app).get(`/api/attachments/${response.body.id}`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["x-content-type-options"]).toBe("nosniff");
    expect(downloaded.text).toBe("Read this brief");
    db.close();
  });

  it("rejects executable/unsupported extensions and mismatched file signatures", async () => {
    const { app, db } = setup();
    const executable = await request(app)
      .post("/api/attachments")
      .set("content-type", "application/octet-stream")
      .set("x-file-name", "payload.html")
      .send(Buffer.from("<script>alert(1)</script>"));
    const mismatch = await request(app)
      .post("/api/attachments")
      .set("content-type", "application/octet-stream")
      .set("x-file-name", "photo.png")
      .send(Buffer.from("not a png"));

    expect(executable.status).toBe(400);
    expect(mismatch.status).toBe(415);
    db.close();
  });

  it("refuses to delete an attachment referenced by a task", async () => {
    const { app, db, logsDir } = setup();
    const uploaded = await request(app)
      .post("/api/attachments")
      .set("content-type", "application/octet-stream")
      .set("x-file-name", "brief.md")
      .send(Buffer.from("Project brief"));
    db.prepare("INSERT INTO tasks (description) VALUES (?)").run(`Use [[attachment:${uploaded.body.id}]]`);
    const deletion = await request(app).delete(`/api/attachments/${uploaded.body.id}`);

    expect(deletion.status).toBe(409);
    expect(fs.existsSync(path.join(logsDir, "attachments", `${uploaded.body.id}.md`))).toBe(true);
    db.close();
  });
});
