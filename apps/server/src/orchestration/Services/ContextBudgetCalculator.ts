/**
 * ContextBudgetCalculator — Service interface for measuring context budget usage.
 *
 * Calculates approximate token counts per section of the assembled context,
 * providing a breakdown of where context budget is consumed. This powers
 * the budget ring visualization and informs trimming decisions.
 *
 * @module ContextBudgetCalculator
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

export interface ContextBudgetBreakdown {
  /** Approximate tokens consumed by AGENTS.md workspace instructions */
  readonly agentsMd: number;
  /** Approximate tokens consumed by project context (brief, goals, features, thread goal) */
  readonly projectContext: number;
  /** Approximate tokens consumed by resume/compaction summary */
  readonly resumeSummary: number;
  /** Approximate tokens consumed by selected skills */
  readonly skills: number;
  /** Approximate tokens consumed by user message text */
  readonly userMessage: number;
  /** Sum of all Rowl-controlled sections */
  readonly totalRowlContext: number;
  /** Provider-reported total tokens used (if available from last turn) */
  readonly lastReportedTotal: number | null;
  /** Provider-reported context window limit (if known) */
  readonly contextWindowLimit: number | null;
  /** Percentage of context window used (0-100, null if limit unknown) */
  readonly usagePercent: number | null;
}

export interface ContextBudgetCalculatorShape {
  /**
   * Calculate the context budget breakdown for a thread's next turn.
   * This estimates what the context would look like IF a turn were sent right now.
   */
  readonly estimateForThread: (input: {
    readonly threadId: ThreadId;
    readonly projectId: ProjectId;
  }) => Effect.Effect<ContextBudgetBreakdown>;
}

export class ContextBudgetCalculator extends ServiceMap.Service<
  ContextBudgetCalculator,
  ContextBudgetCalculatorShape
>()("rowl/orchestration/Services/ContextBudgetCalculator") {}
