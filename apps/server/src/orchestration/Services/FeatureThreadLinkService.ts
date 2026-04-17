/**
 * FeatureThreadLinkService — Manages explicit links between features and threads.
 *
 * When the PM spawns an agent for a feature, the thread gets linked.
 * When a user manually assigns a thread to a feature, it gets linked.
 * Links enable: feature cards showing which thread is building them,
 * thread list showing which feature a thread is working on,
 * and auto-stage updates (thread completes → feature stage changes).
 *
 * @module FeatureThreadLinkService
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

export interface FeatureThreadLink {
  readonly featureId: string;
  readonly threadId: string;
  readonly createdAt: string;
}

export interface FeatureThreadLinkServiceShape {
  readonly linkFeatureToThread: (input: {
    featureId: string;
    threadId: ThreadId;
  }) => Effect.Effect<void>;

  readonly unlinkFeatureFromThread: (input: {
    featureId: string;
    threadId: ThreadId;
  }) => Effect.Effect<void>;

  readonly getLinkedThreads: (input: {
    featureId: string;
  }) => Effect.Effect<ReadonlyArray<FeatureThreadLink>>;

  readonly getLinkedFeature: (input: {
    threadId: ThreadId;
  }) => Effect.Effect<FeatureThreadLink | null>;

  readonly getLinksForProject: (input: {
    projectId: ProjectId;
  }) => Effect.Effect<ReadonlyArray<FeatureThreadLink>>;
}

export class FeatureThreadLinkService extends ServiceMap.Service<
  FeatureThreadLinkService,
  FeatureThreadLinkServiceShape
>()("rowl/orchestration/Services/FeatureThreadLinkService") {}
