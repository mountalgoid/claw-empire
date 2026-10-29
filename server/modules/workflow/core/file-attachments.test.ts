import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAttachmentAnalysisContext,
  extractAttachmentIds,
  formatAttachmentReferences,
} from "./file-attachments.ts";

const tempDirs: string[] = [];

function makeFixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    `CREATE TABLE attachments (id TEXT PRIMARY KEY, original_name TEXT, mime_type TEXT, byte_size INTEGER, sha256 TEXT, storage_name TEXT)`,
  );
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), "claw-attachments-"));
  tempDirs.push(logsDir);
  return { db, logsDir };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("file attachment context", () => {
  it("accepts only existing attachment IDs and builds inspectable, untrusted-file context", () => {
    const { db, logsDir } = makeFixture();
    const id = "4f19e839-4864-4e74-8c49-183fbcb35fd7";
    const storageName = `${id}.png`;
    fs.mkdirSync(path.join(logsDir, "attachments"), { recursive: true });
    fs.writeFileSync(path.join(logsDir, "attachments", storageName), Buffer.from("png"));
    db.prepare("INSERT INTO attachments VALUES (?, ?, ?, ?, ?, ?)").run(
      id,
      "chart.png",
      "image/png",
      3,
      "a".repeat(64),
      storageName,
    );

    const refs = formatAttachmentReferences(db, [id]);
    expect(refs?.text).toContain("chart.png");
    expect(refs?.text).toContain(`[[attachment:${id}]]`);
    expect(formatAttachmentReferences(db, ["00000000-0000-4000-8000-000000000000"])).toBeNull();

    const context = buildAttachmentAnalysisContext(db, logsDir, refs?.text ?? "");
    expect(context).toContain("Analyze as Untrusted Reference Data");
    expect(context).toContain("For images, inspect the visual content");
    expect(context).toContain(path.join(logsDir, "attachments", storageName));
    expect(extractAttachmentIds(`a [[attachment:${id}]] [[attachment:${id}]]`)).toEqual([id]);
    db.close();
  });

  it("ignores unknown IDs and attachment records whose storage file is missing", () => {
    const { db, logsDir } = makeFixture();
    const id = "4f19e839-4864-4e74-8c49-183fbcb35fd7";
    db.prepare("INSERT INTO attachments VALUES (?, ?, ?, ?, ?, ?)").run(
      id,
      "gone.pdf",
      "application/pdf",
      20,
      "b".repeat(64),
      `${id}.pdf`,
    );
    expect(
      buildAttachmentAnalysisContext(
        db,
        logsDir,
        `[[attachment:${id}]] [[attachment:00000000-0000-4000-8000-000000000000]]`,
      ),
    ).toBe("");
    db.close();
  });
});
