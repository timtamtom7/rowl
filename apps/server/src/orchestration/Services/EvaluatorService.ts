/**
 * EvaluatorService — Separate verification agent that checks builder claims.
 *
 * Anthropic's insight: "Models cannot reliably evaluate their own work."
 * Solution: After a builder agent claims completion, spawn a lightweight
 * evaluator that independently verifies the work.
 *
 * The evaluator checks:
 * 1. Does the code compile? (typecheck)
 * 2. Do tests pass? (test runner)
 * 3. Were all requirements addressed? (spec compliance)
 * 4. Are there obvious issues? (code review patterns)
 *
 * Results are surfaced as Overseer activities so the user sees:
 * "Builder says done. Evaluator says: build passes, 2 tests fail."
 *
 * @module EvaluatorService
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

export interface EvaluationResult {
  readonly threadId: ThreadId;
  readonly status: "pass" | "partial" | "fail";
  readonly checks: ReadonlyArray<{
    name: string;
    status: "pass" | "fail" | "skipped";
    detail: string;
  }>;
  readonly summary: string;
  readonly timestamp: string;
}

export interface EvaluatorServiceShape {
  /**
   * Evaluate the work done in a thread after the builder claims completion.
   * Returns structured results that get surfaced in the UI.
   */
  readonly evaluateThread: (input: {
    readonly threadId: ThreadId;
    readonly projectId: ProjectId;
    readonly claimedWork: string; // What the builder said it did
  }) => Effect.Effect<EvaluationResult>;

  /**
   * Quick check — just verify compilation status for a project.
   * Lighter than full evaluation.
   */
  readonly quickCheck: (input: {
    readonly projectId: ProjectId;
  }) => Effect.Effect<{
    compiles: boolean;
    errors: ReadonlyArray<string>;
  }>;
}

export class EvaluatorService extends ServiceMap.Service<
  EvaluatorService,
  EvaluatorServiceShape
>()("rowl/orchestration/Services/EvaluatorService") {}
