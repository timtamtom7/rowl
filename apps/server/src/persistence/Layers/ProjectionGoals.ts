import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Option, Schema, Struct } from "effect";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";
import { ThreadId } from "@t3tools/contracts";

import {
  DeleteProjectionGoalInput,
  GetProjectionGoalInput,
  ListProjectionGoalsByProjectInput,
  ProjectionGoal,
  ProjectionGoalRepository,
  type ProjectionGoalRepositoryShape,
} from "../Services/ProjectionGoals.ts";

const ProjectionGoalDbRowSchema = ProjectionGoal.mapFields(
  Struct.assign({
    linkedThreadIds: Schema.fromJsonString(Schema.Array(ThreadId)),
  }),
);

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

const makeProjectionGoalRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertGoalRow = SqlSchema.void({
    Request: ProjectionGoalDbRowSchema,
    execute: (row) =>
      sql`
        INSERT INTO projection_goals (
          goal_id, project_id, text, is_main, linked_thread_ids_json, created_at
        ) VALUES (
          ${row.goalId}, ${row.projectId}, ${row.text},
          ${row.isMain ? 1 : 0}, ${row.linkedThreadIds}, ${row.createdAt}
        )
        ON CONFLICT (goal_id)
        DO UPDATE SET
          text = excluded.text,
          is_main = excluded.is_main,
          linked_thread_ids_json = excluded.linked_thread_ids_json
      `,
  });

  const getGoalRow = SqlSchema.findOneOption({
    Request: GetProjectionGoalInput,
    Result: ProjectionGoalDbRowSchema,
    execute: ({ goalId }) =>
      sql`
        SELECT
          goal_id AS "goalId",
          project_id AS "projectId",
          text,
          is_main AS "isMain",
          linked_thread_ids_json AS "linkedThreadIds",
          created_at AS "createdAt"
        FROM projection_goals
        WHERE goal_id = ${goalId}
      `,
  });

  const listGoalRows = SqlSchema.findAll({
    Request: ListProjectionGoalsByProjectInput,
    Result: ProjectionGoalDbRowSchema,
    execute: ({ projectId }) =>
      sql`
        SELECT
          goal_id AS "goalId",
          project_id AS "projectId",
          text,
          is_main AS "isMain",
          linked_thread_ids_json AS "linkedThreadIds",
          created_at AS "createdAt"
        FROM projection_goals
        WHERE project_id = ${projectId}
        ORDER BY is_main DESC, created_at ASC
      `,
  });

  const deleteGoalRow = SqlSchema.void({
    Request: DeleteProjectionGoalInput,
    execute: ({ goalId }) => sql`DELETE FROM projection_goals WHERE goal_id = ${goalId}`,
  });

  const upsert: ProjectionGoalRepositoryShape["upsert"] = (row) =>
    upsertGoalRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionGoalRepository.upsert:query",
          "ProjectionGoalRepository.upsert:encodeRequest",
        ),
      ),
    );

  const getById: ProjectionGoalRepositoryShape["getById"] = (input) =>
    getGoalRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionGoalRepository.getById:query",
          "ProjectionGoalRepository.getById:decodeRow",
        ),
      ),
      Effect.flatMap((rowOption) =>
        Option.match(rowOption, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) =>
            Effect.succeed(Option.some(row as Schema.Schema.Type<typeof ProjectionGoal>)),
        }),
      ),
    );

  const listByProjectId: ProjectionGoalRepositoryShape["listByProjectId"] = (input) =>
    listGoalRows(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionGoalRepository.listByProjectId:query",
          "ProjectionGoalRepository.listByProjectId:decodeRows",
        ),
      ),
      Effect.map((rows) => rows as ReadonlyArray<Schema.Schema.Type<typeof ProjectionGoal>>),
    );

  const deleteById: ProjectionGoalRepositoryShape["deleteById"] = (input) =>
    deleteGoalRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionGoalRepository.deleteById:query")),
    );

  const clearMainGoalForProject: ProjectionGoalRepositoryShape["clearMainGoalForProject"] = (
    input,
  ) =>
    sql`
      UPDATE projection_goals
      SET is_main = 0
      WHERE project_id = ${input.projectId}
        AND goal_id != ${input.exceptGoalId}
        AND is_main = 1
    `.pipe(
      Effect.asVoid,
      Effect.mapError(
        toPersistenceSqlError("ProjectionGoalRepository.clearMainGoalForProject:query"),
      ),
    );

  return {
    upsert,
    getById,
    listByProjectId,
    deleteById,
    clearMainGoalForProject,
  } satisfies ProjectionGoalRepositoryShape;
});

export const ProjectionGoalRepositoryLive = Layer.effect(
  ProjectionGoalRepository,
  makeProjectionGoalRepository,
);
