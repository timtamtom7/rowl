import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_context_nodes (
      node_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'messages',
      summary TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      compressed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_context_nodes_project_id
    ON projection_context_nodes(project_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_context_nodes_thread_id
    ON projection_context_nodes(thread_id)
  `;
});
