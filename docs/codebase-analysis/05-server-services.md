# 05 — Rowl Server Orchestration Services

## Overview

The orchestration layer sits between the HTTP/API layer and the persistence layer. It implements the business logic for Rowl's core concepts: goals, features, context, memory, prompts, checkpointing, handoffs, and multi-agent coordination.

All services follow the **Effect** framework's **Service** pattern — an interface file defines the shape, and a `*Live.ts` file provides the runtime implementation via `Layer.effect` or `Layer.succeed`.

**Persistence pattern**: Most services delegate to **Projection repositories** (read-model accessors in `apps/server/src/persistence/Services/`). Direct SQL via `effect/unstable/sql/SqlClient` is used for cross-cutting or join-heavy queries.

---

## 1. GoalsService

### What it does
Manages project goals: CRUD operations, setting the main ("pinned") goal, and linking/unlinking threads to goals.

### Persistence
Uses `ProjectionGoalRepository` — upserts/delete-by-id on the `projection_goals` table. Also calls `clearMainGoalForProject` to enforce the one-main-per-project invariant.

### Commands/Events handled
| Operation | Notes |
|---|---|
| `createGoal` | Generates `GoalId`, sets `isMain`, clears other mains if needed |
| `getGoal` | Fetches by ID, returns `Option` (fails if not found) |
| `listGoalsByProject` | Delegates to repo |
| `setMainGoal` | Clears other mains, then upserts |
| `linkThreadToGoal` | Adds threadId to the `linkedThreadIds` set |
| `unlinkThreadFromGoal` | Filters threadId out of `linkedThreadIds` |
| `updateGoalText` | Upserts with new text |
| `deleteGoal` | Direct repo delete |

### Implementation status
**FULLY IMPLEMENTED.** All operations have Live implementations. Error handling wraps repo failures into `GoalServiceError` with operation name and detail. Link/unlink use Set semantics to avoid duplicates.

---

## 2. FeatureService

### What it does
Manages features within projects: CRUD operations and stage transitions (e.g., `triage → in-progress → done`).

### Persistence
Uses `ProjectionFeatureRepository` — upserts/delete-by-id on the `projection_features` table.

### Commands/Events handled
| Operation | Notes |
|---|---|
| `createFeature` | Generates `FeatureId`, sets stage, optional `threadId` |
| `getFeature` | Fetches by ID |
| `listFeaturesByProject` | Delegates to repo |
| `updateFeature` | Partial update: name, description, threadId |
| `updateFeatureStage` | Sets only the stage + `updatedAt` timestamp |
| `deleteFeature` | Direct repo delete |

### Implementation status
**FULLY IMPLEMENTED.** Uses `toFeature()` mapper that conditionally includes `threadId` (only when non-null). All error cases wrapped in `FeatureServiceError`.

---

## 3. FeatureThreadLinkService

### What it does
Manages explicit many-to-many links between features and threads (separate from the optional `threadId` on Feature itself). Enables feature cards to show which thread is building them, and vice versa.

### Persistence
**Direct SQL** — no projection repository. Uses `effect/unstable/sql/SqlClient` to insert/select from `feature_thread_links` table directly. This is the only service that bypasses the projection layer for its core data.

### Commands/Events handled
| Operation | SQL |
|---|---|
| `linkFeatureToThread` | `INSERT ... ON CONFLICT DO NOTHING` — idempotent |
| `unlinkFeatureFromThread` | `DELETE WHERE feature_id AND thread_id` |
| `getLinkedThreads` | `SELECT WHERE feature_id` |
| `getLinkedFeature` | `SELECT WHERE thread_id LIMIT 1` (one feature per thread) |
| `getLinksForProject` | JOINs with `projection_features` to filter by project |

### Implementation status
**FULLY IMPLEMENTED.** All operations silently catch errors and return empty/null rather than failing. The `ON CONFLICT DO NOTHING` means linking the same pair twice is harmless.

### Notable quirks
- This is the only orchestration service that talks directly to SQL instead of through a projection repository.
- A thread can only be linked to **one** feature at a time (`getLinkedFeature` uses `LIMIT 1`).

---

## 4. ContextService

### What it does
Manages context nodes — compressed snapshots of conversation segments that can be "restored" (decompressed) when needed. Also computes aggregate context budget per project.

