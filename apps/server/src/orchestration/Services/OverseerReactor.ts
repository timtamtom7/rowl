/**
 * OverseerReactor - Background monitoring service for the entire product building workflow.
 *
 * Watches provider runtime events and orchestration domain events to detect:
 * - Agent-level issues (capability forgetfulness, technical delegation, loops, dangerous commands)
 * - Product-level issues (stale goals, stuck features, context exhaustion)
 * - Session health (degradation, error patterns)
 *
 * When issues are detected, appends activities to the timeline so non-coders
 * can see what's happening without understanding code.
 *
 * @module OverseerReactor
 */
import { ServiceMap } from "effect";
import type { Effect, Scope } from "effect";

export interface OverseerReactorShape {
  /**
   * Start the Overseer reactor.
   * Must be run in a scope so worker fibers can be finalized on shutdown.
   */
  readonly start: Effect.Effect<void, never, Scope.Scope>;

  /**
   * Resolves when the internal processing queue is empty and idle.
   */
  readonly drain: Effect.Effect<void>;
}

export class OverseerReactor extends ServiceMap.Service<OverseerReactor, OverseerReactorShape>()(
  "rowl/orchestration/Services/OverseerReactor",
) {}
