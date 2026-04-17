import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Option, Schema } from "effect";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";

import {
  DeleteProjectionFeatureInput,
  GetProjectionFeatureInput,
  ListProjectionFeaturesByProjectInput,
  ProjectionFeature,
  ProjectionFeatureRepository,
  type ProjectionFeatureRepositoryShape,
} from "../Services/ProjectionFeatures.ts";

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

const makeProjectionFeatureRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertFeatureRow = SqlSchema.void({
    Request: ProjectionFeature,
    execute: (row) =>
      sql`
        INSERT INTO projection_features (
          feature_id, project_id, name, description, stage, thread_id, created_at, updated_at, created_by
        ) VALUES (
          ${row.featureId}, ${row.projectId}, ${row.name}, ${row.description},
          ${row.stage}, ${row.threadId}, ${row.createdAt}, ${row.updatedAt}, ${row.createdBy}
        )
        ON CONFLICT (feature_id)
        DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          stage = excluded.stage,
          thread_id = excluded.thread_id,
          updated_at = excluded.updated_at
      `,
  });

  const getFeatureRow = SqlSchema.findOneOption({
    Request: GetProjectionFeatureInput,
    Result: ProjectionFeature,
    execute: ({ featureId }) =>
      sql`
        SELECT
          feature_id AS "featureId",
          project_id AS "projectId",
          name,
          description,
          stage,
          thread_id AS "threadId",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          created_by AS "createdBy"
        FROM projection_features
        WHERE feature_id = ${featureId}
      `,
  });

  const listFeatureRows = SqlSchema.findAll({
    Request: ListProjectionFeaturesByProjectInput,
    Result: ProjectionFeature,
    execute: ({ projectId }) =>
      sql`
        SELECT
          feature_id AS "featureId",
          project_id AS "projectId",
          name,
          description,
          stage,
          thread_id AS "threadId",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          created_by AS "createdBy"
        FROM projection_features
        WHERE project_id = ${projectId}
        ORDER BY created_at ASC
      `,
  });

  const deleteFeatureRow = SqlSchema.void({
    Request: DeleteProjectionFeatureInput,
    execute: ({ featureId }) =>
      sql`DELETE FROM projection_features WHERE feature_id = ${featureId}`,
  });

  const upsert: ProjectionFeatureRepositoryShape["upsert"] = (row) =>
    upsertFeatureRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionFeatureRepository.upsert:query",
          "ProjectionFeatureRepository.upsert:encodeRequest",
        ),
      ),
    );

  const getById: ProjectionFeatureRepositoryShape["getById"] = (input) =>
    getFeatureRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionFeatureRepository.getById:query",
          "ProjectionFeatureRepository.getById:decodeRow",
        ),
      ),
      Effect.flatMap((rowOption) =>
        Option.match(rowOption, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) =>
            Effect.succeed(Option.some(row as Schema.Schema.Type<typeof ProjectionFeature>)),
        }),
      ),
    );

  const listByProjectId: ProjectionFeatureRepositoryShape["listByProjectId"] = (input) =>
    listFeatureRows(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionFeatureRepository.listByProjectId:query",
          "ProjectionFeatureRepository.listByProjectId:decodeRows",
        ),
      ),
      Effect.map((rows) => rows as ReadonlyArray<Schema.Schema.Type<typeof ProjectionFeature>>),
    );

  const deleteById: ProjectionFeatureRepositoryShape["deleteById"] = (input) =>
    deleteFeatureRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionFeatureRepository.deleteById:query")),
    );

  return {
    upsert,
    getById,
    listByProjectId,
    deleteById,
  } satisfies ProjectionFeatureRepositoryShape;
});

export const ProjectionFeatureRepositoryLive = Layer.effect(
  ProjectionFeatureRepository,
  makeProjectionFeatureRepository,
);
