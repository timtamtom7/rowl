import { randomUUID } from "node:crypto";
import {
  FeatureId,
  type Feature,
  type CreateFeatureInput,
  type CreateFeatureResult,
  type DeleteFeatureInput,
  type DeleteFeatureResult,
  type GetFeatureInput,
  type GetFeatureResult,
  type ListFeaturesByProjectInput,
  type ListFeaturesByProjectResult,
  type UpdateFeatureInput,
  type UpdateFeatureResult,
  type UpdateFeatureStageInput,
  type UpdateFeatureStageResult,
} from "@t3tools/contracts";
import { Effect, Layer, Option } from "effect";

import { FeatureServiceError } from "../Errors.ts";
import { FeatureService, type FeatureServiceShape } from "../Services/FeatureService.ts";
import {
  ProjectionFeatureRepository,
  type ProjectionFeature,
} from "../../persistence/Services/ProjectionFeatures.ts";

function toFeature(row: ProjectionFeature): Feature {
  return {
    id: row.featureId,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    stage: row.stage,
    ...(row.threadId ? { threadId: row.threadId } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
  } as Feature;
}

export const FeatureServiceLive = Layer.effect(
  FeatureService,
  Effect.gen(function* () {
    const featureRepo = yield* ProjectionFeatureRepository;

    const requireFeature = (featureId: FeatureId, operation: string) =>
      featureRepo.getById({ featureId }).pipe(
        Effect.mapError(
          (cause) => new FeatureServiceError({ operation, detail: String(cause), cause }),
        ),
        Effect.flatMap((opt) =>
          Option.match(opt, {
            onNone: () =>
              Effect.fail(
                new FeatureServiceError({ operation, detail: `Feature '${featureId}' not found.` }),
              ),
            onSome: Effect.succeed,
          }),
        ),
      );

    const createFeature: FeatureServiceShape["createFeature"] = (input: CreateFeatureInput) =>
      Effect.gen(function* () {
        const featureId = FeatureId.makeUnsafe(randomUUID());
        const now = new Date().toISOString();
        const row: ProjectionFeature = {
          featureId,
          projectId: input.projectId,
          name: input.name,
          description: input.description ?? "",
          stage: input.stage,
          threadId: input.threadId ?? null,
          createdAt: now,
          updatedAt: now,
          createdBy: input.createdBy,
        } as ProjectionFeature;

        yield* featureRepo.upsert(row).pipe(
          Effect.mapError(
            (cause) =>
              new FeatureServiceError({
                operation: "createFeature",
                detail: String(cause),
                cause,
              }),
          ),
        );
        return { feature: toFeature(row) } satisfies CreateFeatureResult;
      });

    const getFeature: FeatureServiceShape["getFeature"] = (input: GetFeatureInput) =>
      Effect.gen(function* () {
        const row = yield* requireFeature(input.id, "getFeature");
        return { feature: toFeature(row) } satisfies GetFeatureResult;
      });

    const listFeaturesByProject: FeatureServiceShape["listFeaturesByProject"] = (
      input: ListFeaturesByProjectInput,
    ) =>
      featureRepo.listByProjectId({ projectId: input.projectId }).pipe(
        Effect.map((rows) => ({ features: rows.map(toFeature) })),
        Effect.mapError(
          (cause) =>
            new FeatureServiceError({
              operation: "listFeaturesByProject",
              detail: String(cause),
              cause,
            }),
        ),
      ) as Effect.Effect<ListFeaturesByProjectResult, FeatureServiceError>;

    const updateFeature: FeatureServiceShape["updateFeature"] = (input: UpdateFeatureInput) =>
      Effect.gen(function* () {
        const row = yield* requireFeature(input.id, "updateFeature");
        const updated = {
          ...row,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.threadId !== undefined ? { threadId: input.threadId } : {}),
          updatedAt: new Date().toISOString(),
        } as ProjectionFeature;
        yield* featureRepo.upsert(updated).pipe(
          Effect.mapError(
            (cause) =>
              new FeatureServiceError({
                operation: "updateFeature",
                detail: String(cause),
                cause,
              }),
          ),
        );
        return { feature: toFeature(updated) } satisfies UpdateFeatureResult;
      });

    const updateFeatureStage: FeatureServiceShape["updateFeatureStage"] = (
      input: UpdateFeatureStageInput,
    ) =>
      Effect.gen(function* () {
        const row = yield* requireFeature(input.id, "updateFeatureStage");
        const updated = {
          ...row,
          stage: input.stage,
          updatedAt: new Date().toISOString(),
        } as ProjectionFeature;
        yield* featureRepo.upsert(updated).pipe(
          Effect.mapError(
            (cause) =>
              new FeatureServiceError({
                operation: "updateFeatureStage",
                detail: String(cause),
                cause,
              }),
          ),
        );
        return { feature: toFeature(updated) } satisfies UpdateFeatureStageResult;
      });

    const deleteFeature: FeatureServiceShape["deleteFeature"] = (input: DeleteFeatureInput) =>
      featureRepo.deleteById({ featureId: input.id }).pipe(
        Effect.map(() => ({}) satisfies DeleteFeatureResult),
        Effect.mapError(
          (cause) =>
            new FeatureServiceError({ operation: "deleteFeature", detail: String(cause), cause }),
        ),
      );

    return {
      createFeature,
      getFeature,
      listFeaturesByProject,
      updateFeature,
      updateFeatureStage,
      deleteFeature,
    } satisfies FeatureServiceShape;
  }),
);