### Persistence
Uses `ProjectionContextNodeRepository` — upserts/delete-by-id on `projection_context_nodes` table.

### Commands/Events handled
| Operation | Notes |
|---|---|
| `createContextNode` | Generates ID, sets `compressed: false` initially |
| `getContextNode` | Fetches by ID |
| `listContextNodesByProject` | Returns nodes + computed `ContextBudget` |
| `listContextNodesByThread` | Returns nodes only (no budget) |
| `compressContextNode` | Sets `compressed: true` |
| `restoreContextNode` | Sets `compressed: false` |
| `deleteContextNode` | Direct delete |
| `getContextBudget` | Computes `totalSize`, `used` (uncompressed), `available` (compressed), `compressionRatio` |

### Implementation status
**FULLY IMPLEMENTED.** `computeBudget()` iterates all nodes and calculates totals. `ContextBudget` is derived data, not stored.

### Notable quirks
- `getContextBudget` on line 207 does an unchecked cast: `projectId: projectId as any`. This is technically unsafe but avoids a type mismatch between the method signature (`string`) and the repo's expectation.

---

## 5. ContextBudgetCalculator

### What it does
Estimates how many tokens each section of the assembled context consumes, powering the budget ring visualization. Reads the same data sources as the actual context assembly but measures rather than renders.

### Persistence
**None** — reads from `OrchestrationEngineService.getReadModel()` and filesystem (`readProjectAgentsFile`, `readProjectBriefFile`).

### Commands/Events handled
- `estimateForThread(threadId, projectId)` — the only operation; returns `ContextBudgetBreakdown` with token estimates for: `agentsMd`, `projectContext`, `resumeSummary`, `skills`, `userMessage`, `totalRowlContext`, plus provider-reported `lastReportedTotal` (always `null` server-side — comes from client) and `usagePercent`.

### Implementation status
**FULLY IMPLEMENTED** but **approximate by design**. Uses 4 chars/token (documented as ~10% accuracy for English). Wraps all operations in `Effect.catch` returning zeros — never throws.

### Notable patterns/quirks
- `ContextBudgetCalculatorLive` is the only service that imports `CHARS_PER_TOKEN` as a runtime constant (4) rather than a shared constant — each of the three token-estimating services (`ContextBudgetCalculator`, `ContextTrimmer`, `MemoryService`) defines its own `CHARS_PER_TOKEN = 4`.
- `userMessage` is always `0` in estimates — "can't predict next message."
- `lastReportedTotal` is always `null` — the comment explains it comes from client-side `contextWindow` module, not the server.
- Uses `Effect.fnUntraced` for several internal helpers (optimization to avoid trace overhead in hot paths).

---

## 6. ContextTrimmer

### What it does
Surgically reduces context size by stripping tool call results (the biggest context consumers) and replacing them with lightweight "tombstone" summaries. Inspired by Valo's insight that 80% of context weight comes from tool results, not conversation.

### Persistence
**None** — pure in-memory string manipulation.

### Commands/Events handled
| Operation | Description |
|---|---|
| `trimResumeSummary` | Truncates resume summary to max tokens, keeping first N paragraphs |
| `createTombstone` | Generates a tombstone string from original content + reason |
| `trimConversationHistory` | Scans message array for tool-call-result patterns, replaces with tombstones |
| `summarizeConversation` | Phase 1 — pattern-based extraction of user requests, decisions, file operations (no LLM) |

### Implementation status
**FULLY IMPLEMENTED.** However, `summarizeConversation` is explicitly documented as **Phase 1** — pattern-based extraction, not LLM-based. A comment notes "a future version will use an actual lightweight model."

### Notable patterns/quirks
- Uses regex patterns to detect likely tool call results: large code blocks (`>200 chars`), `{"type":"tool_result"`, command output (`$ ...` with >200 chars), diffs, and code blocks >50 lines.
- `extractSummaryFromContent` produces human-readable summaries: "Read file: `/path/to/file`", "Ran: `npm install...`", "Diff: +20 -5 lines".
- The `summarizeConversation` pattern extraction looks for phrases like "I chose", "I decided", "created", "modified" to find decisions and file operations.

---

## 7. MemoryService

### What it does
Persistent deep memory across sessions. Creates, searches (FTS5 + semantic), and injects relevant memories into AI context as an XML block. Memories are decisions, preferences, facts, and architectural choices extracted from conversations.

