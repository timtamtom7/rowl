import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { DiffTree, GitGetDiffTreeInput, TurnId } from "@t3tools/contracts";

import type { GitCommandError } from "./Errors.ts";

export interface GetDiffTreeBetweenRefsInput {
  readonly cwd: string;
  readonly fromRef: string;
  readonly toRef: string;
  readonly turnId?: TurnId | undefined;
}

export interface GetCheckpointDiffTreeInput {
  readonly cwd: string;
  readonly checkpointRef: string;
  readonly baseRef?: string | undefined;
  readonly turnId?: TurnId | undefined;
}

export interface DiffTreeServiceShape {
  readonly getDiffTree: (input: GitGetDiffTreeInput) => Effect.Effect<DiffTree, GitCommandError>;
  readonly getDiffTreeBetweenRefs: (
    input: GetDiffTreeBetweenRefsInput,
  ) => Effect.Effect<DiffTree, GitCommandError>;
  readonly getCheckpointDiffTree: (
    input: GetCheckpointDiffTreeInput,
  ) => Effect.Effect<DiffTree, GitCommandError>;
}

export class DiffTreeService extends ServiceMap.Service<DiffTreeService, DiffTreeServiceShape>()(
  "rowl/git/DiffTreeService",
) {}
