import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Memory entries — decisions, preferences, facts extracted from conversations
  yield* sql`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      thread_id TEXT,
      type TEXT NOT NULL DEFAULT 'fact',
      content TEXT NOT NULL,
      summary TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      last_accessed_at TEXT,
      source_event_sequence INTEGER
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_memory_entries_project_id
    ON memory_entries(project_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_memory_entries_type
    ON memory_entries(type)
  `;

  // FTS5 full-text search index on memory content and summary
  // Using content-sync so FTS stays updated via triggers
  yield* sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      content,
      summary,
      content='memory_entries',
      content_rowid='rowid'
    )
  `;

  // Triggers to keep FTS5 in sync — use unsafe() for multi-statement trigger bodies
  yield* sql
    .unsafe(
      `CREATE TRIGGER IF NOT EXISTS memory_fts_insert AFTER INSERT ON memory_entries BEGIN
      INSERT INTO memory_fts(rowid, content, summary)
      VALUES (new.rowid, new.content, new.summary);
    END`,
    )
    .pipe(Effect.asVoid);

  yield* sql
    .unsafe(
      `CREATE TRIGGER IF NOT EXISTS memory_fts_delete BEFORE DELETE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, summary)
      VALUES ('delete', old.rowid, old.content, old.summary);
    END`,
    )
    .pipe(Effect.asVoid);

  yield* sql
    .unsafe(
      `CREATE TRIGGER IF NOT EXISTS memory_fts_update AFTER UPDATE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, summary)
      VALUES ('delete', old.rowid, old.content, old.summary);
      INSERT INTO memory_fts(rowid, content, summary)
      VALUES (new.rowid, new.content, new.summary);
    END`,
    )
    .pipe(Effect.asVoid);
});
