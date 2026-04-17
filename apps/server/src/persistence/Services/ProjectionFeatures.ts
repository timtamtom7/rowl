import { FeatureId, FeatureStage, IsoDateTime, ProjectId, ThreadId } from "@t3tools/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ProjectionFeature = Schema.Struct({
  featureId: FeatureId,
  projectId: ProjectId,
  name: Schema.String,
  description: Schema.String,
  stage: FeatureStage,
  threadId: Schema.NullOr(ThreadId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  createdBy: Schema.Literals(["user", "pm"]),
});
export type ProjectionFeature = typeof ProjectionFeature.Type;

export const GetProjectionFeatureInput = Schema.Struct({ featureId: FeatureId });
export type GetProjectionFeatureInput = typeof GetProjectionFeatureInput.Type;

export const ListProjectionFeaturesByProjectInput = Schema.Struct({ projectId: ProjectId });
export type ListProjectionFeaturesByProjectInput = typeof ListProjectionFeaturesByProjectInput.Type;

export const DeleteProjectionFeatureInput = Schema.Struct({ featureId: FeatureId });
export type DeleteProjectionFeatureInput = typeof DeleteProjectionFeatureInput.Type;

export interface ProjectionFeatureRepositoryShape {
  readonly upsert: (row: ProjectionFeature) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    input: GetProjectionFeatureInput,
  ) => Effect.Effect<Option.Option<ProjectionFeature>, ProjectionRepositoryError>;
  readonly listByProjectId: (
    input: ListProjectionFeaturesByProjectInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionFeature>, ProjectionRepositoryError>;
  readonly deleteById: (
    input: DeleteProjectionFeatureInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class ProjectionFeatureRepository extends ServiceMap.Service<
  ProjectionFeatureRepository,
  ProjectionFeatureRepositoryShape
>()("rowl/persistence/Services/ProjectionFeatures/ProjectionFeatureRepository") {}
