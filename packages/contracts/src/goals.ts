import { Schema } from "effect";

import { IsoDateTime, ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas";

export const GoalId = TrimmedNonEmptyString.pipe(Schema.brand("GoalId"));
export type GoalId = typeof GoalId.Type;

export const GoalStatus = Schema.Literals(["planned", "active", "achieved", "cancelled"]);
export type GoalStatus = typeof GoalStatus.Type;

export const GoalLevel = Schema.Literals(["company", "team", "agent", "task"]);
export type GoalLevel = typeof GoalLevel.Type;

const DefaultGoalStatus = GoalStatus.pipe(Schema.withDecodingDefault(() => "active" as const));
const DefaultGoalLevel = GoalLevel.pipe(Schema.withDecodingDefault(() => "task" as const));

export const Goal = Schema.Struct({
  id: GoalId,
  projectId: ProjectId,
  text: TrimmedNonEmptyString,
  isMain: Schema.Boolean,
  linkedThreadIds: Schema.Array(ThreadId),
  parentId: Schema.optional(GoalId),
  status: DefaultGoalStatus,
  level: DefaultGoalLevel,
  ownerAgentId: Schema.optional(TrimmedNonEmptyString),
  description: Schema.optional(TrimmedNonEmptyString),
  createdAt: IsoDateTime,
});
export type Goal = typeof Goal.Type;

export const CreateGoalInput = Schema.Struct({
  projectId: ProjectId,
  text: TrimmedNonEmptyString,
  isMain: Schema.Boolean,
  parentId: Schema.optional(GoalId),
  status: Schema.optional(GoalStatus),
  level: Schema.optional(GoalLevel),
  ownerAgentId: Schema.optional(TrimmedNonEmptyString),
  description: Schema.optional(TrimmedNonEmptyString),
});
export type CreateGoalInput = typeof CreateGoalInput.Type;

export const CreateGoalResult = Schema.Struct({
  goal: Goal,
});
export type CreateGoalResult = typeof CreateGoalResult.Type;

export const GetGoalInput = Schema.Struct({
  id: GoalId,
});
export type GetGoalInput = typeof GetGoalInput.Type;

export const GetGoalResult = Schema.Struct({
  goal: Goal,
});
export type GetGoalResult = typeof GetGoalResult.Type;

export const ListGoalsByProjectInput = Schema.Struct({
  projectId: ProjectId,
});
export type ListGoalsByProjectInput = typeof ListGoalsByProjectInput.Type;

export const ListGoalsByProjectResult = Schema.Struct({
  goals: Schema.Array(Goal),
});
export type ListGoalsByProjectResult = typeof ListGoalsByProjectResult.Type;

export const UpdateGoalInput = Schema.Struct({
  id: GoalId,
  text: Schema.optional(TrimmedNonEmptyString),
  isMain: Schema.optional(Schema.Boolean),
  linkedThreadIds: Schema.optional(Schema.Array(ThreadId)),
  parentId: Schema.optional(Schema.NullOr(GoalId)),
  status: Schema.optional(GoalStatus),
  level: Schema.optional(GoalLevel),
  ownerAgentId: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  description: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
});
export type UpdateGoalInput = typeof UpdateGoalInput.Type;

export const UpdateGoalResult = Schema.Struct({
  goal: Goal,
});
export type UpdateGoalResult = typeof UpdateGoalResult.Type;

export const GetGoalChildrenInput = Schema.Struct({
  parentId: GoalId,
});
export type GetGoalChildrenInput = typeof GetGoalChildrenInput.Type;

export const GetGoalChildrenResult = Schema.Struct({
  goals: Schema.Array(Goal),
});
export type GetGoalChildrenResult = typeof GetGoalChildrenResult.Type;

export const GetGoalAncestorsInput = Schema.Struct({
  id: GoalId,
});
export type GetGoalAncestorsInput = typeof GetGoalAncestorsInput.Type;

export const GetGoalAncestorsResult = Schema.Struct({
  goals: Schema.Array(Goal),
});
export type GetGoalAncestorsResult = typeof GetGoalAncestorsResult.Type;

export const SetMainGoalInput = Schema.Struct({
  id: GoalId,
  isMain: Schema.Boolean,
});
export type SetMainGoalInput = typeof SetMainGoalInput.Type;

export const SetMainGoalResult = Schema.Struct({
  goal: Goal,
});
export type SetMainGoalResult = typeof SetMainGoalResult.Type;

export const LinkThreadToGoalInput = Schema.Struct({
  goalId: GoalId,
  threadId: ThreadId,
});
export type LinkThreadToGoalInput = typeof LinkThreadToGoalInput.Type;

export const LinkThreadToGoalResult = Schema.Struct({
  goal: Goal,
});
export type LinkThreadToGoalResult = typeof LinkThreadToGoalResult.Type;

export const UnlinkThreadFromGoalInput = Schema.Struct({
  goalId: GoalId,
  threadId: ThreadId,
});
export type UnlinkThreadFromGoalInput = typeof UnlinkThreadFromGoalInput.Type;

export const UnlinkThreadFromGoalResult = Schema.Struct({
  goal: Goal,
});
export type UnlinkThreadFromGoalResult = typeof UnlinkThreadFromGoalResult.Type;

export const UpdateGoalTextInput = Schema.Struct({
  id: GoalId,
  text: TrimmedNonEmptyString,
});
export type UpdateGoalTextInput = typeof UpdateGoalTextInput.Type;

export const UpdateGoalTextResult = Schema.Struct({
  goal: Goal,
});
export type UpdateGoalTextResult = typeof UpdateGoalTextResult.Type;

export const DeleteGoalInput = Schema.Struct({
  id: GoalId,
});
export type DeleteGoalInput = typeof DeleteGoalInput.Type;

export const DeleteGoalResult = Schema.Struct({});
export type DeleteGoalResult = typeof DeleteGoalResult.Type;
