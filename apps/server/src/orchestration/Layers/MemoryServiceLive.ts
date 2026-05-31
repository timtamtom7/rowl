/**
 * MemoryServiceLive — Deep memory implementation.
 *
 * Creates, searches, and injects memories into AI context.
 * Uses SQLite FTS5 for full-text search across memory content.
 *
 * Memory injection: when a user sends a message, relevant memories
 * are searched and injected as a `<relevant_memories>` XML block
 * in the project context. Capped at ~500 tokens to avoid budget waste.
 *
 * @module MemoryServiceLive
 */
import { randomUUID } from "node:crypto";
import { Effect, Layer } from "effect";
import type { ProjectId } from "@t3tools/contracts";

import { MemoryService, type MemoryServiceShape } from "../Services/MemoryService.ts";
import { EmbeddingService } from "./EmbeddingServiceLive.ts";
import {
  type MemoryEntry,
  MemoryEntryRepository,
} from "../../persistence/Services/MemoryEntries.ts";

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export const MemoryServiceLive = Layer.effect(
  MemoryService,
  Effect.gen(function* () {
    const memoryRepo = yield* MemoryEntryRepository;
    const embeddingService = yield* EmbeddingService;

    const createMemory: MemoryServiceShape["createMemory"] = (input) =>
      Effect.gen(function* () {
        const id = randomUUID();
        const now = new Date().toISOString();

        const entry: MemoryEntry = {
          id,
          projectId: input.projectId,
          threadId: input.threadId,
          type: input.type,
          content: input.content,
          summary: input.summary,
          importance: input.importance ?? 3,
          createdAt: now,
          lastAccessedAt: null,
          sourceEventSequence: null,
        } as MemoryEntry;

        yield* memoryRepo.upsert(entry);
        return entry;
      }).pipe(Effect.catch(() => Effect.die(new Error("Failed to create memory"))));

    const searchMemories: MemoryServiceShape["searchMemories"] = (input) =>
      memoryRepo
        .search({
          query: input.query,
          projectId: input.projectId,
          limit: input.limit,
        } as any)
        .pipe(Effect.catch(() => Effect.succeed([] as ReadonlyArray<MemoryEntry>)));

    const listByProject: MemoryServiceShape["listByProject"] = (input) =>
      memoryRepo
        .listByProject({
          projectId: input.projectId,
          limit: input.limit,
        } as any)
        .pipe(Effect.catch(() => Effect.succeed([] as ReadonlyArray<MemoryEntry>)));

    const deleteMemory: MemoryServiceShape["deleteMemory"] = (input) =>
      memoryRepo.deleteById({ id: input.id } as any).pipe(Effect.catch(() => Effect.void));

    const buildRelevantMemoriesBlock: MemoryServiceShape["buildRelevantMemoriesBlock"] = (input) =>
      Effect.gen(function* () {
        const maxTokens = input.maxTokens ?? 500;

        // Search for relevant memories: FTS5 first, then semantic fallback
        let memories = yield* searchMemories({
          query: input.query,
          projectId: input.projectId,
          limit: 10,
        });

        // If FTS5 returned few results, try semantic search
        if (memories.length < 3) {
          const allMemories = yield* listByProject({
            projectId: input.projectId,
            limit: 50,
          });
          if (allMemories.length > 0) {
            const semanticResults = yield* embeddingService
              .findSimilar(
                input.query,
                allMemories.map((m) => ({
                  id: m.id as string,
                  text: `${(m as any).summary} ${(m as any).content}`,
                })),
                5,
              )
              .pipe(
                Effect.catch(() =>
                  Effect.succeed([] as ReadonlyArray<{ id: string; score: number }>),
                ),
              );

            // Merge FTS5 and semantic results, deduplicate by ID
            const existingIds = new Set(memories.map((m) => (m as any).id as string));
            const semanticMemories = semanticResults
              .filter((r) => r.score > 0.3 && !existingIds.has(r.id))
              .map((r) => allMemories.find((m) => (m as any).id === r.id))
              .filter(Boolean) as any[];

            memories = [...memories, ...semanticMemories];
          }
        }

        if (memories.length === 0) return null;

        // Build XML block, respecting token budget
        const parts: string[] = ["<relevant_memories>"];
        let tokenCount = estimateTokens("<relevant_memories></relevant_memories>");

        for (const memory of memories) {
          const memoryXml = `  <memory type="${memory.type}" importance="${memory.importance}">${memory.summary}</memory>`;
          const memoryTokens = estimateTokens(memoryXml);

          if (tokenCount + memoryTokens > maxTokens) break;

          parts.push(memoryXml);
          tokenCount += memoryTokens;

          // Touch the memory's last_accessed_at
          yield* memoryRepo.touchAccessed(memory.id).pipe(Effect.catch(() => Effect.void));
        }

        if (parts.length === 1) return null; // Only the opening tag, no memories fit

        parts.push("</relevant_memories>");
        return parts.join("\n");
      });

    return {
      createMemory,
      searchMemories,
      listByProject,
      deleteMemory,
      buildRelevantMemoriesBlock,
    } satisfies MemoryServiceShape;
  }),
);
