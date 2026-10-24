import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { applyBaseSchema } from "./base-schema.ts";
import { applyTaskSchemaMigrations } from "./task-schema-migrations.ts";

describe("task_agent_notes schema migrations", () => {
  it("keeps the inbox usable after the legacy messages table is rebuilt", () => {
    const db = new DatabaseSync(":memory:");

    try {
      // Simulate an upgrade: legacy messages CHECK without 'directive', then the inbox is created by the base schema.
      db.exec(`
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          sender_type TEXT NOT NULL CHECK(sender_type IN ('ceo','agent','system')),
          sender_id TEXT,
          receiver_type TEXT NOT NULL CHECK(receiver_type IN ('agent','department','all')),
          receiver_id TEXT,
          content TEXT NOT NULL,
          message_type TEXT DEFAULT 'chat' CHECK(message_type IN ('chat','task_assign','announcement','report','status_update')),
          task_id TEXT REFERENCES tasks(id),
          created_at INTEGER DEFAULT (unixepoch()*1000)
        );
      `);
      applyBaseSchema(db);
      applyTaskSchemaMigrations(db);

      const fkTables = (db.prepare("PRAGMA foreign_key_list(task_agent_notes)").all() as Array<{ table: string }>).map(
        (fk) => fk.table,
      );
      expect(new Set(fkTables)).toEqual(new Set(["messages", "tasks"]));

      db.exec(`
        INSERT INTO tasks (id, title) VALUES ('source', 'Source'), ('target', 'Target');
        INSERT INTO messages (id, sender_type, receiver_type, content, message_type, task_id)
          VALUES ('m1', 'agent', 'agent', 'note', 'directive', 'target');
        INSERT INTO task_agent_notes (message_id, source_task_id, target_task_id) VALUES ('m1', 'source', 'target');
      `);
      expect(db.prepare("SELECT COUNT(*) AS count FROM task_agent_notes").get()).toEqual({ count: 1 });
    } finally {
      db.close();
    }
  });
});
