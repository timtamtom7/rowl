/**
 * CoreMemoryService — two-tier (global + project) markdown memory blocks.
 *
 * Global blocks live under the agent's state dir; project blocks live under
 * `.rowl/memory/` inside each project. The service seeds defaults on first
 * use and exposes read operations that the per-turn context hook uses to
 * inject memory into every prompt.
 *
 * @module CoreMemoryService
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { MemoryBlock } from "../block.ts";

export interface CoreMemoryAgentContext {
  readonly agentId?: string;
  readonly projectRoot?: string;
}

export interface CoreMemoryServiceShape {
  /** List all global blocks for the current agent, seeding defaults if empty. */
  readonly listGlobal: (
    input?: CoreMemoryAgentContext,
  ) => Effect.Effect<ReadonlyArray<MemoryBlock>>;

  /** List all project blocks for the given project root, seeding defaults if empty. */
  readonly listProject: (input: {
    readonly projectRoot: string;
    readonly agentId?: string;
  }) => Effect.Effect<ReadonlyArray<MemoryBlock>>;

  /** Ensure the global memory dir exists and contains the default blocks. */
  readonly ensureGlobalSeeded: (input?: CoreMemoryAgentContext) => Effect.Effect<void>;

  /** Ensure the project memory dir exists and contains the default blocks. */
  readonly ensureProjectSeeded: (input: {
    readonly projectRoot: string;
    readonly agentId?: string;
  }) => Effect.Effect<void>;
}

export class CoreMemoryService extends ServiceMap.Service<
  CoreMemoryService,
  CoreMemoryServiceShape
>()("rowl/memory/Services/CoreMemoryService") {}
