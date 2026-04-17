/**
 * ProjectPromptsServiceLive — Persistent AI instructions and harness management.
 *
 * @module ProjectPromptsServiceLive
 */
import { randomUUID } from "node:crypto";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

import {
  ProjectPromptsService,
  type ProjectPromptsServiceShape,
  type ProjectPrompt,
  type HarnessPreset,
} from "../Services/ProjectPromptsService.ts";
import { BUILTIN_HARNESSES } from "./WorkflowEngine.ts";

// Track active harness per thread (in-memory, not persisted — resets on restart)
const activeHarnessByThread = new Map<string, string>();

export const ProjectPromptsServiceLive = Layer.effect(
  ProjectPromptsService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Seed built-in harness presets on startup
    const now = new Date().toISOString();
    for (const [id, preset] of Object.entries(BUILTIN_HARNESSES)) {
      yield* sql`
        INSERT INTO harness_presets (id, name, description, category, content, is_builtin, created_at)
        VALUES (${id}, ${preset.name}, ${preset.description}, ${preset.category}, ${preset.content}, 1, ${now})
        ON CONFLICT (id) DO UPDATE SET
          content = excluded.content,
          description = excluded.description,
          name = excluded.name
      `.pipe(Effect.asVoid, Effect.catch(() => Effect.void));
    }

    // ── Prompts CRUD ──

    const createPrompt: ProjectPromptsServiceShape["createPrompt"] = (input) =>
      Effect.gen(function* () {
        const id = randomUUID();
        const now = new Date().toISOString();
        yield* sql`
          INSERT INTO project_prompts (id, project_id, thread_id, scope, name, content, enabled, priority, created_at, updated_at)
          VALUES (${id}, ${input.projectId}, ${input.threadId}, ${input.scope}, ${input.name}, ${input.content}, 1, 0, ${now}, ${now})
        `.pipe(Effect.asVoid);
        return {
          id,
          projectId: input.projectId,
          threadId: input.threadId,
          scope: input.scope,
          name: input.name,
          content: input.content,
          enabled: true,
          priority: 0,
          createdAt: now,
          updatedAt: now,
        } satisfies ProjectPrompt;
      }).pipe(Effect.catch(() => Effect.die(new Error("Failed to create prompt"))));

    const listPrompts: ProjectPromptsServiceShape["listPrompts"] = (input) =>
      Effect.gen(function* () {
        if (input.projectId && input.scope) {
          const rows = yield* sql`
            SELECT id, project_id AS "projectId", thread_id AS "threadId", scope, name, content,
                   enabled, priority, created_at AS "createdAt", updated_at AS "updatedAt"
            FROM project_prompts
            WHERE (project_id = ${input.projectId} OR project_id IS NULL)
              AND scope = ${input.scope}
            ORDER BY priority DESC, created_at ASC
          `;
          return rows as unknown as ProjectPrompt[];
        }
        if (input.projectId) {
          const rows = yield* sql`
            SELECT id, project_id AS "projectId", thread_id AS "threadId", scope, name, content,
                   enabled, priority, created_at AS "createdAt", updated_at AS "updatedAt"
            FROM project_prompts
            WHERE project_id = ${input.projectId} OR project_id IS NULL
            ORDER BY scope ASC, priority DESC, created_at ASC
          `;
          return rows as unknown as ProjectPrompt[];
        }
        const rows = yield* sql`
          SELECT id, project_id AS "projectId", thread_id AS "threadId", scope, name, content,
                 enabled, priority, created_at AS "createdAt", updated_at AS "updatedAt"
          FROM project_prompts
          WHERE project_id IS NULL
          ORDER BY priority DESC, created_at ASC
        `;
        return rows as unknown as ProjectPrompt[];
      }).pipe(Effect.catch(() => Effect.succeed([] as ReadonlyArray<ProjectPrompt>)));

    const updatePrompt: ProjectPromptsServiceShape["updatePrompt"] = (input) =>
      Effect.gen(function* () {
        const now = new Date().toISOString();
        if (input.name !== undefined) {
          yield* sql`UPDATE project_prompts SET name = ${input.name}, updated_at = ${now} WHERE id = ${input.id}`.pipe(Effect.asVoid);
        }
        if (input.content !== undefined) {
          yield* sql`UPDATE project_prompts SET content = ${input.content}, updated_at = ${now} WHERE id = ${input.id}`.pipe(Effect.asVoid);
        }
        if (input.enabled !== undefined) {
          yield* sql`UPDATE project_prompts SET enabled = ${input.enabled ? 1 : 0}, updated_at = ${now} WHERE id = ${input.id}`.pipe(Effect.asVoid);
        }
        // Fetch updated
        const rows = yield* sql`
          SELECT id, project_id AS "projectId", thread_id AS "threadId", scope, name, content,
                 enabled, priority, created_at AS "createdAt", updated_at AS "updatedAt"
          FROM project_prompts WHERE id = ${input.id}
        `;
        return (rows as any[])[0] as ProjectPrompt;
      }).pipe(Effect.catch(() => Effect.die(new Error("Failed to update prompt"))));

    const deletePrompt: ProjectPromptsServiceShape["deletePrompt"] = (input) =>
      sql`DELETE FROM project_prompts WHERE id = ${input.id}`.pipe(
        Effect.asVoid,
        Effect.catch(() => Effect.void),
      );

    // ── Harness Presets ──

    const listHarnessPresets: ProjectPromptsServiceShape["listHarnessPresets"] = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT id, name, description, category, content,
                 is_builtin AS "isBuiltin", created_at AS "createdAt"
          FROM harness_presets
          ORDER BY is_builtin DESC, name ASC
        `;
        return (rows as any[]).map((r) => ({
          ...r,
          isBuiltin: r.isBuiltin === 1 || r.isBuiltin === true,
        })) as unknown as HarnessPreset[];
      }).pipe(Effect.catch(() => Effect.succeed([] as ReadonlyArray<HarnessPreset>)));

    const getActiveHarness: ProjectPromptsServiceShape["getActiveHarness"] = (input) =>
      Effect.gen(function* () {
        const presetId = activeHarnessByThread.get(input.threadId);
        if (!presetId) return null;
        const rows = yield* sql`
          SELECT id, name, description, category, content,
                 is_builtin AS "isBuiltin", created_at AS "createdAt"
          FROM harness_presets WHERE id = ${presetId}
        `;
        if ((rows as any[]).length === 0) return null;
        const r = (rows as any[])[0];
        return { ...r, isBuiltin: r.isBuiltin === 1 || r.isBuiltin === true } as HarnessPreset;
      }).pipe(Effect.catch(() => Effect.succeed(null as HarnessPreset | null)));

    const activateHarness: ProjectPromptsServiceShape["activateHarness"] = (input) =>
      Effect.succeed(activeHarnessByThread.set(input.threadId, input.presetId)).pipe(
        Effect.map(() => undefined),
      );

    const deactivateHarness: ProjectPromptsServiceShape["deactivateHarness"] = (input) =>
      Effect.succeed(activeHarnessByThread.delete(input.threadId)).pipe(
        Effect.map(() => undefined),
      );

    // ── Context Assembly ──

    const getContextForThread: ProjectPromptsServiceShape["getContextForThread"] = (input) =>
      Effect.gen(function* () {
        // Get all applicable prompts (global + project + thread-specific)
        const rows = yield* sql`
          SELECT id, project_id AS "projectId", thread_id AS "threadId", scope, name, content,
                 enabled, priority, created_at AS "createdAt", updated_at AS "updatedAt"
          FROM project_prompts
          WHERE enabled = 1
            AND (
              (scope = 'global' AND project_id IS NULL)
              OR (scope = 'project' AND project_id = ${input.projectId})
              OR (scope = 'thread' AND thread_id = ${input.threadId})
            )
          ORDER BY scope ASC, priority DESC
        `.pipe(Effect.catch(() => Effect.succeed([] as any[])));
        const prompts = rows as unknown as ProjectPrompt[];

        // Get active harness content
        const harness = yield* getActiveHarness({ threadId: input.threadId });

        return {
          prompts,
          harnessContent: harness?.content ?? null,
        };
      });

    return {
      createPrompt,
      listPrompts,
      updatePrompt,
      deletePrompt,
      listHarnessPresets,
      getActiveHarness,
      activateHarness,
      deactivateHarness,
      getContextForThread,
    } satisfies ProjectPromptsServiceShape;
  }),
);
