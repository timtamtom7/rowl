import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Codebase health scores — persisted across sessions
  // Tracks file-level health metrics that accumulate over time
  yield* sql`
    CREATE TABLE IF NOT EXISTS codebase_health (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      line_count INTEGER NOT NULL DEFAULT 0,
      connection_count INTEGER NOT NULL DEFAULT 0,
      change_frequency INTEGER NOT NULL DEFAULT 0,
      last_changed_at TEXT,
      health_score INTEGER NOT NULL DEFAULT 100,
      issues_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, file_path)
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_codebase_health_project_id
    ON codebase_health(project_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_codebase_health_score
    ON codebase_health(project_id, health_score)
  `;
});
