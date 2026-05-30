/**
 * WorktreeCheckpointService - Worktree-aware checkpoint operations.
 *
 * Coordinates managed worktrees, hidden checkpoint refs, and branch integration
 * operations for stacked branch / PR workflows.
 *
 * @module WorktreeCheckpointService
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type {
  CreateWorktreeCheckpointInput,
  ListWorktreeCheckpointsInput,
  ListWorktreeCheckpointsResult,
  StackBranchInput,
  StackBranchResult,
  WorktreeCheckpointResult,
} from "@t3tools/contracts";

import type { CheckpointStoreError } from "../Errors.ts";
import type { GitCommandError, WorktreeServiceErrorType } from "../../git/Errors.ts";

export interface CherryPickCheckpointToMainInput {
  readonly cwd: string;
  readonly checkpointRef: string;
  readonly targetBranch?: string | undefined;
}

export interface MergeWorktreeBranchInput {
  readonly cwd: string;
  readonly branch: string;
  readonly targetBranch?: string | undefined;
}

export type WorktreeCheckpointServiceError =
  | CheckpointStoreError
  | GitCommandError
  | WorktreeServiceErrorType;

export interface WorktreeCheckpointServiceShape {
  readonly createCheckpointInWorktree: (
    input: CreateWorktreeCheckpointInput,
  ) => Effect.Effect<WorktreeCheckpointResult, WorktreeCheckpointServiceError>;
  readonly listCheckpointsByWorktree: (
    input: ListWorktreeCheckpointsInput,
  ) => Effect.Effect<ListWorktreeCheckpointsResult, WorktreeCheckpointServiceError>;
  readonly cherryPickCheckpointToMain: (
    input: CherryPickCheckpointToMainInput,
  ) => Effect.Effect<{ status: "applied"; head: string }, WorktreeCheckpointServiceError>;
  readonly mergeWorktreeBranch: (
    input: MergeWorktreeBranchInput,
  ) => Effect.Effect<{ status: "applied"; head: string }, WorktreeCheckpointServiceError>;
  readonly createStackedBranch: (
    input: StackBranchInput,
  ) => Effect.Effect<StackBranchResult, WorktreeCheckpointServiceError>;
}

export class WorktreeCheckpointService extends ServiceMap.Service<
  WorktreeCheckpointService,
  WorktreeCheckpointServiceShape
>()("rowl/checkpointing/Services/WorktreeCheckpointService") {}
