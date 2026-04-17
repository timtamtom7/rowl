/**
 * MemoryService — Service interface for deep memory across sessions.
 *
 * Handles creating, searching, and injecting memories. Memories are
 * decisions, preferences, facts, and architectural choices extracted
 * from conversations that persist across sessions.
 *
 * @module MemoryService
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectId, ThreadId } from "@t3tools/contracts";
import type {
  MemoryEntry,
  MemoryEntryType,
} from "../../persistence/Services/MemoryEntries.ts";

export interface MemoryServiceShape {
  /** Store a new memory entry */
  readonly createMemory: (input: {
    readonly projectId: ProjectId | null;
    readonly threadId: ThreadId | null;
    readonly type: MemoryEntryType;
    readonly content: string;
    readonly summary: string;
    readonly importance?: number;
  }) => Effect.Effect<MemoryEntry>;

  /** Search memories using FTS5 full-text search */
  readonly searchMemories: (input: {
    readonly query: string;
    readonly projectId?: ProjectId;
    readonly limit?: number;
  }) => Effect.Effect<ReadonlyArray<MemoryEntry>>;

  /** List all memories for a project, sorted by importance */
  readonly listByProject: (input: {
    readonly projectId: ProjectId;
    readonly limit?: number;
  }) => Effect.Effect<ReadonlyArray<MemoryEntry>>;

  /** Delete a memory entry */
  readonly deleteMemory: (input: {
    readonly id: string;
  }) => Effect.Effect<void>;

  /**
   * Build a relevant memories XML block for injection into AI context.
   * Searches for memories relevant to the given query (user's message)
   * and formats them as an XML block for the project_context.
   */
  readonly buildRelevantMemoriesBlock: (input: {
    readonly query: string;
    readonly projectId: ProjectId;
    readonly maxTokens?: number;
  }) => Effect.Effect<string | null>;
}

export class MemoryService extends ServiceMap.Service<
  MemoryService,
  MemoryServiceShape
>()("rowl/orchestration/Services/MemoryService") {}
