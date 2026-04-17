# Rowl Server Orchestration Core Analysis

The Rowl orchestration engine is an event-sourced, command-driven system that manages threads, projects, sessions, checkpoints, and AI provider interactions. It uses the Effect framework for functional error handling and the `@t3tools/contracts` package for shared types.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Flow: Command → Event → Projection](#core-flow-command--event--projection)
3. [Decider (decider.ts)](#decider-deciderts)
4. [Projector (projector.ts)](#projector-projectorts)
5. [Schemas (Schemas.ts)](#schemas-schemasts)
6. [OrchestrationEngine (Layers/OrchestrationEngine.ts)](#orchestrationengine-layersorchestrationenginets)
7. [WorkflowEngine (Layers/WorkflowEngine.ts)](#workflowengine-layersworkflowenginets)
8. [Providers Runtime Ingestion (Layers/ProviderRuntimeIngestion.ts)](#providers-runtime-ingestion-layersproviderruntimeingestionts)
9. [ProviderCommandReactor (Layers/ProviderCommandReactor.ts)](#providercommandreactor-layersprovidercommandreactorts)
10. [CheckpointReactor (Layers/CheckpointReactor.ts)](#checkpointreactor-layerscheckpointreactorts)
11. [OverseerReactor (Layers/OverseerReactor.ts)](#overserreactor-layersoverserreagorts)
12. [RuntimeReceiptBus (Layers/RuntimeReceiptBus.ts)](#runtimereceiptbus-layersruntimebusts)
13. [ProjectionPipeline (Layers/ProjectionPipeline.ts)](#projectionpipeline-layersprojectionpipelinets)
14. [ProjectionSnapshotQuery (Layers/ProjectionSnapshotQuery.ts)](#projectionsnapshotquery-layersprojectionsnapshotqueryts)
15. [Errors (Errors.ts)](#errors-errorsts)
16. [Command Invariants (commandInvariants.ts)](#command-invariants-commandinvariantsts)
17. [Known Issues & Quirks](#known-issues--quirks)

---

## Architecture Overview

The system follows classic event sourcing:

```
Command → Decider → Event Store → Projector → Read Model (in-memory)
                                      ↓
                              ProjectionPipeline → Database tables
                                      ↓
                              ProjectionSnapshotQuery → Reconstructed Read Model
```

**Key characteristics:**
- Single-writer consistency: an unbounded `Queue` feeds a single worker fiber that processes commands sequentially
- Dual storage: events are immutable (append-only log), while projections are mutable (updated atomically per event)
- Reconciliation on failure: if a dispatch fails after the event is persisted but projection fails, the read model is rebuilt from the event store
- 10-second dispatch timeout with stack trace logging on timeout
- Domain events are broadcast via Effect `PubSub` so multiple reactors can consume them independently

**Directory structure:**
```
orchestration/
├── decider.ts                    # Pure command→event transformation
├── projector.ts                  # In-memory read model projection
├── projector.test.ts
├── decider.projectScripts.test.ts
├── Schemas.ts                    # Re-exports from @t3tools/contracts
├── Errors.ts                     # Error type hierarchy
├── commandInvariants.ts          # Validation helpers
├── commandInvariants.test.ts
└── Layers/
    ├── OrchestrationEngine.ts    # Core command processor
    ├── OrchestrationEngine.test.ts
    ├── WorkflowEngine.ts         # AI harness detection
    ├── ProviderRuntimeIngestion.ts    # Provider events → domain events
    ├── ProviderRuntimeIngestion.test.ts
    ├── ProviderCommandReactor.ts     # Domain events → provider calls
    ├── ProviderCommandReactor.test.ts
    ├── CheckpointReactor.ts          # Git checkpoint management
    ├── OverseerReactor.ts            # AI quality monitoring
    ├── RuntimeReceiptBus.ts          # Lightweight event bus
    ├── ProjectionPipeline.ts         # DB write-side projections
    ├── ProjectionPipeline.test.ts
    ├── ProjectionSnapshotQuery.ts    # DB read-side reconstruction
    └── ProjectionSnapshotQuery.test.ts
```

---

## Core Flow: Command → Event → Projection

### Step 1: Command Arrives
```typescript
engine.dispatch(command)  // Returns Effect<{sequence: number}, OrchestrationDispatchError>
```
- Creates a `Deferred` result holder
- Offers `{ command, result }` envelope onto unbounded `Queue`
- Awaits the deferred with a 10-second timeout race

### Step 2: Sequential Worker Processes
```typescript
Effect.forever(Queue.take(commandQueue).pipe(Effect.flatMap(processEnvelope)))
```
- Single fiber drains the queue
- Checks `commandReceiptRepository` for idempotency (duplicate commands return cached result)
- Runs `decideOrchestrationCommand` to produce event(s)

### Step 3: Transaction — Persist + Project
```typescript
sql.withTransaction(() => Effect.gen(function* () {
    for (const nextEvent of eventBases) {
        const savedEvent = yield* eventStore.append(nextEvent);   // Persist
        nextReadModel = yield* projectEvent(nextReadModel, savedEvent); // Update in-memory
        committedEvents.push(savedEvent);
    }
    yield* commandReceiptRepository.upsert({ status: "accepted", ... });
}))
```
- All events from one command are committed in a single SQL transaction
- If the transaction succeeds: `readModel = committedCommand.nextReadModel`
- If it fails: reconciliation runs to rebuild read model from persisted events

### Step 4: Broadcast
```typescript
for (const event of committedCommand.committedEvents) {
    yield* PubSub.publish(eventPubSub, event);      // For reactors
}
yield* Effect.forEach(committedCommand.committedEvents, (event) =>
    projectionPipeline.projectEvent(event)          // For DB tables
);
```
- Events published to `PubSub` (domain event stream consumed by reactors)
- Events also sent to `ProjectionPipeline` for database persistence
- Projection failures after persistence are caught and logged (not fatal)

### Step 5: Reactors Consume
Reactors subscribe to either the `streamDomainEvents` (from PubSub) or `providerService.streamEvents` (provider runtime events) and take actions:
- **ProviderRuntimeIngestion**: converts provider runtime events → orchestration commands
- **ProviderCommandReactor**: converts orchestration domain events → provider API calls
- **CheckpointReactor**: captures git checkpoints on turn completion, handles revert
- **OverseerReactor**: monitors AI output quality, emits oversight activities

---

## Decider (decider.ts)

**File:** `apps/server/src/orchestration/decider.ts` (1126 lines)

### What It Does
A pure function that transforms an `OrchestrationCommand` into one or more `OrchestrationEvent`s. It validates preconditions (called "invariants") before producing events, and is wrapped in `Effect.fn` for typed error returns.

### Command Types Handled
| Command | Events Produced |
|---------|----------------|
| `project.create` | 1 (`project.created`) |
| `project.meta.update` | 1 (`project.meta-updated`) |
| `project.delete` | 1 (`project.deleted`) |
| `thread.create` | 1 (`thread.created`) |
| `thread.fork` | Multiple: `thread.created` + `thread.message-sent` (for each message) + `thread.proposed-plan-upserted` + `thread.turn-diff-completed` + `thread.activity-appended` |
| `thread.delete` | 1 (`thread.deleted`) |
| `thread.meta.update` | 1 (`thread.meta-updated`) |
| `thread.runtime-mode.set` | 1 (`thread.runtime-mode-set`) |
| `thread.interaction-mode.set` | 1 (`thread.interaction-mode-set`) |
| `thread.turn.start` | 2: `thread.message-sent` (user) + `thread.turn-start-requested` |
| `thread.turn.interrupt` | 1 (`thread.turn-interrupt-requested`) |
| `thread.approval.respond` | 2: `thread.approval-response-requested` + `thread.activity-appended` |
| `thread.user-input.respond` | 2: `thread.user-input-response-requested` + `thread.activity-appended` |
| `thread.checkpoint.revert` | 1 (`thread.checkpoint-revert-requested`) |
| `thread.session.stop` | 1 (`thread.session-stop-requested`) |
| `thread.session.set` | 1 (`thread.session-set`) |
| `thread.message.assistant.delta` | 1 (`thread.message-sent`) |
| `thread.message.assistant.complete` | 1 (`thread.message-sent`) |
| `thread.proposed-plan.upsert` | 1 (`thread.proposed-plan-upserted`) |
| `thread.turn.diff.complete` | 1 (`thread.turn-diff-completed`) |
| `thread.revert.complete` | 1 (`thread.reverted`) |
| `thread.activity.append` | 1 (`thread.activity-appended`) |
| `thread.restore` | 1 (`thread.restored`) |

### Fork Snapshot Logic (Complex)
`thread.fork` is the most complex command. It supports 3 fork sources:
- `kind: "latest"` — forks all checkpoints
- `kind: "message"` — forks up to and including a specific message, with turn boundary logic
- `kind: "checkpoint"` — forks up to a specific checkpoint turn count

**Fork excluded activity kinds** (not copied to new thread):
```typescript
const FORK_EXCLUDED_ACTIVITY_KINDS = new Set([
  "approval.requested",
  "approval.resolved",
  "provider.approval.respond.failed",
  "user-input.requested",
  "user-input.resolved",
]);
```

**Fork message retention fallback**: If a checkpoint-based fork retains fewer than `turnCount` user or assistant messages, it falls back to retaining the most recent messages from the source thread to maintain conversation coherence.

### Event Metadata
Every event gets:
- `eventId`: `crypto.randomUUID()`
- `correlationId`: set to `commandId` (enables tracing command→event chains)
- `causationEventId`: set to previous event's `eventId` in multi-event commands
- `metadata`: carries `requestId` for approval/user-input commands

### Fully Implemented vs Stubbed
**Fully implemented:** All command types have working logic. The `default` case uses a compile-time `satisfies never` check to ensure exhaustiveness.

### Notable Patterns
- Uses `Effect.fn` wrapper for typed error returns
- Fork creates new UUIDs for all copied entities (messages, plans, activities)
- Message IDs are mapped via `copiedMessageIds` so checkpoint references to assistant messages point to the new IDs
- `withEventBase` helper DRYs event construction

---

## Projector (projector.ts)

**File:** `apps/server/src/orchestration/projector.ts` (682 lines)

### What It Does
Updates the **in-memory read model** (`OrchestrationReadModel`) based on persisted events. This is the "read model updater" in event sourcing — events are immutable, but the projected state changes.

### Key Structures
```typescript
interface OrchestrationReadModel {
  snapshotSequence: number;      // Last applied event sequence
  updatedAt: string;
  projects: OrchestrationProject[];
  threads: OrchestrationThread[]; // Includes messages, activities, checkpoints, sessions
}
```

### Event Types Handled
- **Project events:** `project.created`, `project.meta-updated`, `project.deleted`
- **Thread lifecycle:** `thread.created`, `thread.deleted`, `thread.meta-updated`, `thread.runtime-mode-set`, `thread.interaction-mode-set`
- **Messages:** `thread.message-sent` — appended/updated in thread.messages
- **Turns:** `thread.turn-start-requested`, `thread.session-set`, `thread.message-sent` (assistant), `thread.turn-interrupt-requested`
- **Checkpoints:** `thread.turn-diff-completed`, `thread.reverted` (prunes checkpoints)
- **Plans/Activities:** `thread.proposed-plan-upserted`, `thread.activity-appended`
- **Session:** `thread.session-set`, `thread.session-stop-requested`
- **Restore:** `thread.restored` — full state reconstruction

### Retention Logic for `thread.reverted`
When a thread reverts to an earlier checkpoint turn count, the projector:
1. Filters checkpoints to those ≤ target turn count
2. Computes `retainedTurnIds` from remaining checkpoints
3. Retains messages from retained turns, plus fallback user/assistant messages if needed to maintain conversation coherence
4. Retains activities and proposed plans within the retained turn boundary
5. Slices arrays to limits: `MAX_THREAD_MESSAGES = 2000`, `MAX_THREAD_CHECKPOINTS = 500`

### Fully Implemented vs Stubbed
**Fully implemented:** All event types have handlers. The `default` case returns `Effect.succeed(nextBase)` — forward compatibility for new event types.

### Notable Patterns
- Uses `Effect.gen` for imperative-style Effect composition
- Decodes event payloads using `decodeForEvent` helper (Schema validation with context)
- **Anti-clobber guard**: In `thread.turn-diff-completed`, a "missing" status checkpoint cannot overwrite a "ready" status one (prevents provider placeholder events from overwriting real CheckpointReactor captures)
- `MAX_BUFFERED_ASSISTANT_CHARS` for spillover detection during streaming

---

## Schemas (Schemas.ts)

**File:** `apps/server/src/orchestration/Schemas.ts` (50 lines)

### What It Does
Re-exports all payload schemas from `@t3tools/contracts`. Acts as a central import point for orchestration-related schema definitions.

### Fully Implemented vs Stubbed
**Fully implemented.** No stubbed code.

---

## OrchestrationEngine (Layers/OrchestrationEngine.ts)

**File:** `apps/server/src/orchestration/Layers/OrchestrationEngine.ts` (271 lines)

### What It Does
The central coordinator that receives commands, routes them through the decider, persists events, updates the in-memory read model, and broadcasts events to reactors.

### Architecture
```
dispatch(command) → Queue (unbounded) → Worker fiber → processEnvelope
                                                        ├── Check idempotency (receipts)
                                                        ├── decideOrchestrationCommand (decider)
                                                        └── sql.withTransaction
                                                            ├── eventStore.append (per event)
                                                            ├── projectEvent (in-memory)
                                                            └── commandReceiptRepository.upsert
                                                    ↓ (on success)
                                                    PubSub.publish (domain events)
                                                    ProjectionPipeline.projectEvent (async)
                                                    Deferred.resolve
                                                    ↓ (on failure)
                                                    reconcileReadModelAfterDispatchFailure
                                                    Deferred.fail
```

### Key Design Decisions

**1. Unbounded queue, single worker**
Commands are processed sequentially by a single forked fiber. This avoids locking complexity but means command processing is strictly serial.

**2. Idempotency via Command Receipts**
Before processing, the engine checks `commandReceiptRepository`. If a command was previously accepted, it returns the cached sequence. If rejected, it fails with `OrchestrationCommandPreviouslyRejectedError`.

**3. Reconciliation on dispatch failure**
If the transaction succeeds but projection fails, `reconcileReadModelAfterDispatchFailure` rebuilds the in-memory read model by re-playing events from the event store from the snapshot sequence onwards. This ensures the in-memory state matches persisted state after failures.

**4. 10-second dispatch timeout**
```typescript
const timeoutEffect = Effect.sleep("10 seconds").pipe(
    Effect.flatMap(() => {
        console.log(`[dispatch:${command.commandId}] TIMEOUT FIRED — stack:\n${new Error().stack}`);
        return Effect.fail(new OrchestrationDispatchTimeoutError({ commandId }));
    }),
);
return yield* Deferred.await(result).pipe(Effect.race(timeoutEffect));
```
On timeout, logs the full stack trace for debugging.

**5. Per-aggregate queuing is NOT implemented**
The engine uses a single queue for all commands. Aggregate-level ordering (e.g., per-project or per-thread queues) is not implemented, though `commandToAggregateRef` exists as a helper.

**6. Event PubSub for domain events**
```typescript
get streamDomainEvents() {
    return Stream.fromPubSub(eventPubSub);
}
```
Each access creates a **fresh subscription** so multiple consumers (wsServer, ProviderRuntimeIngestion, CheckpointReactor, etc.) independently receive all domain events.

### Fully Implemented vs Stubbed
**Fully implemented.** The reconciliation logic is particularly well-tested:
- "keeps processing queued commands after a storage failure" (flaky append)
- "events persist and dispatch succeeds even when projection fails"
- "reconciles in-memory state when append persists but projection fails"
- "fails command dispatch when command invariants are violated"
- "rejects duplicate thread creation"

### Notable Patterns
- Uses `Effect.gen` with `Layer.effect` for dependency injection
- Console.log statements in worker for command lifecycle tracing
- `.pipe(Effect.catchTag(...))` for typed error handling
- `Schema.is(...)` for type narrowing in error handling

---

## WorkflowEngine (Layers/WorkflowEngine.ts)

**File:** `apps/server/src/orchestration/Layers/WorkflowEngine.ts` (234 lines)

### What It Does
Detects AI agent workflow/harness type from user messages and project context, returning instructions and configuration for how the AI should operate.

### Workflow Types
| Type | Description |
|------|-------------|
| `careful-builder` | For non-coders; emphasizes verification and user-facing explanations |
| `fast-prototyper` | Rapid iteration, exploratory coding |
| `systematic-debugger` | Bug investigation and resolution |
| `code-reviewer` | PR/review focused |
| `refactorer` | Code improvement without behavior change |

### Detection
Uses regex patterns on the first user message:

```typescript
const PLANNING_PATTERNS = [
  /^(?:\*\*)?Plan(?:ing)?(?:\*\*)?[:.\-]?/i,
  /\bplan\b.*(?:build|create|add|implement|fix|update)/i,
  /\bwhat\s+(?:to|should\s+we)\s+(?:build|do|create|add|implement)\b/i,
];

const DEBUGGING_PATTERNS = [
  /\b(?:debug(?:ging)?|fix(?:ing)?|broken|not\s+working|crash(?:es|ing)?|error)\b/i,
  /\bnull(?:ish)?|undefined\b.*\b(?:error|issue|problem)\b/i,
  /\btest(?:ing)?\s+(?:is\s+)?fail(?:ing|ed|s)?\b/i,
];

// Also checks project metadata files:
// - AGENTS.md → "handover" workflow
// - .cursorrules → "fast-prototyper"
```

### Fully Implemented vs Stubbed
**Fully implemented.** All 5 workflows have complete instruction templates.

### Notable Patterns
- Reads project metadata files to influence workflow detection
- Agent type selection affects AI behavior (e.g., careful-builder adds verification reminders)
- `BuildAgnosticAgent` type represents an AI that works without filesystem access

---

## Providers Runtime Ingestion (Layers/ProviderRuntimeIngestion.ts)

**File:** `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts` (1327 lines)

### What It Does
Consumes provider runtime events (from `providerService.streamEvents`) and domain events, then dispatches orchestration commands to reflect the provider's state in the orchestration layer. Also handles buffering of streaming assistant text and proposed plans.

### Two Input Sources
1. **`providerService.streamEvents`** — runtime events (e.g., `turn.completed`, `content.delta`, `item.started`)
2. **`orchestrationEngine.streamDomainEvents`** — domain events (only `thread.turn-start-requested`)

### Key Transformations

**`content.delta` (assistant_text) → buffered or direct dispatch:**
```typescript
if (assistantDeliveryMode === "buffered") {
    const spillChunk = yield* appendBufferedAssistantText(messageId, assistantDelta);
    if (spillChunk.length > 0) {
        // Spill to DB when buffer exceeds MAX_BUFFERED_ASSISTANT_CHARS (5000)
        yield* dispatch({ type: "thread.message.assistant.delta", ... });
    }
} else {
    // Direct dispatch
    yield* dispatch({ type: "thread.message.assistant.delta", ... });
}
```

**`turn.completed` → finalizes buffered content:**
- Flushes all pending assistant message deltas for the turn
- Finalizes buffered proposed plans
- Clears turn-level caches

**`turn.diff.updated` → placeholder checkpoint:**
```typescript
yield* dispatch({
    type: "thread.turn.diff.complete",
    status: "missing",  // Placeholder until CheckpointReactor replaces it
    checkpointRef: CheckpointRef.makeUnsafe(`provider-diff:${event.eventId}`),
    ...
});
```

**Auto-accept approvals in full-access mode:**
```typescript
if (event.type === "request.opened" &&
    thread.runtimeMode === "full-access" &&
    event.payload.requestType !== "tool_user_input") {
    yield* providerService.respondToRequest({ decision: "acceptForSession", ... });
    return; // Skip creating the approval activity
}
```

### Caches
- `turnMessageIdsByTurnKey` — tracks which assistant message IDs belong to each turn
- `bufferedAssistantTextByMessageId` — accumulates streaming text
- `bufferedProposedPlanById` — accumulates proposed plan deltas

### Fully Implemented vs Stubbed
**Fully implemented.** Has comprehensive handling for all provider runtime event types.

### Notable Patterns
- Uses a `DrainableWorker` to process events sequentially while allowing fork/scoped fiber management
- `STRICT_PROVIDER_LIFECYCLE_GUARD` flag (defaults to `false`) controls whether turn events are rejected if they conflict with active turn state
- Lifecycle state machine for sessions/turns with status derivation logic
- Handles token usage snapshots for both "turn" and "thread" granularity

---

## ProviderCommandReactor (Layers/ProviderCommandReactor.ts)

**File:** `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts` (1251 lines)

### What It Does
Subscribes to domain events from `orchestrationEngine.streamDomainEvents` and calls the `ProviderService` API in response. This is the "write" side of the provider integration — where orchestration decisions trigger actual AI provider actions.

### Event → Action Mapping

| Domain Event | Provider Action |
|--------------|-----------------|
| `thread.turn-start-requested` | `providerService.sendTurn()` |
| `thread.turn-interrupt-requested` | `providerService.stopTurn()` |
| `thread.approval-response-requested` | `providerService.respondToRequest()` |
| `thread.user-input-response-requested` | `providerService.respondToUserInput()` |
| `thread.session-stop-requested` | `providerService.stopSession()` |
| `thread.runtime-mode-set` | May trigger session restart |

### Per-Thread Lanes
```typescript
const perThreadLanesRef = Ref.make<Map<ThreadId, Lane>>(new Map());

const Lane = {
    queue: Queue.Queue<ProviderIntentEvent>,
    fiber: Fiber.Fiber<never, unknown>,
};
```
Each thread has its own `Queue + Fiber` processing lane, ensuring commands for different threads are processed concurrently while commands for the **same thread** are processed sequentially (via semaphore with 1 permit).

### Context Enrichment (sendTurnForThread)
The reactor builds a rich context block for AI turns including:
- **AGENTS.md** instructions wrapped in `<workspace_instructions>` tags
- **Project brief** (`<brief>`)
- **Goals** from database (`<goals>` with main/sub distinction)
- **Features** from database (`<features>`)
- **Thread goal** from thread metadata
- **Sibling threads** (up to 5 recent threads in same project, excluding PM/Skill Generator threads)
- **Verification reminder** (anti-completion-claim instructions)
- **Project rules** from database prompts service
- **Relevant memories** from deep memory system
- **Resume context** from previous thread activities (trimmed to 1500 tokens max)

### Fully Implemented vs Stubbed
**Fully implemented.** Well-tested with complex fork scenarios, storage failure resilience, and projection failure recovery.

### Notable Patterns
- **Temporary worktree branch renaming**: On first turn with a temp branch name (pattern `rowl/<hash>`), generates a meaningful branch name via `textGeneration.generateBranchName`
- **Session reuse**: Checks if existing session can be reused or needs restart based on provider/model/runtime mode changes
- **Idempotency via `hasHandledTurnStartRecently`**: Uses a time-windowed cache to deduplicate turn-start events (30-minute TTL, 10,000 entry capacity)
- **Semaphore per thread**: `sem.withPermits(1)` ensures sequential turn processing per thread

---

## CheckpointReactor (Layers/CheckpointReactor.ts)

**File:** `apps/server/src/orchestration/Layers/CheckpointReactor.ts` (819 lines)

### What It Does
Manages git-based checkpoints for threads. Subscribes to domain events and provider runtime events to capture snapshots at turn boundaries and supports revert operations.

### Two Input Sources
1. **Domain events**: `thread.turn-start-requested`, `thread.message-sent`, `thread.checkpoint-revert-requested`, `thread.turn-diff-completed`
2. **Runtime events**: `turn.started`, `turn.completed`

### Checkpoint Capture Flow
```
turn.started (runtime)
  → ensurePreTurnBaselineFromTurnStart
    → captureCheckpoint (git stash + git checkout -b)

thread.turn-start-requested (domain, user message)
  → ensurePreTurnBaselineFromDomainTurnStart
    → captureCheckpoint (git stash + git checkout -b)

turn.completed (runtime)
  → captureCheckpointFromTurnCompletion
    → git add -A && git commit
    → Publish "checkpoint.baseline.captured" to RuntimeReceiptBus
```

### Revert Flow
```
thread.checkpoint-revert-requested (domain)
  → handleRevertRequested
    → checkpointStore.restoreCheckpoint (git checkout)
    → providerService.rollbackConversation (provider-level rollback)
    → checkpointStore.deleteCheckpointRefs (cleanup stale checkpoints)
    → orchestrationEngine.dispatch("thread.revert.complete")
      → projector updates thread state (prunes messages/checkpoints/activities)
```

### Checkpoint Anti-Clobber
When ProviderRuntimeIngestion creates a placeholder checkpoint (status "missing") from `turn.diff.updated`, CheckpointReactor replaces it with a real git-based capture. The anti-clobber guard in the projector:
```typescript
if (existing && existing.status !== "missing" && checkpoint.status === "missing") {
    return nextBase; // Don't overwrite real checkpoint with placeholder
}
```

### Fully Implemented vs Stubbed
**Fully implemented.** Handles baseline creation, turn completion capture, revert, and placeholder replacement.

### Notable Patterns
- Uses `RuntimeReceiptBus` to publish checkpoint receipts (separate from domain events)
- `resolveCheckpointCwd` determines git working directory (session runtime cwd vs worktree path)
- Captures failures as `overseer.checkpoint-capture.failed` activities
- On revert failure, still dispatches `thread.revert.complete` but with failure activity logged

---

## OverseerReactor (Layers/OverseerReactor.ts)

**File:** `apps/server/src/orchestration/Layers/OverseerReactor.ts` (540 lines)

### What It Does
Monitors AI output quality and system health, emitting oversight activities when issues are detected. Targets non-coder users who can't read code to verify AI claims.

### Detection Patterns

| Issue | Pattern | Activity |
|-------|---------|----------|
| **Capability Forgetfulness** | AI claims it can't do something it can | `overseer.capability-forgetfulness` |
| **Technical Delegation** | AI asks user to run commands | `overseer.technical-delegation` |
| **Dangerous Commands** | `rm -rf`, `DROP TABLE`, `git push --force` | `overseer.dangerous-command` |
| **Premature Completion** | AI claims work is done without verification | `overseer.premature-completion` |
| **Uncertainty/Hedging** | AI expresses low confidence | `overseer.certainty-warning` |
| **Loop Detection** | Same error 3 times in a row | `overseer.loop-detected` |
| **Context Exhaustion** | Token count > 180K | `overseer.context-exhaustion` (auto-generates handoff briefing) |

### Context Budget Monitoring
- At 160K tokens: warning activity
- At 180K tokens: generates handoff briefing via `handoffService.generateBriefing` and creates `overseer.context-exhaustion` activity

### Memory Extraction
On `turn.completed`, extracts structured memories from AI output:
- **Decisions**: "I decided to use X because..."
- **Architecture**: File/pattern creation events
- **Preferences**: Configuration decisions
- **Facts**: Project-level information

### Fully Implemented vs Stubbed
**Fully implemented.** All detection patterns have regex-based implementations.

### Notable Patterns
- **Text buffer sampling**: Checks every 500 characters of accumulated assistant text
- `recentErrorsByThread` is a module-level Map (not Effect-managed) for loop detection state
- Context node auto-creation on turn completion via `contextService.createContextNode`
- Evaluator runs on `turn.completed` state === "completed"
- Fails open: catches all errors and logs warnings instead of failing the reactor

---

## RuntimeReceiptBus (Layers/RuntimeReceiptBus.ts)

**File:** `apps/server/src/orchestration/Layers/RuntimeReceiptBus.ts` (18 lines)

### What It Does
A lightweight `PubSub`-based event bus for CheckpointReactor to publish checkpoint receipts. This is separate from the main domain event PubSub to isolate checkpoint-specific events.

### Fully Implemented vs Stubbed
**Fully implemented.** Simple pub/sub wrapper.

---

## ProjectionPipeline (Layers/ProjectionPipeline.ts)

**File:** `apps/server/src/orchestration/Layers/ProjectionPipeline.ts` (1258 lines)

### What It Does
Writes events to database tables (the "write side" of projections). Runs 9 projectors concurrently (sequentially per projector, concurrent across projectors).

### Projectors

| Projector | Repository | Purpose |
|-----------|------------|---------|
| `projects` | `ProjectionProjectRepository` | Project metadata |
| `threads` | `ProjectionThreadRepository` | Thread metadata (updatedAt, latestTurnId) |
| `threadMessages` | `ProjectionThreadMessageRepository` | Messages with text accumulation for streaming |
| `threadProposedPlans` | `ProjectionThreadProposedPlanRepository` | Proposed plans |
| `threadActivities` | `ProjectionThreadActivityRepository` | Activity log |
| `threadSessions` | `ProjectionThreadSessionRepository` | Session state |
| `threadTurns` | `ProjectionTurnRepository` | Turn lifecycle + checkpoint data |
| `checkpoints` | N/A | **STUBBED** — `applyCheckpointsProjection` is `() => Effect.void` |
| `pendingApprovals` | `ProjectionPendingApprovalRepository` | Approval request tracking |

### Transaction Per Projector
Each projector runs in its own transaction:
```typescript
yield* sql.withTransaction(
    projector.apply(event, attachmentSideEffects).pipe(
        Effect.flatMap(() =>
            projectionStateRepository.upsert({ projector, lastAppliedSequence: event.sequence })
        )
    )
);
```

### Side Effects (Attachment Cleanup)
After projector application, `runAttachmentSideEffects` handles:
- **Deleted threads**: Removes attachment files from workspace
- **Pruned messages on revert**: Collects and removes attachment files for deleted messages

### Bootstrap
Each projector bootstraps by:
1. Reading its last applied sequence from `projection_state` table
2. Replaying all events from that sequence onwards

### Fully Implemented vs Stubbed
**Mostly implemented.** The `applyCheckpointsProjection` is a stub:
```typescript
const applyCheckpointsProjection: ProjectorDefinition["apply"] = () => Effect.void;
```
Checkpoints are stored in `projection_turns` table (via `threadTurns` projector), not a separate table. The separate `projection_checkpoints` table appears unused.

### Notable Patterns
- Uses `Effect.forEach` with `concurrency: 1` to process projectors sequentially
- Attachment side effects run **after** the transaction commits, with error handling (doesn't fail the projection)
- `ProjectionState` tracks `lastAppliedSequence` per projector for bootstrap recovery

---

## ProjectionSnapshotQuery (Layers/ProjectionSnapshotQuery.ts)

**File:** `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts` (588 lines)

### What It Does
Reads all projection tables and reconstructs a full `OrchestrationReadModel`. Used for cold starts and read model reconstruction.

### Snapshot Sequence Computation
```typescript
function computeSnapshotSequence(stateRows): number {
    const sequenceByProjector = new Map(stateRows.map(r => [r.projector, r.lastAppliedSequence]));
    let minSequence = Infinity;
    for (const projector of REQUIRED_SNAPSHOT_PROJECTORS) {
        const sequence = sequenceByProjector.get(projector);
        if (sequence === undefined) return 0;  // Any missing = can't trust snapshot
        minSequence = Math.min(minSequence, sequence);
    }
    return minSequence;
}
```
The snapshot sequence is the **minimum** of all projector states — if any projector is behind, the full minimum is used.

### Required Snapshot Projectors
```typescript
const REQUIRED_SNAPSHOT_PROJECTORS = [
    projects, threads, threadMessages, threadProposedPlans,
    threadActivities, threadSessions, checkpoints
];
```

### Fully Implemented vs Stubbed
**Fully implemented.** All projection tables are queried and joined to reconstruct the read model.

### Notable Patterns
- Uses `effect/unstable-sql` for typed SQL queries with schema mapping
- Groups messages, plans, activities, checkpoints, sessions by thread for efficient lookup
- `latestTurnByThread` uses `ORDER BY requested_at DESC` and `take(1)` per thread
- JSON fields decoded via `Schema.fromJsonString`

---

## Errors (Errors.ts)

**File:** `apps/server/src/orchestration/Errors.ts` (188 lines)

### Error Hierarchy

```
OrchestrationDispatchError (union)
├── ProjectionRepositoryError (from persistence layer)
├── OrchestrationCommandInvariantError    — Precondition failed (e.g., thread not found)
├── OrchestrationCommandPreviouslyRejectedError — Idempotency: command was already rejected
├── OrchestrationProjectorDecodeError    — Schema decode failure in projector
├── OrchestrationListenerCallbackError    — Listener (read-model/domain-event) callback failed
└── OrchestrationDispatchTimeoutError      — 10-second dispatch timeout

OrchestrationEngineError (union)
├── OrchestrationDispatchError
├── OrchestrationCommandJsonParseError   — Command JSON parsing failed
└── OrchestrationCommandDecodeError       — Command payload decode failed

FeatureServiceError    — Feature management errors
GoalServiceError       — Goal management errors
ContextServiceError    — Context service errors
PMChatContextServiceError — PM chat context errors
```

### Fully Implemented vs Stubbed
**Fully implemented.** All error types use `Schema.TaggedErrorClass` for Effect compatibility.

---

## Command Invariants (commandInvariants.ts)

**File:** `apps/server/src/orchestration/commandInvariants.ts` (and `commandInvariants.test.ts`)

### What It Does
Validation functions that check preconditions before the decider produces events. They return `Effect<void, OrchestrationCommandInvariantError>` — if the invariant fails, the command is rejected.

### Invariants

| Function | Purpose | Error Detail |
|----------|---------|--------------|
| `requireProject` | Project must exist | `Project '${id}' does not exist` |
| `requireProjectAbsent` | Project must NOT exist | `Project '${id}' already exists` |
| `requireThread` | Thread must exist | `Thread '${id}' does not exist` |
| `requireThreadAbsent` | Thread must NOT exist | `Thread '${id}' already exists` |
| `requireNonNegativeInteger` | Value must be ≥ 0 | `Expected non-negative integer` |

### Fully Implemented vs Stubbed
**Fully implemented.** All invariants have tests covering both success and failure paths.

---

## Known Issues & Quirks

### 1. Checkpoint Projector is Stubbed
```typescript
const applyCheckpointsProjection: ProjectorDefinition["apply"] = () => Effect.void;
```
The `checkpoints` projector does nothing. Checkpoints are actually stored in the `projection_turns` table via the `threadTurns` projector. The separate `projection_checkpoints` table appears unused.

### 2. Single Queue Bottleneck
All commands (across all projects/threads) go through a single unbounded queue processed by one fiber. High command volume for one thread can delay commands for other threads. Per-thread lanes exist in `ProviderCommandReactor` but the engine itself doesn't partition.

### 3. Detached Projection Failures
When `projectionPipeline.projectEvent` fails (after event persistence succeeds), the error is caught and logged but the command still succeeds:
```typescript
yield* projectionPipeline.projectEvent(event).pipe(
    Effect.catchTag("PersistenceSqlError", () => Effect.void),
    Effect.catchTag("PersistenceDecodeError", () => Effect.void),
);
```
This means the in-memory read model and the database tables can diverge after a projection failure. The reconciliation logic only runs on dispatch failure, not when projection silently fails.

### 4. ProviderRuntimeIngestion `STRICT_PROVIDER_LIFECYCLE_GUARD`
This flag (defaults to `false`) controls whether turn events are rejected if they conflict with the tracked active turn state. When `false`, all events are accepted regardless of lifecycle state machine validity. This is a known relaxation for robustness.

### 5. Hardcoded Provider Names in Check
```typescript
const currentProvider: ProviderKind | undefined =
    thread.session?.providerName === "codex" ||
    thread.session?.providerName === "copilot" ||
    ...
```
Extending to new providers requires updating this pattern in multiple places.

### 6. `recentErrorsByThread` is Module-Level State
The loop detection map in `OverseerReactor` uses module-level mutable state rather than an Effect-managed `Ref`. This works but is not idiomatic Effect.

### 7. Console.log Usage in OrchestrationEngine
The engine uses `console.log` for tracing:
```typescript
console.log(`[worker] transaction done, readModel updated id=${envelope.command.commandId}`);
console.log(`[dispatch] offered command=${command.type} id=${command.commandId}`);
```
This is functional but not consistent with Effect's `Effect.log*` approach.

### 8. OverseerReactor Does Not Use DrainableWorker
Unlike other reactors, `OverseerReactor` processes events directly in `Stream.runForEach` without a `DrainableWorker` buffer. This means backpressure is managed by the stream itself, not an explicit queue.

### 9. ProjectionBootstrap Min Sequence
```typescript
const minSequence = Number.isFinite(minSequence) ? minSequence : 0;
```
If any required projector is missing from `projection_state`, the entire snapshot sequence falls back to 0, triggering a full replay. This is conservative but could cause slow startup if projector state is corrupted.

### 10. Attachment Side Effects Run Outside Transaction
```typescript
yield* runAttachmentSideEffects(attachmentSideEffects).pipe(
    Effect.catch(...)  // Errors are caught but file deletion is not transactional
);
```
File deletion for attachments happens outside the SQL transaction, so a crash between commit and file deletion leaves orphaned files.

---

## Summary

| Component | Status | Lines |
|----------|--------|-------|
| Decider | ✅ Fully implemented | 1126 |
| Projector | ✅ Fully implemented | 682 |
| OrchestrationEngine | ✅ Fully implemented | 271 |
| WorkflowEngine | ✅ Fully implemented | 234 |
| ProviderRuntimeIngestion | ✅ Fully implemented | 1327 |
| ProviderCommandReactor | ✅ Fully implemented | 1251 |
| CheckpointReactor | ✅ Fully implemented | 819 |
| OverseerReactor | ✅ Fully implemented | 540 |
| RuntimeReceiptBus | ✅ Fully implemented | 18 |
| ProjectionPipeline | ⚠️ Mostly (checkpoints stub) | 1258 |
| ProjectionSnapshotQuery | ✅ Fully implemented | 588 |
| Errors | ✅ Fully implemented | 188 |
| commandInvariants | ✅ Fully implemented | ~100 |

**Overall Assessment**: The orchestration core is a well-designed, production-quality event-sourced system. The main quirks are the stubbed checkpoint projector, the single-queue bottleneck, and the detached projection failure handling. These are known trade-offs rather than bugs.
