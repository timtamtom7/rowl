import { Schema } from "effect";

import {
  CheckpointRef,
  IsoDateTime,
  NonNegativeInt,
  TrimmedNonEmptyString,
  TurnId,
} from "./baseSchemas";

const TrimmedNonEmptyStringSchema = TrimmedNonEmptyString;

export const DiffTreeNodeType = Schema.Literals(["added", "modified", "deleted", "renamed"]);
export type DiffTreeNodeType = typeof DiffTreeNodeType.Type;

export const DiffTreeNode = Schema.Struct({
  path: TrimmedNonEmptyStringSchema,
  type: DiffTreeNodeType,
  hunks: NonNegativeInt,
  insertions: NonNegativeInt,
  deletions: NonNegativeInt,
});
export type DiffTreeNode = typeof DiffTreeNode.Type;

export const DiffTreeSummary = Schema.Struct({
  totalFiles: NonNegativeInt,
  totalInsertions: NonNegativeInt,
  totalDeletions: NonNegativeInt,
});
export type DiffTreeSummary = typeof DiffTreeSummary.Type;

export const DiffTree = Schema.Struct({
  turnId: Schema.NullOr(TurnId),
  timestamp: IsoDateTime,
  nodes: Schema.Array(DiffTreeNode),
  summary: DiffTreeSummary,
});
export type DiffTree = typeof DiffTree.Type;

export const GitGetDiffTreeInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  fromRef: Schema.optional(TrimmedNonEmptyStringSchema),
  toRef: Schema.optional(TrimmedNonEmptyStringSchema),
  checkpointRef: Schema.optional(CheckpointRef),
  fromCheckpointRef: Schema.optional(CheckpointRef),
  toCheckpointRef: Schema.optional(CheckpointRef),
  turnId: Schema.optional(TurnId),
});
export type GitGetDiffTreeInput = typeof GitGetDiffTreeInput.Type;
