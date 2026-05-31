/**
 * MultiAgentCoordinator — Service for managing multiple concurrent AI agents.
 *
 * Enables multiple provider sessions to run simultaneously on different
 * threads within a project. Each agent works on a different feature/task.
 * The PM coordinates assignment and monitors progress.
 *
 * Tier 3 feature — the "control room" comes alive here.
 *
 * @module MultiAgentCoordinator
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";

export interface AgentStatus {
  readonly threadId: ThreadId;
  readonly threadTitle: string;
  readonly featureName: string | null;
  readonly status: "idle" | "running" | "completed" | "error";
  readonly provider: string | null;
  readonly model: string | null;
  readonly lastActivity: string | null;
  readonly turnCount: number;
}

export interface MultiAgentOverview {
  readonly projectId: ProjectId;
  readonly totalAgents: number;
  readonly runningAgents: number;
  readonly agents: ReadonlyArray<AgentStatus>;
  readonly conflicts: ReadonlyArray<{
    filePath: string;
    threads: ReadonlyArray<string>;
  }>;
}

export interface MultiAgentCoordinatorShape {
  /** Get overview of all agents/threads working in a project */
  readonly getProjectAgentOverview: (input: {
    readonly projectId: ProjectId;
  }) => Effect.Effect<MultiAgentOverview>;

  /** Spawn a new agent thread for a specific feature */
  readonly spawnAgentForFeature: (input: {
    readonly projectId: ProjectId;
    readonly featureName: string;
    readonly instructions: string;
    readonly model?: string;
  }) => Effect.Effect<{ threadId: ThreadId }>;

  /** Check for file conflicts between running agents */
  readonly detectConflicts: (input: {
    readonly projectId: ProjectId;
  }) => Effect.Effect<ReadonlyArray<{ filePath: string; threads: ReadonlyArray<string> }>>;
}

export class MultiAgentCoordinator extends ServiceMap.Service<
  MultiAgentCoordinator,
  MultiAgentCoordinatorShape
>()("rowl/orchestration/Services/MultiAgentCoordinator") {}
