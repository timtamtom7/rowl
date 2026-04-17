# Server Persistence Layer Analysis

## Overview

The Rowl server persistence layer uses **SQLite** as its sole database engine, accessed via the native `node:sqlite` module (Node.js 22.16+ / 23.11+). All persistence is implemented through the **Effect** ecosystem (`effect/unstable/sql*`), using a layered architecture of Service interfaces and Layer implementations. The system comprises an event store, multiple read-model projections, and a migration system.

---

## 1. NodeSqliteClient

### What it does
A Effect-compatible SQLite client layer that wraps the native `node:sqlite` module (`DatabaseSync`, `StatementSync`), providing prepared statement caching, parameterized query execution, and connection management. This is the foundational driver for all database operations.

### How data is stored and queried
- Uses `DatabaseSync` (synchronous, single-threaded SQLite access)
- Prepared statements are cached in an Effect `Cache` (default 200 entries, 10-minute TTL)
- Query execution uses tagged template literals: `` sql`SELECT ...` ``
- Supports `execute`, `executeRaw`, `executeValues`, and `executeUnprepared`
- `executeStream` is implemented as `Stream.die("executeStream not implemented")` — **NOT implemented**
- Query result names can be transformed via `transformResultNames` / `transformQueryNames` config

### Migration system
Not applicable — this is the driver layer.

### Implementation status
| Feature | Status |
|---------|--------|
| Prepared statement caching | ✅ Implemented |
| WAL journal mode | ✅ Set in `Sqlite.ts` setup layer |
| Foreign keys | ✅ Enforced in `Sqlite.ts` setup layer |
| `executeStream` | ❌ Stub — throws `Stream.die` |
| `SafeIntegers` support | ✅ Via `ServiceMap.get(fiber.services, Client.SafeIntegers)` |
| Node version check | ✅ `checkNodeSqliteCompat()` validates Node 22.16+ / 23.11+ |

### Notable patterns and quirks
- The `SqliteClient` service tag is `rowl/persistence/NodeSqliteClient`, while the Effect SQL client tag is `effect/unstable/sql/SqlClient` — both are registered in the layer
- Two layer constructors: `layer(config)` for file-based DB and `layerMemory(config)` for `:memory:` — both use `DatabaseSync`
- The `Reactivity` layer (`effect/unstable/reactivity/Reactivity`) is required as a dependency for all client layers
- The client uses `Semaphore.make(1)` to serialize connection access — a single-writer model

---

## 2. Migrations System

### What it does
A migration runner built on `effect/unstable/sql/Migrator` that automatically runs all schema migrations on startup. Uses static imports of migration files (not dynamic file loading) and a naming convention `{id}_{name}` for migration keys.

### How migrations are organized
23 migrations are statically imported in `Migrations.ts` and registered via `Migrator.fromRecord`:

