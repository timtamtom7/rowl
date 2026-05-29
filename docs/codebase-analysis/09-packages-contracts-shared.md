# Packages Analysis: `contracts` and `shared`

## Table of Contents

- [packages/contracts](#packagescontracts)
  - [Overview](#contracts-overview)
  - [Key Schemas and Relationships](#contracts-key-schemas)
  - [Usage by Apps](#contracts-usage-by-apps)
  - [Implementation Status](#contracts-implementation-status)
  - [Patterns and Quirks](#contracts-patterns)
- [packages/shared](#packagesshared)
  - [Overview](#shared-overview)
  - [Key Modules and Relationships](#shared-key-modules)
  - [Usage by Apps](#shared-usage-by-apps)
  - [Implementation Status](#shared-implementation-status)
  - [Patterns and Quirks](#shared-patterns)

---

# packages/contracts

## Overview

The `contracts` package is the **central schema and type contract library** for the Rowl monorepo. It defines:

- All WebSocket RPC method names and their request/response schemas
- The WebSocket protocol (push channels, request/response envelopes)
- All domain schemas (project, git, terminal, orchestration, provider runtime, etc.)
- Base branded types (ProjectId, ThreadId, TurnId, etc.)

It is the **single source of truth** for the wire protocol between clients (apps/web) and server (apps/server). Every schema is defined using the `effect` library's `Schema` for runtime validation.

## Key Schemas and Relationships

### Base Types (`baseSchemas.ts`)

All branded primitive types used throughout the codebase:

| Type                                                                   | Description                             |
| ---------------------------------------------------------------------- | --------------------------------------- |
| `ProjectId`                                                            | Branded string for project identifiers  |
| `ThreadId`                                                             | Branded string for thread identifiers   |
| `TurnId`                                                               | Branded string for turn identifiers     |
| `NonNegativeInt`                                                       | Integer >= 0                            |
| `PositiveInt`                                                          | Integer > 0                             |
| `TrimmedNonEmptyString`                                                | Non-empty string, trimmed of whitespace |
| `IsoDateTime`                                                          | ISO 8601 datetime string                |
| `EventId`                                                              | Branded string for event identifiers    |
| `ProviderItemId`, `RuntimeItemId`, `RuntimeRequestId`, `RuntimeTaskId` | Various runtime IDs                     |
| `ThreadShareId`                                                        | Branded string for shared thread IDs    |
| `ProjectSkillName`                                                     | Literal union of known skill names      |

### WebSocket Protocol (`ws.ts`)

**WS_METHODS** — 50+ RPC method constants organized by domain:

- `projects.*` — Project registry and file operations (11 methods)
- `threads.*` — Thread sharing, undo/redo, compact (8 methods)
- `review.*` — Approve/reject review operations
- `shell.*` — Shell editor integration
- `git.*` — Git operations including worktrees, stacked PRs (10 methods)
- `terminal.*` — PTY terminal management (6 methods)
- `server.*` — Server config, keybindings, credentials
- `features.*`, `goals.*` — Feature flag and goal tracking
- `context.*`, `memory.*` — Context management and vector store
- `codebase.*` — Codebase health intelligence
- `prompts.*`, `harness.*` — Prompt templates and test harnesses
- `agent.*` — Multi-agent coordination

**WS_CHANNELS** — Push event channels:

- `server.welcome` — Initial server greeting
- `server.configUpdated` — Server config changed
- `terminal.event` — Terminal output/exit events
- `file.activity` — File read/write/create/delete events

**ORCHESTRATION_WS_CHANNELS** — Additional orchestration channels:

- `domainEvent` — Orchestration domain events

**Core Schemas:**

- `WebSocketRequest` — `{ id: string, body: WebSocketRequestBody }` where body is a tagged union
- `WebSocketResponse` — `{ id: string, result?: unknown, error?: { message: string } }`
- `WsPush` — Union of all push envelope types with `type: "push"`, `sequence`, `channel`, `data`
- `WsRpcResultSchemaByMethod` — Maps every RPC method to its result schema (used for server-side response validation)

### Orchestration (`orchestration.ts`)

The **largest and most complex file** (~1500 lines). Defines the event-sourcing state management system.

**Key Concepts:**

- **Threads** contain **Turns** (user inputs)
- **Turns** contain **Items** (messages, reasoning, tool calls)
- **Sessions** represent a provider's active connection to a thread

**Command/Query Separation:**

- `ClientOrchestrationCommand` — Commands sent from client (startSession, stopSession, sendTurn, interruptTurn, approveRequest, respondToUserInput, resumeSession)
- `ServerOrchestrationQuery` — Read-only queries (getSnapshot, getTurnDiff, getFullThreadDiff, replayEvents)

**Session State Machine:**

- Session states: `starting`, `ready`, `running`, `waiting`, `stopped`, `error`
- Thread states: `active`, `idle`, `archived`, `closed`, `compacted`, `error`
- Turn states: `completed`, `failed`, `interrupted`, `cancelled`

**Event Types (40+ events):**

- Session: `session.started`, `session.configured`, `session.state.changed`, `session.exited`
- Thread: `thread.started`, `thread.state.changed`, `thread.metadata.updated`, `thread.token-usage.updated`
- Turn: `turn.started`, `turn.completed`, `turn.aborted`, `turn.plan.updated`, `turn.diff.updated`
- Item: `item.started`, `item.updated`, `item.completed`
- Content: `content.delta` (streaming text deltas)
- Request: `request.opened`, `request.resolved` (approvals)
- User Input: `user-input.requested`, `user-input.resolved`
- Task: `task.started`, `task.progress`, `task.completed`
- Hook: `hook.started`, `hook.progress`, `hook.completed`
- Tool: `tool.progress`, `tool.summary`
- Auth: `auth.status`, `account.updated`, `account.rate-limits.updated`
- MCP: `mcp.status.updated`, `mcp.oauth.completed`
- Misc: `model.rerouted`, `config.warning`, `deprecation.notice`, `files.persisted`, `runtime.warning`, `runtime.error`

**Key Constants:**

```typescript
ORCHESTRATION_WS_METHODS = {
  dispatchCommand: "orchestration.dispatchCommand",
  getSnapshot: "orchestration.getSnapshot",
  getTurnDiff: "orchestration.getTurnDiff",
  getFullThreadDiff: "orchestration.getFullThreadDiff",
  replayEvents: "orchestration.replayEvents",
};
ORCHESTRATION_WS_CHANNELS = {
  domainEvent: "orchestration.domainEvent",
  terminalPty: "orchestration.terminalPty",
};
```

### Provider (`provider.ts`)

Provider session management:

- `ProviderSession` — Active session state with status, model, threadId
- `ProviderSessionStartInput` — Start session with provider, model, cwd, approval policy
- `ProviderSendTurnInput` — Send user input with optional attachments (max 10 attachments, max 125000 chars)
- `ProviderTurnStartResult` — `{ threadId, turnId, resumeCursor }`
- `ProviderEvent` — Unified event from provider with kind (session/notification/request/error)

**Provider Kinds:** `codex`, `copilot`, `kimi`, `kilocode`, `minimax`, `opencode`, `pi`

### Provider Runtime (`providerRuntime.ts`)

**46 typed event schemas** for the runtime event stream (V2). The main union is `ProviderRuntimeEvent` (aliased from `ProviderRuntimeEventV2`).

**Event structure:**

- All events share `ProviderRuntimeEventBase`: `{ eventId, provider, threadId, createdAt, turnId?, itemId?, requestId?, providerRefs?, raw? }`
- Each event type has a specific `type` literal and `payload` schema

**Payload types include:**

- `SessionStartedPayload`, `SessionConfiguredPayload`, `SessionStateChangedPayload`, `SessionExitedPayload`
- `ThreadStartedPayload`, `ThreadStateChangedPayload`, `ThreadMetadataUpdatedPayload`, `ThreadTokenUsageUpdatedPayload`
- `TurnStartedPayload`, `TurnCompletedPayload`, `TurnAbortedPayload`, `TurnPlanUpdatedPayload`, `TurnProposedDeltaPayload`, `TurnDiffUpdatedPayload`
- `ItemLifecyclePayload` — used for `item.started`, `item.updated`, `item.completed`
- `ContentDeltaPayload` — streaming text with `streamKind` (assistant_text, reasoning_text, plan_text, etc.)
- `RequestOpenedPayload`, `RequestResolvedPayload` — approval requests
- `UserInputRequestedPayload`, `UserInputResolvedPayload` — interactive questions
- `TaskStartedPayload`, `TaskProgressPayload`, `TaskCompletedPayload`
- `HookStartedPayload`, `HookProgressPayload`, `HookCompletedPayload`
- `ToolProgressPayload`, `ToolSummaryPayload`
- `AuthStatusPayload`, `AccountUpdatedPayload`, `AccountRateLimitsUpdatedPayload`
- `McpStatusUpdatedPayload`, `McpOauthCompletedPayload`
- `ModelReroutedPayload`, `ConfigWarningPayload`, `DeprecationNoticePayload`
- `FilesPersistedPayload`, `RuntimeWarningPayload`, `RuntimeErrorPayload`

**Compatibility aliases** exist for legacy event names (e.g., `ProviderRuntimeMessageDeltaEvent` → `ProviderRuntimeContentDeltaEvent`).

### Terminal (`terminal.ts`)

PTY terminal emulation:

- `TerminalOpenInput` — Open terminal with cwd, cols (20-400), rows (5-200), command, args, env
- `TerminalWriteInput` — Write data to terminal (max 65,536 bytes)
- `TerminalResizeInput` — Resize terminal
- `TerminalRestartInput` — Restart with new settings
- `TerminalCloseInput` — Close with optional deleteHistory
- `TerminalSessionSnapshot` — Full terminal state: `{ threadId, terminalId, cwd, status, pid, history, exitCode, exitSignal, updatedAt }`
- `TerminalEvent` — Union of: `started`, `output`, `exited`, `error`, `cleared`, `restarted`, `activity`

### Git (`git.ts`)

Git operations including worktrees and stacked PRs:

- `GitStatusInput/Result` — `git status --porcelain`
- `GitPullInput/Result` — `git pull` with conflict handling
- `GitListBranchesInput/Result` — List local/remote branches
- `GitCreateBranchInput` — Create new branch
- `GitCheckoutInput` — Checkout branch/commit
- `GitInitInput` — Initialize repo
- `GitCreateWorktreeInput` — Create worktree (newBranch optional for existing branches)
- `GitRemoveWorktreeInput` — Remove worktree
- `GitRunStackedActionInput/Result` — Stacked PR workflow
- `GitPreparePullRequestThreadInput/Result` — Prepare PR thread
- `GitResolvePullRequestResult` — Resolved PR metadata with number, title, url, baseBranch, headBranch, state

### Project (`project.ts`)

Project file operations:

- `ProjectSearchEntriesInput/Result` — Search files (max 200 entries)
- `ProjectReadFileInput/Result` — Read file with exists flag
- `ProjectWriteFileInput/Result` — Write file
- `ProjectDeleteFileInput/Result` — Delete file
- `ProjectAgentsFileInput/Result` — Read agents.yaml (status: available/missing)
- `ProjectDraftAgentsFileInput/Result` — Draft/update agents.yaml
- `ProjectCommandTemplate` — Template with name, relativePath, description, template, provider?, model?, interactionMode?, runtimeMode?, sendImmediately?
- `ProjectListCommandTemplatesInput/Result` — List with issues
- `ProjectSkill` — Skill with name (from ProjectSkillName literal), relativePath, description
- `ProjectListSourceFilesInput/Result` — List source files with content, sizeBytes

### Features (`features.ts`)

Feature flag system with stages:

- `Feature` — `{ id, projectId, name, description, stage, createdAt, updatedAt }`
- `FeatureStage` — Literal: `off`, `alpha`, `beta`, `gamma`, `stable`, `generalAvailability`
- CRUD operations: create, get, listByProject, update, updateStage, delete
- Feature-thread linking via `featureThreadLink`, `featureThreadUnlink`, `featureThreadGetLinks`

### Goals (`goals.ts`)

Goal tracking system:

- `Goal` — `{ id, projectId, text, isMain, createdAt, updatedAt }`
- CRUD: create, get, listByProject, updateText, setMain, delete
- Thread linking: linkThread, unlinkThread

### Context (`context.ts`)

Context node management for conversation context:

- `ContextNode` — Tree node with parentId, content, summary, tokens, children
- `ContextBudget` — Budget tracking
- CRUD: createNode, getNode, listByProject, listByThread, compressNode, restoreNode, deleteNode, getBudget

### Memory (`memory.ts`)

Vector store memory:

- `MemoryEntry` — Memory with id, projectId, content, embedding, createdAt
- Operations: create, search (similarity search), listByProject, delete

### Keybindings (`keybindings.ts`)

Keyboard shortcut management:

- `KeybindingRule` — `{ key, modifiers?, action, description? }`
- `ResolvedKeybindingsConfig` — Resolved platform-specific bindings

### Editor (`editor.ts`)

Editor integration:

- `OpenInEditorInput` — Open file in editor

### IPC (`ipc.ts`)

Inter-process communication schemas (status unclear — file content not fully reviewed)

### Thread Features (`threadFeatures.ts`)

Thread sharing and history management:

- `ThreadShareSummary` — Share with id, threadId, title, createdAt, updatedAt, revokedAt
- `ThreadShareSnapshot` — Full thread export with version 2, state, sourceProjectId
- Operations: getShareStatus, createShare, getShare, revokeShare, importShare
- `ThreadCompactInput/Result` — Compact thread with summary
- `ThreadUndoInput/Result` — Undo with revertedToTurnCount and redoDepth
- `ThreadRedoInput/Result`, `ThreadRedoStatusInput/Result` — Redo stack management

### Server (`server.ts`)

Server configuration and provider status:

- `ServerConfig` — Full server config: cwd, keybindings, issues, providers, mcpServers, availableEditors
- `ServerProviderStatus` — Per-provider status: `{ provider, status: ready/warning/error, available, authStatus, checkedAt, message?, availableModels? }`
- `ServerOpenCodeState` — Union of available/unavailable with credentials, models, mcpServers, configSources
- `ServerCopilotUsage` — Usage tracking: remaining, percentRemaining, overagePermitted, resetAt
- `ServerCopilotReasoningProbe` — Probe supported reasoning options
- `ServerUpsertKeybindingInput/Result` — Keybinding management
- `ServerOpenCodeCredentialInput/Result` — Credential management (api/oauth)
- `ServerMiniMaxState`, `ServerKiloCodeState` — Other provider states

### Codebase Health (`codebaseHealth.ts`)

Codebase intelligence:

- `FileHealthEntry` — Per-file: lineCount, connectionCount, changeFrequency, healthScore, issues
- `CodebaseHealthSummary` — Aggregate: totalFiles, averageHealth, criticalFiles, warningFiles, healthyFiles
- `GetCodebaseHealthInput/Result` — Get summary
- `UpdateCodebaseHealthInput/Result` — Update file health data

### Multi-Agent (`multiAgent.ts`)

Multi-agent coordination:

- `GetAgentOverviewInput/Result` — Agent status
- `SpawnAgentForFeatureInput/Result` — Spawn agent for feature
- `DetectConflictsInput/Result` — Detect conflicts

### Project Prompts (`projectPrompts.ts`)

Prompt template management:

- `PromptScope` — `global | project | thread`
- `ProjectPrompt` — Template with id, projectId?, threadId?, scope, name, content, enabled, priority
- `HarnessPreset` — Test harness preset
- Operations: list, create, update, delete prompts; list/activate/deactivate harnesses

## Usage by Apps

### apps/server

The server is the **consumer** of `contracts`:

- Imports all schemas for WebSocket request validation
- Uses `WsRpcResultSchemaByMethod` to validate responses
- Implements the orchestration state machine using `orchestration.ts` schemas
- Uses `providerRuntime.ts` event schemas for runtime event dispatch
- Uses `terminal.ts` for PTY session management
- Uses `git.ts` for git operations
- Uses `project.ts` for file operations

### apps/web

The web client is also a **consumer** of `contracts`:

- Uses schemas for WebSocket request encoding
- Validates server push events using schemas
- Uses `model.ts` from `contracts` for model/provider constants (re-exported in shared)

## Implementation Status

| Domain                  | Status               | Notes                             |
| ----------------------- | -------------------- | --------------------------------- |
| WebSocket protocol      | ✅ Fully implemented | All methods mapped to schemas     |
| Orchestration           | ✅ Fully implemented | Large but complete event sourcing |
| Provider runtime events | ✅ Fully implemented | 46 event types                    |
| Terminal                | ✅ Fully implemented | Full PTY lifecycle                |
| Git                     | ✅ Fully implemented | Worktrees, stacked PRs            |
| Project files           | ✅ Fully implemented | Search, read, write, delete       |
| Features/Goals          | ✅ Fully implemented | Full CRUD + threading             |
| Context/Memory          | ✅ Fully implemented | Vector store integration          |
| Keybindings             | ✅ Fully implemented | Rule + resolved config            |
| Provider session        | ✅ Fully implemented | Multi-provider support            |
| Server config           | ✅ Fully implemented | Credentials, MCP, usage           |
| Codebase health         | ✅ Fully implemented | Health scoring                    |
| Multi-agent             | ✅ Fully implemented | Conflict detection                |
| Prompts/Harnesses       | ✅ Fully implemented | Template system                   |
| IPC                     | ⚠️ Unclear           | Not fully reviewed                |
| Editor                  | ✅ Minimal           | Just openInEditor                 |

## Patterns and Quirks

1. **Tag union pattern**: Every WebSocket request body is wrapped with `tagRequestBody()` which adds `_tag` field using `Schema.tag()` for discriminated unions.

2. **Branding for type safety**: Base schemas use `Schema.Brand` to create distinct nominal types (ProjectId, ThreadId, etc.) that prevent mixing IDs.

3. **Effect library throughout**: All schemas use `effect`'s `Schema` module with `Schema.Struct`, `Schema.Literal`, `Schema.optional`, `Schema.Array`, etc.

4. **Large union types**: `WebSocketRequestBody` is a 50+ member union — TypeScript handles this but compilation can be slow.

5. **Orchestration is the core**: The `orchestration.ts` file is the heart of the system, defining the event-sourcing model for threads, turns, and sessions.

6. **Provider-agnostic**: The provider runtime schemas abstract over codex, copilot, kimi, kilocode, minimax, opencode, and pi.

7. **Schema-to-method mapping**: `WsRpcResultSchemaByMethod` is a const object mapping every method to its result schema — essential for server-side response validation.

8. **Trimmed strings**: `TrimmedNonEmptyString` is used everywhere to ensure no accidental whitespace in identifiers.

9. **Constants files**: Method names and channel names are exported as const objects (e.g., `WS_METHODS`, `WS_CHANNELS`, `ORCHESTRATION_WS_METHODS`) rather than enums.

10. **Test naming**: Tests use `@effect/vitest` with `it.effect()` for Effect-based tests, and regular vitest for schema decode tests.

---

# packages/shared

## Overview

The `shared` package contains **pure utility functions and Effect-based services** that are used by both `apps/server` and `apps/web`. Unlike `contracts` which focuses on schemas and wire protocol, `shared` provides:

- Worker queue utilities
- Networking helpers (port reservation)
- Model catalog helpers
- Desktop backend integration helpers
- Logging (rotating file sink)
- Shell utilities
- WebSocket auth token management
- Version/prerelease detection
- Copilot plan formatting
- Git branch name sanitization

## Key Modules and Relationships

### DrainableWorker (`DrainableWorker.ts`)

A queue-based worker pattern for Effect:

```typescript
interface DrainableWorker<A> {
  enqueue: (item: A) => Effect<void>;
  drain: Effect<void>; // Resolves when queue empty AND current item done
}
```

**Purpose**: Replaces timing-sensitive `Effect.sleep` calls in tests with deterministic `drain()`. Uses `Queue.unbounded` + `Effect.forever` with atomic outstanding counter tracking.

**Key implementation detail**: Uses `Deferred` for idle signaling. When outstanding hits 0, the idle Deferred is resolved. `drain()` awaits that Deferred.

### Net (`Net.ts`)

Effect-based networking service (`NetService`):

```typescript
interface NetServiceShape {
  canListenOnHost: (port: number, host: string) => Effect<boolean>;
  isPortAvailableOnLoopback: (port: number) => Effect<boolean>;
  reserveLoopbackPort: (host?: string) => Effect<number, NetError>;
  findAvailablePort: (preferred: number) => Effect<number, NetError>;
}
```

**Key behaviors:**

- `canListenOnHost` treats `EADDRNOTAVAIL` as "available" (IPv6-absent hosts)
- `reserveLoopbackPort` binds port 0 to get an ephemeral port, then closes
- `findAvailablePort` tries preferred first, falls back to ephemeral

**Error handling**: Custom `NetError` tagged error with message and optional cause.

### Model (`model.ts`)

Model catalog utilities (re-exports from contracts):

**Functions:**

- `getModelOptions(provider)` — Get catalog of model options
- `getModelDisplayName(model, provider)` — Human-readable name
- `getModelContextWindowInfo(model, provider)` — Token limits
- `getDefaultModel(provider)` — Default model slug
- `normalizeModelSlug(model, provider)` — Resolve aliases
- `isBuiltInModel(model, provider)` — Check if in catalog
- `isLegacyModelSlug(model, provider)` — Check if retired
- `isKnownModelSlug(model, provider, options?)` — Check with optional legacy
- `isCodexOpenRouterModel(model)` — Check if OpenRouter route
- `resolveModelSlug(model, provider)` — Normalize or default
- `getReasoningEffortOptions(provider)` — Reasoning levels
- `getDefaultReasoningEffort(provider)` — Default reasoning level

**Re-exports from contracts:** `REASONING_EFFORT_OPTIONS_BY_PROVIDER`

### DesktopBackend (`desktopBackend.ts`)

Desktop app integration helpers:

```typescript
DESKTOP_BACKEND_READY_PREFIX = "[rowl-desktop-ready]";
formatDesktopBackendReadyLine({ port }); // → "[rowl-desktop-ready]{"port":43121}"
parseDesktopBackendReadyLine(line); // → { port } | null
createDesktopBackendWsUrl({ port, authToken }); // → "ws://127.0.0.1:{port}/?token={encoded}"
```

**Purpose**: Communication between main process and desktop backend via stdout line parsing.

### WsAuth (`wsAuth.ts`)

WebSocket authentication token management:

```typescript
WS_AUTH_TOKEN_QUERY_PARAM = "***"; // sentinel value for redaction
getWsAuthToken(value); // → string | null
withWsAuthToken(url, token); // → string (adds token if not present)
withoutWsAuthToken(url); // → string (removes token)
redactWsAuthToken(value); // → string | null (removes from any format)
```

**Purpose**: Secure token handling. Tokens are never logged (redacted).

### Shell (`shell.ts`)

Login shell PATH extraction:

```typescript
readPathFromLoginShell(shell); // → string | undefined
extractPathFromShellOutput(output); // → string | null
```

**Purpose**: Get the full PATH from a login shell (bash -ilc, fish -l, etc.) using marker-based extraction.

### Logging (`logging.ts`)

Rotating file log sink:

```typescript
class RotatingFileSink {
  constructor({ filePath, maxBytes, maxFiles, throwOnError? })
  write(chunk: string | Buffer): void
}
```

**Behavior:**

- Rotates when `currentSize + chunk > maxBytes`
- Rotation: renames files with numeric suffixes (1, 2, ..., maxFiles)
- Prunes overflow backups on startup
- Errors are silent by default unless `throwOnError`

### Git (`git.ts`)

Git branch name utilities:

```typescript
sanitizeBranchFragment(raw) // → lowercase, max 64 chars, no quotes
sanitizeFeatureBranchName(raw) // → "feature/..." branch
resolveAutoFeatureBranchName(existingBranches, preferred?) // → unique "feature/..." name
```

**Purpose**: Safe branch name generation for automated workflows.

### AppRelease (`appRelease.ts`)

Version and release utilities:

```typescript
getVersionPrereleaseTag(version); // → "alpha" | "fork" | null
isPrereleaseVersion(version); // → boolean
isForkPrereleaseVersion(version); // → boolean
resolveAppReleaseBranding({ version, isDevelopment }); // → AppReleaseBranding
```

**Purpose**: Determine release stage and branding. All builds resolve to "Rowl" with appId `com.t3tools.rowl`.

### CopilotPlan (`copilotPlan.ts`)

GitHub Copilot plan label formatting:

```typescript
formatGitHubCopilotPlan(plan); // → "Copilot Pro" | "Copilot Enterprise" | etc.
```

**Purpose**: Normalize GitHub's internal plan identifiers (e.g., `individual_pro` → `Copilot Pro`).

### SchemaJson (`schemaJson.ts`)

Effect Schema JSON utilities:

```typescript
decodeJsonResult(schema)(input); // → Result<Decoded, Cause<SchemaError>>
decodeUnknownJsonResult(schema)(input); // → Result<Decoded, Cause<SchemaError>>
formatSchemaError(cause); // → string (formatted error message)
```

**Purpose**: Decode JSON strings using Effect schemas, with proper error formatting.

## Usage by Apps

### apps/server

- `NetService` — Port reservation for server startup
- `RotatingFileSink` — Server log rotation
- `readPathFromLoginShell` — Shell initialization
- `model.ts` — Model resolution and validation
- `git.ts` — Branch name generation
- `DrainableWorker` — Background task queues
- `schemaJson.ts` — JSON schema validation

### apps/web

- `wsAuth.ts` — WebSocket token management
- `desktopBackend.ts` — Desktop integration
- `getModelDisplayName` — UI display names
- `appRelease.ts` — Version display
- `copilotPlan.ts` — Plan name formatting

## Implementation Status

| Module          | Status               | Notes                             |
| --------------- | -------------------- | --------------------------------- |
| DrainableWorker | ✅ Fully implemented | Well-tested with live effect test |
| NetService      | ✅ Fully implemented | Full port reservation service     |
| Model helpers   | ✅ Fully implemented | Comprehensive test coverage       |
| WsAuth          | ✅ Fully implemented | Token CRUD with redaction         |
| Shell           | ✅ Fully implemented | Login shell PATH extraction       |
| Logging         | ✅ Fully implemented | Rotating file sink                |
| Git             | ✅ Fully implemented | Branch sanitization               |
| AppRelease      | ✅ Fully implemented | Version detection                 |
| CopilotPlan     | ✅ Fully implemented | Plan label formatting             |
| SchemaJson      | ✅ Fully implemented | JSON decoding helpers             |
| DesktopBackend  | ✅ Fully implemented | Ready line parsing                |

## Patterns and Quirks

1. **Effect Service pattern**: `NetService` uses `ServiceMap.Service` and `Layer.sync` — the standard Effect dependency injection pattern.

2. **Tagged errors**: `NetError` uses `Data.TaggedError` for typed errors.

3. **Re-exports from contracts**: `model.ts` re-exports many constants from `@t3tools/contracts`, acting as a convenience layer.

4. **ReadonlySet for lookups**: Model catalogs use `ReadonlySet<ModelSlug>` for O(1) membership checks.

5. **Shell injection safety**: `readPathFromLoginShell` uses marker-based extraction to avoid shell injection.

6. **Token redaction everywhere**: `wsAuth.ts` handles multiple formats (absolute URL, relative URL, raw string) with consistent redaction.

7. **Branching logic in NetService**: `findAvailablePort` uses `Effect.catch` to fall back from preferred to ephemeral.

8. **DrainableWorker for tests**: The `drain()` effect is specifically designed to replace `Effect.sleep` in tests with deterministic waiting.

9. **No filesystem in model.ts**: Despite being about "models", the shared model.ts is purely about string normalization and display — no file operations.

10. **Default branding is static**: `resolveAppReleaseBranding` always returns "Rowl" regardless of input (all builds unified under same branding).

---

## Cross-Cutting Concerns

### Effect Library Usage

Both packages heavily use the `effect` library:

- `Schema` for all type definitions and runtime validation
- `Effect` for functional programming patterns
- `Deferred` for synchronization primitives
- `Ref` for mutable state in concurrent contexts
- `Queue` for work queues
- `Layer` for dependency injection
- `Data.TaggedError` for typed errors

### Contracts ↔ Shared Boundary

- `contracts` owns all **data shapes** (schemas)
- `shared` owns **behavior** (utilities, services)
- `shared/model.ts` re-exports from `contracts` for convenience
- No circular dependencies between the two packages

### Test Patterns

- Schema tests use `Schema.decodeUnknownSync` for synchronous validation
- Effect-based tests use `@effect/vitest` with `it.effect()` and `Effect.gen`
- `describe`/`it` blocks follow standard vitest conventions
- Live tests marked with `it.live()` for integration tests
