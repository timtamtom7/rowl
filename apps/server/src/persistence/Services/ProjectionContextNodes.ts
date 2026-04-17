import { ContextNodeId, IsoDateTime, ProjectId, ThreadId } from "@t3tools/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ContextNodeType = Schema.Literals(["messages", "file", "artifact", "memory"]);

export const ProjectionContextNode = Schema.Struct({
  nodeId: ContextNodeId,
  projectId: ProjectId,
  threadId: ThreadId,
  type: ContextNodeType,
  summary: Schema.String,
  size: Schema.Number,
  compressed: Schema.Boolean,
  createdAt: IsoDateTime,
});
export type ProjectionContextNode = typeof ProjectionContextNode.Type;

export const GetProjectionContextNodeInput = Schema.Struct({ nodeId: ContextNodeId });
export type GetProjectionContextNodeInput = typeof GetProjectionContextNodeInput.Type;

export const ListProjectionContextNodesByProjectInput = Schema.Struct({ projectId: ProjectId });
export type ListProjectionContextNodesByProjectInput =
  typeof ListProjectionContextNodesByProjectInput.Type;

export const ListProjectionContextNodesByThreadInput = Schema.Struct({ threadId: ThreadId });
export type ListProjectionContextNodesByThreadInput =
  typeof ListProjectionContextNodesByThreadInput.Type;

export const DeleteProjectionContextNodeInput = Schema.Struct({ nodeId: ContextNodeId });
export type DeleteProjectionContextNodeInput = typeof DeleteProjectionContextNodeInput.Type;

export interface ProjectionContextNodeRepositoryShape {
  readonly upsert: (row: ProjectionContextNode) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    input: GetProjectionContextNodeInput,
  ) => Effect.Effect<Option.Option<ProjectionContextNode>, ProjectionRepositoryError>;
  readonly listByProjectId: (
    input: ListProjectionContextNodesByProjectInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionContextNode>, ProjectionRepositoryError>;
  readonly listByThreadId: (
    input: ListProjectionContextNodesByThreadInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionContextNode>, ProjectionRepositoryError>;
  readonly deleteById: (
    input: DeleteProjectionContextNodeInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class ProjectionContextNodeRepository extends ServiceMap.Service<
  ProjectionContextNodeRepository,
  ProjectionContextNodeRepositoryShape
>()("rowl/persistence/Services/ProjectionContextNodes/ProjectionContextNodeRepository") {}
