/**
 * HandoffService — Service interface for structured thread handoffs.
 *
 * @module HandoffService
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

export interface HandoffBriefing {
  readonly threadTitle: string;
  readonly briefingText: string;
  readonly suggestedNewThreadTitle: string;
  readonly memoriesExtracted: number;
}

export interface HandoffServiceShape {
  readonly generateBriefing: (input: {
    readonly threadId: ThreadId;
    readonly projectId: ProjectId;
  }) => Effect.Effect<HandoffBriefing>;
}

export class HandoffService extends ServiceMap.Service<HandoffService, HandoffServiceShape>()(
  "rowl/orchestration/Services/HandoffService",
) {}
