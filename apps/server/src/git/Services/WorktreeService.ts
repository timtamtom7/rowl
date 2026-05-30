/**
 * WorktreeService - Managed Git worktree isolation for parallel agents.
 *
 * Owns Rowl-created worktrees under `{projectRoot}/.rowl/worktrees`.
 *
 * @module WorktreeService
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type {
  CreateWorktreeInput,
  CreateWorktreeResult,
  GetWorktreeInfoInput,
  ListWorktreesInput,
  ListWorktreesResult,
  RemoveWorktreeInput,
  WorktreeInfo,
} from "@t3tools/contracts";

import type { WorktreeServiceErrorType } from "../Errors.ts";

export interface WorktreeServiceShape {
  readonly createWorktree: (
    input: CreateWorktreeInput,
  ) => Effect.Effect<CreateWorktreeResult, WorktreeServiceErrorType>;
  readonly listWorktrees: (
    input: ListWorktreesInput,
  ) => Effect.Effect<ListWorktreesResult, WorktreeServiceErrorType>;
  readonly removeWorktree: (
    input: RemoveWorktreeInput,
  ) => Effect.Effect<void, WorktreeServiceErrorType>;
  readonly getWorktreeInfo: (
    input: GetWorktreeInfoInput,
  ) => Effect.Effect<WorktreeInfo, WorktreeServiceErrorType>;
}

export class WorktreeService extends ServiceMap.Service<
  WorktreeService,
  WorktreeServiceShape
>()("rowl/git/Services/WorktreeService") {}
