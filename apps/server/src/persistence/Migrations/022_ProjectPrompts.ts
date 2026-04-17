import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Project prompts — persistent instructions injected into AI turns
  // Three scopes: global (project_id IS NULL), project, thread
  yield* sql`
    CREATE TABLE IF NOT EXISTS project_prompts (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      thread_id TEXT,
      scope TEXT NOT NULL DEFAULT 'project',
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_project_prompts_project_id
    ON project_prompts(project_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_project_prompts_scope
    ON project_prompts(scope, enabled)
  `;

  // Harness presets — pre-built workflow configurations
  yield* sql`
    CREATE TABLE IF NOT EXISTS harness_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `;
});