### Persistence
Uses `MemoryEntryRepository` for CRUD. Falls back to `EmbeddingService` for semantic search when FTS5 returns few results.

### Commands/Events handled
| Operation | Description |
|---|---|
| `createMemory` | Stores entry with type, content, summary, importance |
| `searchMemories` | FTS5 full-text search via repo |
| `listByProject` | Lists all memories for project sorted by importance |
| `deleteMemory` | Soft/hard delete via repo |
| `buildRelevantMemoriesBlock` | Searches + semantic fallback, builds XML block, respects token budget (~500 tokens default) |

### Implementation status
**FULLY IMPLEMENTED.** The `buildRelevantMemoriesBlock` has a two-tier search: FTS5 first, then semantic (via `EmbeddingService.findSimilar`) if fewer than 3 results. Merges and deduplicates results. Token-counting respects a ~500 token cap.

### Notable patterns/quirks
- `MemoryServiceLive` imports `EmbeddingService` from `./EmbeddingServiceLive` — a runtime circular dependency that resolves because both are Effect services initialized together.
- `createMemory` has a hard `Effect.die` fallback — if upsert fails, the process crashes. This is a deliberate choice for memory creation (don't silently fail).
- Memory injection caps at `maxTokens ?? 500` tokens.

---

## 8. PMChatContextService

### What it does
Aggregates all project context for the PM chat UI: all threads, features, goals, and context nodes in one call.

### Persistence
**None** — aggregates from other services (`GoalsService`, `FeatureService`, `ContextService`, `OrchestrationEngineService`).

### Commands/Events handled
| Operation | Description |
|---|---|
| `getProjectContext(projectId)` | Returns `PMChatProjectContext` with threads (id, title, goal, status), features, goals, and context nodes |

### Implementation status
**FULLY IMPLEMENTED.** All downstream service calls wrapped in `Effect.catch` returning empty arrays — the PM chat should still render even if some services fail.

### Notable quirks
- Thread `status` comes from `t.session?.status ?? "idle"` — the session object is provider-runtime data, not orchestration data.
- No pagination — returns all threads/goals/features for the project.

---

## 9. ProjectPromptsService

### What it does
CRUD for persistent AI instructions at three scopes (global, project, thread) and management of "harness presets" — pre-built workflow templates activated per-thread.

### Persistence
**Direct SQL** to two tables: `project_prompts` and `harness_presets`. Seeds built-in harnesses on startup via `BUILTIN_HARNESSES` from `WorkflowEngine.ts`.

### Commands/Events handled
| Operation | Notes |
|---|---|
| `createPrompt` | Inserts into `project_prompts` |
| `listPrompts` | Complex conditional SQL based on projectId + scope |
| `updatePrompt` | Separate UPDATE per field, then fetch |
| `deletePrompt` | Direct delete |
| `listHarnessPresets` | Selects all, `isBuiltin` converted from `1/true` |
| `getActiveHarness` | Looks up in `activeHarnessByThread` Map, then fetches preset |
| `activateHarness` | Sets in Map |
| `deactivateHarness` | Deletes from Map |
| `getContextForThread` | SQL query for all applicable prompts (global + project + thread), plus active harness |

### Implementation status
**FULLY IMPLEMENTED** but with one **known issue**: `activeHarnessByThread` is an **in-memory Map** that **does not persist across server restarts**. Harness activation state is ephemeral.

### Notable patterns/quirks
- Harness seeding uses `ON CONFLICT (id) DO UPDATE SET` to allow content updates to built-in harnesses on restart.
- `listPrompts` has three different SQL paths based on which parameters are provided — projectId-only, scope-only, both.
- Priority ordering: `ORDER BY scope ASC, priority DESC` — global prompts come first within each priority tier.

---

## 10. HandoffService

### What it does
Generates a structured briefing when context is nearly exhausted, capturing current task state, recent conversation, goals, features, and suggested new thread title. Also extracts key decisions as memory entries.

### Persistence
**None** — generates on-the-fly from `OrchestrationEngineService`, `GoalsService`, `FeatureService`, `MemoryService`.

### Commands/Events handled
| Operation | Description |
|---|---|
| `generateBriefing` | Builds markdown briefing: thread title, goal, recent conversation (last 10 msgs), active goals, feature status, extracts last assistant message as memory |

### Implementation status
**FULLY IMPLEMENTED.** All failures caught and return a safe fallback briefing ("Failed to generate briefing"). Memories are created with `importance: 4` (high).

### Notable patterns/quirks
- Only extracts **one** memory (the last assistant message) per handoff.
- Recent conversation filtered to `role === "user" || "assistant"`, last 10 messages.
- All downstream service calls wrapped in `Effect.catch` returning empty results — briefing is best-effort.

---

## 11. MultiAgentCoordinator

### What it does
Manages multiple concurrent AI agents (threads) in a project. Provides an overview of all agents, can spawn new agent threads for specific features, and detects file conflicts between running agents.

### Persistence
**None** — reads from `OrchestrationEngineService.getReadModel()` and dispatches commands.

### Commands/Events handled
| Operation | Description |
|---|---|
| `getProjectAgentOverview` | Returns all non-PM threads for a project with status, model, turn count, and detected file conflicts |
| `spawnAgentForFeature` | Creates a new thread + sends initial instructions as first turn |
| `detectConflicts` | Delegates to `getProjectAgentOverview`, extracts `conflicts` field |

### Implementation status
**FULLY IMPLEMENTED.** `spawnAgentForFeature` dispatches two events: `thread.create` + `thread.turn.start`. Model defaults to `project.defaultModel ?? DEFAULT_MODEL_BY_PROVIDER.codex`.

### Notable patterns/quirks
- `spawnAgentForFeature` creates the thread with `interactionMode: "default"` and `runtimeMode: "full-access"`.
- Conflicts are detected from `turnDiffSummaries` (last 3 turns per thread) — files that appear in diffs from multiple threads.
- Excludes threads with titles starting with `[Product Manager]` or `[Skill Generator]` from the agent overview.

---

## 12. CheckpointReactor

### What it does
Background worker that reacts to checkpoint lifecycle events and applies side effects: capturing git checkpoints on turn completion, managing pre-turn baselines, replacing placeholder checkpoints with real ones, and handling revert operations.

### Persistence
Uses `CheckpointStore` (git-based checkpointing), `ProviderService` (session management), `OrchestrationEngineService` (dispatching domain events), and `RuntimeReceiptBus` (publishing checkpoint events).

### Commands/Events handled
This is an event-driven reactor, not a command service. It subscribes to:

**Runtime events:**
- `turn.started` → ensures pre-turn baseline exists
- `turn.completed` → captures real git checkpoint

**Domain events:**
- `thread.turn-start-requested` / `thread.message-sent` → ensures pre-turn baseline
- `thread.checkpoint-revert-requested` → executes revert
- `thread.turn-diff-completed` → replaces placeholder checkpoint with real git ref

### Implementation status
**FULLY IMPLEMENTED.** Most complex service in the layer. ~820 lines with careful handling of:
- HEAD-detached, non-git-repo, lock file, merge conflict, and permission-denied revert errors (via `normalizeCheckpointRevertError`)
- Primary turn exclusivity: only the active turn can produce completion checkpoints
- Placeholder reuse: existing `status: "missing"` checkpoints are replaced, not duplicated
- Workspace index cache invalidation on capture and revert
- `providerService.rollbackConversation()` on revert

### Notable patterns/quirks
- Uses `Effect.fnUntraced` extensively for performance — these are hot-path functions called on every turn.
- `makeDrainableWorker` pattern: all inputs go through a queue with `drain()` for test synchronization.
- The reactor has its own `serverCommandId` function that generates command IDs with `server:${tag}:${uuid}` prefix.
- Comment on line 726-730 documents a known reliability issue: "the providerService.streamEvents PubSub does not reliably deliver turn.completed runtime events to this reactor (shared subscription), so reacting to the domain event is the reliable path."

---

## 13. OverseerReactor

### What it does
Background monitoring for the entire product-building workflow. Watches provider runtime events for AI issues (capability forgetfulness, technical delegation, loops, dangerous commands, premature completion, uncertainty) and surfaces them as timeline activities readable by non-coders.

### Persistence
**None** — dispatches activities to `OrchestrationEngineService`, delegates to `CodebaseIntelligence`, `ContextService`, `EvaluatorService`, `HandoffService`, `MemoryService`.

### Commands/Events handled
This is an event-driven reactor. Subscribes to both `providerService.streamEvents` and `orchestrationEngine.streamDomainEvents`.

**Runtime event handlers:**
| Event | Action |
|---|---|
| `content.delta` (assistant_text) | Buffers text, checks patterns at 500-char intervals |
| `item.started` (command_execution) | Checks for dangerous commands |
| `item.started` (file ops) | Buffers file activity for Live Map |
| `turn.completed` | Extracts memories (max 2/turn), loop detection, context budget warnings, runs evaluator, auto-creates context node |
| `session.exited` (error) | Appends session-error activity |

**Domain event handlers:**
| Event | Action |
|---|---|
| `thread.turn-diff-completed` | Records file changes to codebase intelligence |

### Detection patterns implemented
- **Capability forgetfulness**: AI claims it can't do something it can
- **Technical delegation**: AI asks user to run commands
- **Dangerous commands**: `rm -rf`, `DROP TABLE`, `git push --force`, `git reset --hard`, `chmod 777`
- **Uncertainty/hedging**: "I'm not sure", "I think", "probably"
- **Premature completion**: AI claims done without verification
- **Loop detection**: Same error 3 times in a row

### Implementation status
**FULLY IMPLEMENTED.** Context budget warnings at 160K (~"consider new thread") and 180K tokens (~"handoff briefing auto-generated"). Memory extraction max 2 per turn. All errors caught and logged, never propagate.

### Notable patterns/quirks
- Text buffering is keyed by `${threadId}:${turnId ?? ""}` — turnId can be undefined/null in some events.
- Pattern checks run on every 500-char chunk of delta, not on complete text.
- Context budget check uses `usage.totalTokens` or falls back to `input_tokens + output_tokens`.
- Evaluator runs on **every completed turn** (not just when builder claims completion).

---

## 14. EvaluatorService

### What it does
Verifies that builder agent claims are backed by evidence. Runs structural checks after each turn: files modified, no overseer warnings, substantive response, healthy session.

### Persistence
**None** — reads from `OrchestrationEngineService.getReadModel()`.

### Commands/Events handled
| Operation | Description |
|---|---|
| `evaluateThread` | Runs 4 checks: files modified, no overseer issues, response substance, session health |
| `quickCheck` | Returns `{ compiles: true, errors: [] }` — **stubbed, does nothing** |

### Implementation status
**PARTIALLY IMPLEMENTED.** `evaluateThread` is fully implemented with pass/partial/fail scoring. `quickCheck` is **stubbed** — always returns `compiles: true` with no actual compilation check.

### Evaluation scoring
- 0 fails → `status: "pass"`
- 1 fail → `status: "partial"`
- 2+ fails → `status: "fail"`

---

## 15. CodebaseIntelligence

### What it does
Persistent codebase health analysis. Tracks file size, connection count (imports/exports), change frequency, and assigns health scores (0-100). Inspired by Valo's "Codebase Intelligence (Pro)" feature.

### Persistence
**Direct SQL** to `codebase_health` table via `effect/unstable/sql/SqlClient`. Uses `ON CONFLICT (project_id, file_path) DO UPDATE` for upsert.

### Commands/Events handled
| Operation | Description |
|---|---|
| `updateProjectHealth` | Batch upsert for all files from a dependency graph scan |
| `recordFileChange` | Increments `change_frequency`, sets `last_changed_at` |
| `getProjectHealthSummary` | Returns critical (score<40), warning (40-70), healthy files + averages |
| `getFileHealth` | Single file lookup |

### Health scoring formula
```
Base: 100
- Large file: >500 lines → -30, >300 lines → -15
- High coupling: >20 connections → -30, >10 → -20
- Volatile: >20 changes → -20, >10 → -10
- Isolated: 0 connections + >10 lines → -10
```

### Implementation status
**FULLY IMPLEMENTED.** All operations wrapped in `Effect.catch(() => Effect.void)` — failures are silent. `getProjectHealthSummary` sorts by `health_score ASC` so critical files appear first.

---

## 16. EmbeddingService (bonus — found in Layers/)

### What it does
Local semantic embeddings for deep memory search. Uses `@xenova/transformers` (Transformers.js) to run the `all-MiniLM-L6-v2` model entirely locally — no API calls, no cost, no network dependency.

### Persistence
**None** — purely computational service.

### Commands/Events handled
| Operation | Description |
|---|---|
| `embed(text)` | Generates 384-dimensional Float32 embedding via Transformers.js |
| `similarity(a, b)` | Cosine similarity between two vectors |
| `findSimilar(query, candidates, topK)` | Embeds query, compares against candidates, returns top K by score |

### Implementation status
**FULLY IMPLEMENTED.** Lazy-loaded pipeline (first call loads the ~23MB model). All candidates without pre-computed embeddings are embedded on-the-fly. Truncates to 2000 chars before embedding.

### Notable patterns/quirks
- Pipeline is a module-level `let` variable, not Effect-managed state — loaded lazily via `import("@xenova/transformers")`.
- `pipelinePromise` handles concurrent calls gracefully (same promise is reused).
- Truncation at 2000 chars (roughly 512 tokens) matches the model's max sequence length.
- `cosineSimilarity` is a pure function, exported and importable separately.

---

## Summary Table

| Service | Interface | Live | Persistence | Status |
|---|---|---|---|---|
| GoalsService | ✅ | ✅ | ProjectionGoalRepository | **FULL** |
| FeatureService | ✅ | ✅ | ProjectionFeatureRepository | **FULL** |
| FeatureThreadLinkService | ✅ | ✅ | Direct SQL | **FULL** |
| ContextService | ✅ | ✅ | ProjectionContextNodeRepository | **FULL** |
| ContextBudgetCalculator | ✅ | ✅ | None (read model) | **FULL** (approximate) |
| ContextTrimmer | ✅ | ✅ | None | **FULL** (Phase 1 summarization) |
| MemoryService | ✅ | ✅ | MemoryEntryRepository + EmbeddingService | **FULL** |
| PMChatContextService | ✅ | ✅ | None (aggregates) | **FULL** |
| ProjectPromptsService | ✅ | ✅ | Direct SQL | **FULL** (harness state is ephemeral) |
| HandoffService | ✅ | ✅ | None | **FULL** |
| MultiAgentCoordinator | ✅ | ✅ | None (read model + dispatch) | **FULL** |
| CheckpointReactor | ✅ | ✅ | CheckpointStore + Provider + Engine | **FULL** |
| OverseerReactor | ✅ | ✅ | None (dispatches to Engine) | **FULL** |
| EvaluatorService | ✅ | ✅ | None (read model) | **FULL** (quickCheck is stub) |
| CodebaseIntelligence | ✅ | ✅ | Direct SQL (codebase_health) | **FULL** |
| EmbeddingService | ✅ | ✅ | None | **FULL** |

## Cross-Cutting Concerns

### Error handling patterns
Most services follow one of three patterns:
1. **Fail-fast**: Operations that "must" work (memory creation) use `Effect.die` on failure.
2. **Graceful degradation**: Aggregate/overview services catch all errors and return empty results.
3. **Silent catch**: Background reactors (`CodebaseIntelligence`, `FeatureThreadLinkService`) catch everything and continue.

### Shared infrastructure
- `OrchestrationEngineService` — read model access, event streaming, command dispatching.
- `effect/unstable/sql/SqlClient` — direct SQL for cross-cutting queries.
- `makeDrainableWorker` — background queue pattern used by CheckpointReactor and OverseerReactor.
- `CHARS_PER_TOKEN = 4` — duplicated across ContextBudgetCalculator, ContextTrimmer, and MemoryService.

### Known issues / limitations
1. **`activeHarnessByThread` is in-memory** (ProjectPromptsServiceLive) — harness activation state resets on server restart.
2. **`quickCheck` is stubbed** (EvaluatorServiceLive) — always returns `compiles: true`.
3. **`summarizeConversation` is Phase 1** (ContextTrimmerLive) — pattern-based only, not LLM-based.
4. **`lastReportedTotal` is always null** (ContextBudgetCalculatorLive) — server cannot know provider-reported token counts without explicit reporting.
5. **`getContextBudget` uses `as any` cast** (ContextServiceLive line 208) — type safety gap between method signature and repo expectation.
6. **turn.completed delivery is unreliable** (CheckpointReactor comment, lines 726-730) — the reactor handles this by preferring domain events over runtime events.
