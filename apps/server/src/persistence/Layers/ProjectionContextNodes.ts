import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Option, Schema } from "effect";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";

import {
  DeleteProjectionContextNodeInput,
  GetProjectionContextNodeInput,
  ListProjectionContextNodesByProjectInput,
  ListProjectionContextNodesByThreadInput,
  ProjectionContextNode,
  ProjectionContextNodeRepository,
  type ProjectionContextNodeRepositoryShape,
} from "../Services/ProjectionContextNodes.ts";

function toPersistenceSqlOrDecodeError(sqlOp: string, decodeOp: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOp)(cause)
      : toPersistenceSqlError(sqlOp)(cause);
}

const makeRepo = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: ProjectionContextNode,
    execute: (row) =>
      sql`
        INSERT INTO projection_context_nodes (
          node_id, project_id, thread_id, type, summary, size, compressed, created_at
        ) VALUES (
          ${row.nodeId}, ${row.projectId}, ${row.threadId}, ${row.type},
          ${row.summary}, ${row.size}, ${row.compressed ? 1 : 0}, ${row.createdAt}
        )
        ON CONFLICT (node_id)
        DO UPDATE SET
          summary = excluded.summary,
          size = excluded.size,
          compressed = excluded.compressed
      `,
  });

  const selectColumns = `
    node_id AS "nodeId",
    project_id AS "projectId",
    thread_id AS "threadId",
    type,
    summary,
    size,
    compressed,
    created_at AS "createdAt"
  `;

  const getRow = SqlSchema.findOneOption({
    Request: GetProjectionContextNodeInput,
    Result: ProjectionContextNode,
    execute: ({ nodeId }) =>
      sql`SELECT ${sql.unsafe(selectColumns)} FROM projection_context_nodes WHERE node_id = ${nodeId}`,
  });

  const listByProject = SqlSchema.findAll({
    Request: ListProjectionContextNodesByProjectInput,
    Result: ProjectionContextNode,
    execute: ({ projectId }) =>
      sql`SELECT ${sql.unsafe(selectColumns)} FROM projection_context_nodes WHERE project_id = ${projectId} ORDER BY created_at ASC`,
  });

  const listByThread = SqlSchema.findAll({
    Request: ListProjectionContextNodesByThreadInput,
    Result: ProjectionContextNode,
    execute: ({ threadId }) =>
      sql`SELECT ${sql.unsafe(selectColumns)} FROM projection_context_nodes WHERE thread_id = ${threadId} ORDER BY created_at ASC`,
  });

  const deleteRow = SqlSchema.void({
    Request: DeleteProjectionContextNodeInput,
    execute: ({ nodeId }) => sql`DELETE FROM projection_context_nodes WHERE node_id = ${nodeId}`,
  });

  const upsert: ProjectionContextNodeRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(
      Effect.mapError(toPersistenceSqlOrDecodeError("upsert:query", "upsert:encode")),
    );

  const getById: ProjectionContextNodeRepositoryShape["getById"] = (input) =>
    getRow(input).pipe(
      Effect.mapError(toPersistenceSqlOrDecodeError("getById:query", "getById:decode")),
      Effect.flatMap((opt) =>
        Option.match(opt, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) => Effect.succeed(Option.some(row as ProjectionContextNode)),
        }),
      ),
    );

  const listByProjectId: ProjectionContextNodeRepositoryShape["listByProjectId"] = (input) =>
    listByProject(input).pipe(
      Effect.mapError(toPersistenceSqlOrDecodeError("listByProject:query", "listByProject:decode")),
      Effect.map((rows) => rows as ReadonlyArray<ProjectionContextNode>),
    );

  const listByThreadId: ProjectionContextNodeRepositoryShape["listByThreadId"] = (input) =>
    listByThread(input).pipe(
      Effect.mapError(toPersistenceSqlOrDecodeError("listByThread:query", "listByThread:decode")),
      Effect.map((rows) => rows as ReadonlyArray<ProjectionContextNode>),
    );

  const deleteById: ProjectionContextNodeRepositoryShape["deleteById"] = (input) =>
    deleteRow(input).pipe(Effect.mapError(toPersistenceSqlError("deleteById:query")));

  return {
    upsert,
    getById,
    listByProjectId,
    listByThreadId,
    deleteById,
  } satisfies ProjectionContextNodeRepositoryShape;
});

export const ProjectionContextNodeRepositoryLive = Layer.effect(
  ProjectionContextNodeRepository,
  makeRepo,
);