| # | Name | Purpose |
|---|------|---------|
| 001 | OrchestrationEvents | Creates `orchestration_events` table + indexes |
| 002 | OrchestrationCommandReceipts | Creates `orchestration_command_receipts` table + indexes |
| 003 | CheckpointDiffBlobs | Creates `checkpoint_diff_blobs` table + indexes |
| 004 | ProviderSessionRuntime | Creates `provider_session_runtime` table + indexes |
| 005 | Projections | Creates all core projection tables (projects, threads, messages, activities, sessions, turns, pending_approvals, state) + indexes |
| 006 | ProjectionThreadSessionRuntimeModeColumns | Adds `runtime_mode` column to `projection_thread_sessions` |
| 007 | ProjectionThreadMessageAttachments | Adds `attachments_json` column to `projection_thread_messages` |
| 008 | ProjectionThreadActivitySequence | Adds `sequence` column to `projection_thread_activities` + index |
| 009 | ProviderSessionRuntimeMode | **STUB — does nothing** |
| 010 | ProjectionThreadsRuntimeMode | Adds `runtime_mode` column to `projection_threads` |
| 011 | OrchestrationThreadCreatedRuntimeMode | Backfills `runtimeMode: 'full-access'` in `thread.created` events |
| 012 | ProjectionThreadsInteractionMode | Adds `interaction_mode` column to `projection_threads` |
| 013 | ProjectionThreadProposedPlans | Creates `projection_thread_proposed_plans` table + index |
| 014 | ProjectionThreadSessionTokenUsage | Conditionally adds `token_usage_json` column to `projection_thread_sessions` |
| 015 | SanitizePersistedProviderOptions | Sanitizes `providerOptions` in `provider_session_runtime` and `orchestration_events` |
| 016 | ProjectionThreadSessionStartedAt | Conditionally adds `started_at` column to `projection_thread_sessions` |
| 017 | ProjectionGoals | Creates `projection_goals` table + index |
| 018 | ProjectionFeatures | Creates `projection_features` table + indexes |
| 019 | ProjectionContextNodes | Creates `projection_context_nodes` table + indexes |
| 020 | MemoryEntries | Creates `memory_entries` table + FTS5 virtual table + triggers |
| 021 | CodebaseHealth | Creates `codebase_health` table + indexes |
| 022 | ProjectPrompts | Creates `project_prompts` and `harness_presets` tables |
| 023 | FeatureThreadLinks | Creates `feature_thread_links` table + index |

### Implementation status
| Migration | Status | Notes |
|-----------|--------|-------|
| 009 | ❌ **STUB** | Only yields `SqlClient.SqlClient`, runs no SQL. Likely meant to add a column. |
| 014 | ⚠️ Conditional | Uses `PRAGMA table_info` check before `ALTER TABLE` |
| 016 | ⚠️ Conditional | Same conditional pattern as 014 |
| 020 | ⚠️ Special | Uses `sql.unsafe()` for multi-statement trigger DDL bodies |
| 015 | ⚠️ Complex | Uses `sanitizeProviderOptionsRecordForPersistence` from `providerOptions.ts` |

### Notable patterns and quirks
- Migration 011 uses SQLite's `json_set()` and `json_type()` functions for backfilling — elegant but SQLite-specific
- Migration 020 defines FTS5 triggers with `sql.unsafe()` because the Effect SQL template tag doesn't support multi-statement trigger bodies
- There is **no down migration** support — migrations are one-way
- Migrations run inside the same transaction as the application startup via `Layer.effectDiscard(runMigrations)` in `Sqlite.ts`
- `provider_session_runtime` table has **no migration that adds a `runtime_mode` column** — it was added in migration 004 with `DEFAULT 'full-access'`, but migration 009 is a no-op stub that might have been intended for that

---

## 3. Core Services and Layers

### 3.1 OrchestrationEventStore

**Service** (`Services/OrchestrationEventStore.ts`): Defines the event store interface with `append`, `readFromSequence`, and `readAll` operations.

