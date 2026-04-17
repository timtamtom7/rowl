import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_features (
      feature_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'backlog',
      thread_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'user'
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_features_project_id
    ON projection_features(project_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_features_project_stage
    ON projection_features(project_id, stage)
  `;
});
