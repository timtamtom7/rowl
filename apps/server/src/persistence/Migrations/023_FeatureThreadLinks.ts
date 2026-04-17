import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS feature_thread_links (
      feature_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (feature_id, thread_id)
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_feature_thread_links_thread
    ON feature_thread_links(thread_id)
  `;
});