**Layer** (`Layers/OrchestrationEventStore.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Append events | ✅ Implemented |
| Stream replay from sequence | ✅ Implemented with paging (500 rows/page) |
| Stream replay all | ✅ `readFromSequence(0, MAX_SAFE_INTEGER)` |
| Legacy provider field sanitization | ✅ `sanitizeLegacyProviderFields()` — normalizes unknown provider strings to `"codex"` |
| Actor kind inference | ✅ `inferActorKind()` — derives from `commandId` prefix and metadata fields |
| Invalid JSON handling | ✅ Returns `PersistenceDecodeError` |

**Schema Details:**
- Events stored with `sequence` (autoincrement), `event_id` (unique), `aggregate_kind`, `stream_id`, `stream_version`, `event_type`, `occurred_at`, `command_id`, `causation_event_id`, `correlation_id`, `actor_kind`, `payload_json`, `metadata_json`
- `stream_version` is computed as `MAX(stream_version) + 1` per aggregate stream — no locking, subject to race conditions under concurrent writes
- **Notable**: `payload` and `metadata` are stored as JSON strings and decoded on read using `Schema.fromJsonString`

**Known issues:**
- `stream_version` computation is a **race condition** under concurrent appends to the same aggregate stream — two concurrent appends could get the same version
- The `OFFSET` clause is not used in replay pagination; instead, cursoring uses the last read sequence — correct

### 3.2 OrchestrationCommandReceipts

**Service** (`Services/OrchestrationCommandReceipts.ts`): Interface with `upsert` and `getByCommandId`.

**Layer** (`Layers/OrchestrationCommandReceipts.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert by commandId | ✅ `ON CONFLICT (command_id) DO UPDATE` |
| Get by commandId | ✅ `SqlSchema.findOneOption` |
| Error handling | ✅ `toPersistenceSqlError` |

### 3.3 ProviderSessionRuntime

**Service** (`Services/ProviderSessionRuntime.ts`): Interface with `upsert`, `getByThreadId`, `list`, `listThreadIds`, `deleteByThreadId`.

**Layer** (`Layers/ProviderSessionRuntime.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert by threadId | ✅ |
| Get by threadId | ✅ |
| List all | ✅ Ordered by `last_seen_at ASC` |
| List thread IDs only | ✅ Optimized — avoids decoding JSON payloads |
| Delete by threadId | ✅ |
| JSON decode for `resumeCursor` and `runtimePayload` | ✅ `Schema.fromJsonString(Schema.Unknown)` |

**Known issue:** No migration adds `runtime_mode` column to `provider_session_runtime` — it was in the initial migration 004, but migration 009 (supposed to modify it) is a stub.

### 3.4 ProjectionState

**Service** (`Services/ProjectionState.ts`): Cursor tracking for projectors.

**Layer** (`Layers/ProjectionState.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert projector cursor | ✅ |
| Get by projector | ✅ |
| List all | ✅ Ordered by projector name |
| Min last applied sequence | ✅ `SELECT MIN(last_applied_sequence)` |

### 3.5 ProjectionCheckpoints

**Service** (`Services/ProjectionCheckpoints.ts`): Checkpoint repository interface.

**Layer** (`Layers/ProjectionCheckpoints.ts`): Full implementation.

**⚠️ CRITICAL ARCHITECTURAL ISSUE**: `ProjectionCheckpointRepository` stores data in the **`projection_turns`** table (via `upsertProjectionCheckpointRow` INSERTing into `projection_turns`), NOT in a dedicated checkpoint table. The `ProjectionTurnRepository` also writes to `projection_turns`. This means:

1. Checkpoint rows and turn rows share the same table
2. `ProjectionCheckpointRepository.upsert()` calls `sql.withTransaction(clearCheckpointConflict + upsert)` — the conflict clearing is meant to prevent duplicate checkpoint turn counts within a thread
3. The repository does NOT use the `SqlSchema` helpers consistently — uses `sql.withTransaction` directly

**Known issue:** Checkpoint data lives in `projection_turns` with `checkpoint_turn_count IS NOT NULL` filter — this is a repurposing of the turns table for checkpoint storage.

### 3.6 ProjectionGoals

**Service** (`Services/ProjectionGoals.ts`): Goals interface.

**Layer** (`Layers/ProjectionGoals.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| Get by id | ✅ |
| List by project | ✅ Ordered `is_main DESC, created_at ASC` |
| Delete by id | ✅ |
| Clear main goal for project | ✅ `UPDATE ... SET is_main = 0 WHERE project_id = ... AND goal_id != ...` |

**Notable:** `linkedThreadIds` is stored as JSON and decoded via `Schema.fromJsonString(Schema.Array(ThreadId))`.

### 3.7 ProjectionFeatures

**Service** (`Services/ProjectionFeatures.ts`): Features interface.

**Layer** (`Layers/ProjectionFeatures.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| Get by id | ✅ |
| List by project | ✅ Ordered by `created_at ASC` |
| Delete by id | ✅ |

### 3.8 ProjectionProjects

**Service** (`Services/ProjectionProjects.ts`): Projects interface.

**Layer** (`Layers/ProjectionProjects.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| Get by id | ✅ |
| List all | ✅ Ordered by `created_at ASC, project_id ASC` |
| Soft delete | ❌ `deleteById` runs `DELETE` (hard delete), not `UPDATE SET deleted_at` — **inconsistent with service description** |

**Schema note:** `scripts` is stored as JSON via `Schema.fromJsonString(Schema.Array(ProjectScript))`.

### 3.9 ProjectionThreads

**Service** (`Services/ProjectionThreads.ts`): Threads interface.

**Layer** (`Layers/ProjectionThreads.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| Get by id | ✅ |
| List by project | ✅ Ordered by `created_at ASC, thread_id ASC` |
| Soft delete | ❌ `deleteById` is hard `DELETE` — **same issue as ProjectionProjects** |

**Schema includes:** `runtimeMode` and `interactionMode` columns added by migrations 010 and 012.

### 3.10 ProjectionThreadSessions

**Service** (`Services/ProjectionThreadSessions.ts`): Session state interface.

**Layer** (`Layers/ProjectionThreadSessions.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| Get by threadId | ✅ |
| Delete by threadId | ✅ |

**Schema note:** `startedAt` is stored as a string (not ISO datetime), and `tokenUsage` is stored as JSON via `Schema.fromJsonString`. The `startedAt` field is optional and handled with spread syntax in the result mapping.

### 3.11 ProjectionThreadMessages

**Service** (`Services/ProjectionThreadMessages.ts`): Messages interface.

**Layer** (`Layers/ProjectionThreadMessages.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| List by thread | ✅ Ordered by `created_at ASC, message_id ASC` |
| Delete by thread | ✅ |

**Notable:** `attachments_json` uses `COALESCE(excluded.attachments_json, projection_thread_messages.attachments_json)` in the UPDATE clause — this **preserves existing attachments** when the upsert omits them. Explicit `[]` clears attachments. Covered by tests.

**Known issue:** `isStreaming` is stored as INTEGER (0/1) — handled with `row.isStreaming === 1` in mapping.

### 3.12 ProjectionThreadActivities

**Service** (`Services/ProjectionThreadActivities.ts`): Activity timeline interface.

**Layer** (`Layers/ProjectionThreadActivities.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| List by thread | ✅ Ordered by `sequence` (nulls last) then `created_at` then `activity_id` |
| Delete by thread | ✅ |

**Notable:** The ordering `CASE WHEN sequence IS NULL THEN 0 ELSE 1 END ASC` puts null sequences first, then orders by `sequence ASC, created_at ASC, activity_id ASC`. This seems inverted — typically nulls-last would use `1` for nulls. However, this orders rows without sequence numbers (legacy) first, then by ascending sequence. This is a design choice, not a bug.

### 3.13 ProjectionTurns

**Service** (`Services/ProjectionTurns.ts`): Complex turn lifecycle interface with pending starts, concrete turns, and checkpoint metadata.

**Layer** (`Layers/ProjectionTurns.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert by turnId | ✅ |
| Replace pending turn start | ✅ Transaction: clear existing + insert new |
| Get pending turn start | ✅ |
| Delete pending turn start | ✅ |
| List by thread | ✅ Ordered: checkpoint rows first (`checkpoint_turn_count IS NULL DESC`), then checkpoint count, then requested_at |
| Get by turnId | ✅ Excludes pending rows |
| Clear checkpoint conflict | ✅ |
| Delete by thread | ✅ Hard delete all rows |

**Schema note:** Uses the same `projection_turns` table for both turn lifecycle and checkpoint storage (see checkpoint issue above).

### 3.14 ProjectionThreadProposedPlans

**Service** (`Services/ProjectionThreadProposedPlans.ts`): Proposed plans interface.

**Layer** (`Layers/ProjectionThreadProposedPlans.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| List by thread | ✅ Ordered by `created_at ASC, plan_id ASC` |
| Delete by thread | ✅ |

### 3.15 ProjectionPendingApprovals

**Service** (`Services/ProjectionPendingApprovals.ts`): Approval requests interface.

**Layer** (`Layers/ProjectionPendingApprovals.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| List by thread | ✅ Ordered by `created_at ASC, request_id ASC` |
| Get by requestId | ✅ |
| Delete by requestId | ✅ |

### 3.16 MemoryEntries

**Service** (`Services/MemoryEntries.ts`): Deep memory with FTS5 full-text search.

**Layer** (`Layers/MemoryEntries.ts`): Full implementation with FTS5.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| Search (FTS5) | ✅ `memory_fts MATCH` with ranking |
| List by project | ✅ Ordered by `importance DESC, created_at DESC` |
| Delete by id | ✅ |
| Touch accessed | ✅ Updates `last_accessed_at` |

**Known issues:**
- `search` and `listByProject` use `as any` casts — TypeScript type safety is bypassed
- `search` uses `ORDER BY rank` which is an FTS5 rank function — correct for FTS5
- FTS5 triggers defined in migration 020 keep the index in sync

### 3.17 ProjectionContextNodes

**Service** (`Services/ProjectionContextNodes.ts`): Context node interface.

**Layer** (`Layers/ProjectionContextNodes.ts`): Full implementation.

| Feature | Status |
|---------|--------|
| Upsert | ✅ |
| Get by id | ✅ |
| List by project | ✅ |
| List by thread | ✅ |
| Delete by id | ✅ |

**Notable:** Does NOT use `SqlSchema` helpers — uses raw template literals throughout. This is inconsistent with the rest of the codebase but functionally correct.

### 3.18 HarnessPresets

**Migration-only** — created in migration 022 (`project_prompts` and `harness_presets` tables). There is **NO service interface, no service layer, and no repository** for `harness_presets`. This appears to be an incomplete feature that was partially implemented in the schema but has no application code.

---

## 4. Error Handling

**File:** `Errors.ts`

| Error Type | Purpose |
|------------|---------|
| `PersistenceSqlError` | Wraps SQL execution errors |
| `PersistenceDecodeError` | Wraps Schema decode errors |
| `ProviderSessionRepositoryValidationError` | Validation failures |
| `ProviderSessionRepositoryPersistenceError` | Persistence failures |
| `toPersistenceSqlError()` | Helper factory |
| `toPersistenceDecodeError()` | Helper factory with SchemaIssue formatting |
| `toPersistenceDecodeCauseError()` | Alternative decode error factory |
| `isPersistenceError()` | Type guard for both error types |

All error types are tagged error classes using `Schema.TaggedErrorClass`.

---

## 5. Sqlite Setup Layer

**File:** `Layers/Sqlite.ts`

Sets up the database connection with:
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
-- then runs migrations
```

Supports Bun and Node runtime detection, loading the appropriate SQLite client:
- **Bun**: `@effect/sql-sqlite-bun/SqliteClient`
- **Node**: `../NodeSqliteClient.ts` (the custom implementation)

---

## 6. Summary Table

| Component | Fully Implemented | Stubbed | Known Issues |
|-----------|------------------|---------|--------------|
| NodeSqliteClient | ✅ | `executeStream` | Single-writer semaphore model |
| Migrations | 22/23 | Migration 009 | No down migrations |
| OrchestrationEventStore | ✅ | — | Race condition on stream_version |
| OrchestrationCommandReceipts | ✅ | — | — |
| ProviderSessionRuntime | ✅ | — | No migration to add runtime_mode (009 is stub) |
| ProjectionState | ✅ | — | — |
| ProjectionCheckpoints | ⚠️ | — | Uses projection_turns table (shared with ProjectionTurns) |
| ProjectionGoals | ✅ | — | — |
| ProjectionFeatures | ✅ | — | — |
| ProjectionProjects | ✅ | — | Hard delete vs soft delete inconsistency |
| ProjectionThreads | ✅ | — | Hard delete vs soft delete inconsistency |
| ProjectionThreadSessions | ✅ | — | — |
| ProjectionThreadMessages | ✅ | — | — |
| ProjectionThreadActivities | ✅ | — | — |
| ProjectionTurns | ✅ | — | Shares table with checkpoints |
| ProjectionThreadProposedPlans | ✅ | — | — |
| ProjectionPendingApprovals | ✅ | — | — |
| MemoryEntries | ⚠️ | — | `as any` casts bypass type safety |
| ProjectionContextNodes | ✅ | — | No SqlSchema helpers used |
| HarnessPresets | ❌ | Entire feature | Schema only, no service/layer |
| Errors | ✅ | — | — |

---

## 7. Architectural Patterns

### Service/Layer Split
Every repository has a **Service** file (interface + schema types) and a **Layer** file (implementation). The Service defines the Shape interface and tagged `ServiceMap.Service` subclass. The Layer provides the Effect-based implementation.

### SqlSchema Usage
Most layers use `effect/unstable/sql/SqlSchema` with `SqlSchema.void`, `SqlSchema.findOne`, `SqlSchema.findOneOption`, and `SqlSchema.findAll`. These generate typed SQL executors.

### JSON Columns
Complex objects (payloads, metadata, scripts, attachments, token usage, checkpoint files) are stored as JSON strings. Decoding uses `Schema.fromJsonString` applied via `.mapFields(Struct.assign({...}))`.

### Upsert Pattern
All repositories use SQLite's `ON CONFLICT ... DO UPDATE` for upserts, keyed on the primary identifier column(s).

### Checkpoint/turn Coupling
`ProjectionCheckpoints` and `ProjectionTurns` both write to `projection_turns`, distinguished by `checkpoint_turn_count IS NULL` (turns) vs `NOT NULL` (checkpoints). This is a notable design quirk — a single table serves two distinct entity types.

### Legacy Sanitization
`OrchestrationEventStore` has runtime sanitization for legacy provider fields (`sanitizeLegacyProviderFields`) that normalizes unknown provider strings to `"codex"`. This is tested in `OrchestrationEventStore.test.ts`.

---

## 8. Notable Quirks

1. **Migration 009 is a no-op stub** — yields `SqlClient.SqlClient` without executing any SQL. It appears intended to modify `provider_session_runtime` but does nothing.

2. **Shared `projection_turns` table** — used by both `ProjectionTurnRepository` and `ProjectionCheckpointRepository`. This means checkpoint conflicts are managed by clearing other rows' checkpoint fields when a new checkpoint is written.

3. **`executeStream` not implemented** — the NodeSqliteClient's streaming method is a stub that throws.

4. **Hard delete vs soft delete** — `ProjectionProjects` and `ProjectionThreads` service descriptions say "soft-delete" but the layers use hard `DELETE` SQL statements.

5. **`harness_presets` has no service layer** — created in migration 022 but no application code uses it.

6. **FTS5 triggers use `sql.unsafe()`** — because the Effect SQL template tag doesn't support multi-statement SQL, migration 020 uses `sql.unsafe()` directly.

7. **MemoryEntries has `as any` casts** — `search` and `listByProject` functions in `MemoryEntries.ts` use `as any` and `as any[]` to bypass TypeScript checking, likely because the FTS5 result shape doesn't match the expected schema type.

8. **`ProjectionContextNodes` doesn't use `SqlSchema`** — all queries use raw template literals, inconsistent with the rest of the codebase.

9. **Attachment preservation pattern** — `ProjectionThreadMessages` uses `COALESCE(excluded.attachments_json, projection_thread_messages.attachments_json)` in upserts to preserve existing attachments when the update omits them. This is clever but non-obvious.
