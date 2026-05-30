import { Schema } from "effect";

import { CheckpointRef, IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas";
import { WorktreeInfo } from "./git";

const TrimmedNonEmptyStringSchema = TrimmedNonEmptyString;

export const WorktreeCheckpoint = Schema.Struct({
  checkpointRef: CheckpointRef,
  worktreeBranch: TrimmedNonEmptyStringSchema,
  worktreePath: TrimmedNonEmptyStringSchema,
  head: TrimmedNonEmptyStringSchema,
  message: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
  createdAt: IsoDateTime,
});
export type WorktreeCheckpoint = typeof WorktreeCheckpoint.Type;

export const CreateWorktreeCheckpointInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  worktreeBranch: TrimmedNonEmptyStringSchema,
  checkpointRef: Schema.optional(CheckpointRef),
  message: Schema.optional(TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(10_000))),
});
export type CreateWorktreeCheckpointInput = typeof CreateWorktreeCheckpointInput.Type;

export const ListWorktreeCheckpointsInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  worktreeBranch: TrimmedNonEmptyStringSchema,
});
export type ListWorktreeCheckpointsInput = typeof ListWorktreeCheckpointsInput.Type;

export const WorktreeCheckpointResult = Schema.Struct({
  checkpoint: WorktreeCheckpoint,
  worktree: WorktreeInfo,
  branch: Schema.Struct({
    name: TrimmedNonEmptyStringSchema,
    head: TrimmedNonEmptyStringSchema,
  }),
});
export type WorktreeCheckpointResult = typeof WorktreeCheckpointResult.Type;

export const ListWorktreeCheckpointsResult = Schema.Struct({
  checkpoints: Schema.Array(WorktreeCheckpoint),
  worktree: WorktreeInfo,
});
export type ListWorktreeCheckpointsResult = typeof ListWorktreeCheckpointsResult.Type;
