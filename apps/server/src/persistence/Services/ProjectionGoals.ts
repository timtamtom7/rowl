import { GoalId, IsoDateTime, ProjectId, ThreadId } from "@t3tools/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ProjectionGoal = Schema.Struct({
  goalId: GoalId,
  projectId: ProjectId,
  text: Schema.String,
  isMain: Schema.Boolean,
  linkedThreadIds: Schema.Array(ThreadId),
  createdAt: IsoDateTime,
});
export type ProjectionGoal = typeof ProjectionGoal.Type;

export const GetProjectionGoalInput = Schema.Struct({
  goalId: GoalId,
});
export type GetProjectionGoalInput = typeof GetProjectionGoalInput.Type;

export const ListProjectionGoalsByProjectInput = Schema.Struct({
  projectId: ProjectId,
});
export type ListProjectionGoalsByProjectInput = typeof ListProjectionGoalsByProjectInput.Type;

export const DeleteProjectionGoalInput = Schema.Struct({
  goalId: GoalId,
});
export type DeleteProjectionGoalInput = typeof DeleteProjectionGoalInput.Type;

export interface ProjectionGoalRepositoryShape {
  readonly upsert: (row: ProjectionGoal) => Effect.Effect<void, ProjectionRepositoryError>;

  readonly getById: (
    input: GetProjectionGoalInput,
  ) => Effect.Effect<Option.Option<ProjectionGoal>, ProjectionRepositoryError>;

  readonly listByProjectId: (
    input: ListProjectionGoalsByProjectInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionGoal>, ProjectionRepositoryError>;

  readonly deleteById: (
    input: DeleteProjectionGoalInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;

  readonly clearMainGoalForProject: (input: {
    projectId: ProjectId;
    exceptGoalId: GoalId;
  }) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class ProjectionGoalRepository extends ServiceMap.Service<
  ProjectionGoalRepository,
  ProjectionGoalRepositoryShape
>()("rowl/persistence/Services/ProjectionGoals/ProjectionGoalRepository") {}
