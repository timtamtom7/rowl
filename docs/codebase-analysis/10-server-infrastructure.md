# Server Infrastructure Analysis

This document covers the Rowl server infrastructure: WebSocket server, networking, config, logging, main entry point, workspace metadata, attachment store, thread artifacts, sharing, and frontend WS transport.

---

## Table of Contents

1. [WebSocket Server (`wsServer.ts`)](#1-websocket-server-wsserverts)
2. [Push Bus (`wsServer/pushBus.ts`)](#2-push-bus-wsserverpushbusts)
3. [Server Readiness (`wsServer/readiness.ts`)](#3-server-readiness-wsserverreadinessts)
4. [Networking (`networking.ts`)](#4-networking-networkingts)
5. [Config (`config.ts`)](#5-config-configts)
6. [Logger (`logger.ts`, `serverLogger.ts`)](#6-logger-loggerts-serverloggerts)
7. [Main Entry Point (`main.ts`)](#7-main-entry-point-maints)
8. [Server Layers (`serverLayers.ts`)](#8-server-layers-serverlayersts)
9. [State JSON File (`stateJsonFile.ts`)](#9-state-json-file-statejsonfilets)
10. [Workspace Entries (`workspaceEntries.ts`)](#10-workspace-entries-workspaceentriests)
11. [Project Workspace Metadata (`projectWorkspaceMetadata.ts`)](#11-project-workspace-metadata-projectworkspacemetadatats)
12. [Attachment Paths (`attachmentPaths.ts`)](#12-attachment-paths-attachmentpathsts)
13. [Attachment Store (`attachmentStore.ts`)](#13-attachment-store-attachmentstorets)
14. [Image MIME (`imageMime.ts`)](#14-image-mime-imagemimets)
15. [Thread Artifacts (`threadArtifacts.ts`)](#15-thread-artifacts-threadartifactsts)
16. [Thread Share Store (`threadShareStore.ts`)](#16-thread-share-store-threadsharestorets)
17. [Thread Redo Store (`threadRedoStore.ts`)](#17-thread-redo-store-threadredostorets)
18. [Open Browser/Editor (`open.ts`)](#18-open-browsereditor-opentts)
19. [Keybindings (`keybindings.ts`)](#19-keybindings-keybindingsts)
20. [Path Authorization (`pathAuthorization.ts`)](#20-path-authorization-pathauthorizationts)
21. [OS Jank (`os-jank.ts`)](#21-os-jank-os-jankts)
22. [Telemetry / Analytics (`AnalyticsService.ts`, `Identify.ts`)](#22-telemetry--analytics-analyticsservicets-identifyts)
23. [Frontend WS Transport (`wsTransport.ts`)](#23-frontend-ws-transport-wstransportts)
24. [Frontend WS Native API (`wsNativeApi.ts`)](#24-frontend-ws-native-api-wsnativeapits)
25. [Native API (`nativeApi.ts`)](#25-native-api-nativeapits)
26. [Router (`router.ts`)](#26-router-routerts)
27. [Env (`env.ts`)](#27-env-envts)

---

## 1. WebSocket Server (`wsServer.ts`)

### What it does
Owns the HTTP/WebSocket server lifecycle, static asset serving, and WebSocket request routing for the Rowl server.

### How it works
- Creates an HTTP server using Node.js `http` module with WebSocket upgrade handling via the `ws` library
- Routes WebSocket requests through a `createServer` Effect that pulls in ~15+ service dependencies (GitManager, TerminalManager, Keybindings, ProviderService, OrchestrationEngine, etc.)
- Handles both RPC-style request/response messages and push notifications (channels)
- Static file serving for web assets from a configurable `staticDir`
- Path authorization checks to prevent workspace escapes via symlinks or path traversal
- Attachment route handling at `/_rowl/attachments/{id}` with MIME type detection
- File watching for keybindings config directory with hot-reload
- Graceful shutdown with finalizer flushing

### Connection to rest of system
- **Uses**: Logger, GitManager, TerminalManager, Keybindings, OrchestrationEngine, ProviderService, ContextService, AnalyticsService, Open service, attachment stores, path authorization
- **Exposes**: WS methods for projects, threads, context, memory, prompts, harness, features, goals, git, server config, copilot, orchestration commands
- **Push channels**: serverWelcome, serverConfigUpdated, terminalEvent, orchestration domain events

### Implementation status
**FULLY IMPLEMENTED** - Core WebSocket server with all major method handlers.

### Notable patterns/quirks
- Uses `Effect.fn` for async handlers that need to run Effects inside them
- Copilot reasoning probe has a 2.5s polling loop to wait for stable selector values
- Path resolution uses `resolvePathForContainmentCheck` to handle symlinks before containment validation
- WebSocket auth token passed via query param, redacted in logs via `redactWsAuthToken`
- Routes use `ServerLifecycleError` for startup issues and `RouteRequestError` for runtime request validation

---

## 2. Push Bus (`wsServer/pushBus.ts`)

### What it does
Provides an in-memory publish/subscribe bus for broadcasting push messages to all connected WebSocket clients.

### How it works
- Uses `Ref` for atomic sequence number tracking
- Uses `PubSub` for distributing `WsPushEnvelope` messages to subscribers
- Each push message has a monotonically increasing `sequence` number
- Supports channel-based subscription via `subscribe` method
- Provides `broadcast` to send messages to all subscribers
- `stream` method returns a `Stream` for reactive consumption of push messages
- `getSnapshot` returns current sequence and latest message per channel

### Connection to rest of system
- Used by `wsServer.ts` to push server config updates and welcome messages
- Orchestration events are broadcast via this bus
- Terminal events go through this bus

### Implementation status
**FULLY IMPLEMENTED** - Clean PubSub-based push notification system.

### Notable patterns/quirks
- Sequence numbers are per-bus-instance, not global across all clients
- `makeServerPushBus` is the factory function used to create bus instances
- Errors in subscriber callbacks are swallowed to prevent bus poisoning

---

## 3. Server Readiness (`wsServer/readiness.ts`)

### What it does
Tracks server startup readiness state, allowing dependent operations to wait until the server is fully initialized.

### How it works
- Uses `Deferred` to create a promise-like primitive that can be completed or failed exactly once
- `markReady()` completes the deferred, signaling all waiters that startup succeeded
- `markCrashed(cause)` fails the deferred, signaling startup failure
- `awaitReady()` returns an Effect that suspends until the deferred is resolved

### Connection to rest of system
- Created by `createServer` in `wsServer.ts`
- Server startup calls `markReady()` after all services are initialized
- Used to block WebSocket message handling until server is fully bootstrapped

### Implementation status
**FULLY IMPLEMENTED** - Simple but critical for startup synchronization.

### Notable patterns/quirks
- Readiness is a module-level exported function, not a class or service
- Server crash during startup is rare but handled via `markCrashed`

---

## 4. Networking (`networking.ts`)

### What it does
Provides networking utilities: WebSocket origin validation, loopback address detection, and URL resolution.

### How it works
- `isLoopbackRemoteAddress(ip)` - Checks if IP is loopback (127.0.0.0/8, ::1, etc.)
- `isAllowedWebSocketOrigin(origin, allowedOrigins)` - Validates WebSocket origin against allowlist
- `buildAllowedWebSocketOrigins(config)` - Constructs origin allowlist from server config
- Handles special case for file:// URLs in Electron
- URL resolution helper for WebSocket connection URLs

### Connection to rest of system
- Used in `wsServer.ts` during WebSocket upgrade validation
- Origin checking is security-critical to prevent cross-site WebSocket hijacking

### Implementation status
**FULLY IMPLEMENTED** - All origin validation and helper functions.

### Notable patterns/quirks
- Handles `null` origin values (some browsers/trusted environments)
- Desktop mode (`file://`) bypasses origin checks
- WSL loopback detection includes `WslIsInternalTcpPort` Windows API call when available

---

## 5. Config (`config.ts`)

### What it does
Defines and validates the server configuration schema using Effect's Config system.

### How it works
- Uses `Schema.TaggedClass` for `ServerConfig` with fields: `cwd`, `port`, `host`, `staticDir`, `devUrl`, `keybindingsConfigPath`, `authToken`, `logWebSocketEvents`, `autoBootstrapProjectFromCwd`, `stateDir`, `mode` (desktop/cli/web)
- `Config.string`, `Config.number`, `Config.boolean` for primitive fields
- `ServerConfig.layerLive` - Layer for production use with env var overrides
- `ServerConfig.layerTest` - Test layer with in-memory temp directories
- Environment variable names derived from field names (e.g., `ROWL_PORT`, `ROWL_STATE_DIR`)

### Connection to rest of system
- Injected into virtually every service via `ServerConfig` tag
- `stateDir` used by stateJsonFile, attachmentStore, thread stores, telemetry
- `keybindingsConfigPath` used by keybindings service
- `cwd` used as default workspace root

### Implementation status
**FULLY IMPLEMENTED** - Complete configuration system with validation.

### Notable patterns/quirks
- Defaults for stateDir: `~/.t3/userdata`
- `authToken` defaults to empty string (security: no auth)
- Desktop mode inferred from `process.env.ROWL_SERVER_MODE === "desktop"`
- Uses `@t3tools/contracts` for type definitions shared with frontend

---

## 6. Logger (`logger.ts`, `serverLogger.ts`)

### What it does
Provides structured logging for the server with metadata, timing, and level-based filtering.

### How it works
**logger.ts**:
- `createLogger` factory that takes a name and returns logging functions
- Uses Effect's `Logger` module
- Attaches `version`, `pid`, `hostname` to every log entry
- `withServerLogger` combines a base logger with server metadata
- `withRequestMetadata` adds context (method, path, requestId) to logs

**serverLogger.ts**:
- HTTP request logging middleware
- Logs: method, path, status code, response time, content-length
- Uses `X-Request-Id` header if provided, otherwise generates UUID
- Redacts `token` query params from logged paths

### Connection to rest of system
- `createLogger("rowl/server")` used as base logger in main.ts
- Request logger used in HTTP server request handlers

### Implementation status
**FULLY IMPLEMENTED** - Production-ready structured logging.

### Notable patterns/quirks
- Log entries include `version` from `package.json`
- Token redaction uses `redactWsAuthToken` from `@t3tools/shared`
- Response time calculated via `Date.now()` delta (simple, not hrtime)

---

## 7. Main Entry Point (`main.ts`)

### What it does
The server entry point that bootstraps the Effect runtime, assembles layers, and starts the HTTP/WS server.

### How it works
1. Calls `fixPath()` to fix macOS PATH issues
2. Creates Effect runtime with `runFork` for background fibers
3. Builds `BaseServerLive` layer with config, filesystem, path, logger
4. Assembles `ServerLive` layer with all services (Git, Terminal, Keybindings, Open, Analytics, Orchestration, Provider, etc.)
5. Starts HTTP server via `Server.start`
6. Registers shutdown handlers (SIGINT, SIGTERM)
7. On shutdown: flushes analytics, closes server gracefully

### Connection to rest of system
- Imports and wires together all major server components
- Sets up `AnalyticsServiceLayerLive` for telemetry
- Uses `OrchestrationEngine`, `TerminalManager`, `GitManager`, etc.

### Implementation status
**FULLY IMPLEMENTED** - Complete startup and shutdown lifecycle.

### Notable patterns/quirks
- Uses `Effect.never` as blocking main fiber after server start
- Analytics flush on finalizer ensures no events are lost
- Graceful shutdown waits for in-flight requests via `server.close()`
- Uses `Scope` for resource cleanup ordering

---

## 8. Server Layers (`serverLayers.ts`)

### What it does
Defines the Layer composition graph for the server - how all services are wired together in Effect's DI system.

### How it works
- `BaseServerLive` - Config, FileSystem, Path, Logger
- `GitLayer` - GitManager + GitCore
- `TerminalLayer` - TerminalManager
- `KeybindingsLayer` - Keybindings service
- `OpenLayer` - Browser/editor launch
- `AnalyticsLayer` - Telemetry
- `ProviderLayer` - ProviderService + ProviderHealth + OpenCodeState
- `OrchestrationLayer` - All orchestration services
- Composes all into `ServerLive`

### Connection to rest of system
- This is the dependency injection wiring
- All services declared in `ServerRuntimeServices` union type

### Implementation status
**FULLY IMPLEMENTED** - Complete Layer graph.

### Notable patterns/quirks
- Uses `Layer.provideMerge` and `Layer.mergeAll` for composition
- `ServerConfig` must be provided before most layers
- Each major subsystem has its own sub-layer for testability

---

## 9. State JSON File (`stateJsonFile.ts`)

### What it does
Generic utility for reading and writing JSON state files with schema validation using Effect.

### How it works
- `readStateJsonFile(schema, path, fallback)` - Reads JSON, validates via schema, returns fallback on missing file
- `writeStateJsonFile(schema, path, state)` - Validates state via schema, writes atomically (write-to-temp, then rename)
- Uses Effect's `Schema` for decode/encode
- File operations are blocking-friendly via `NodeFs` (not async Effect operations)

### Connection to rest of system
- Used by `threadShareStore`, `threadRedoStore`, and other persistent state stores
- Provides atomic write pattern to prevent corruption

### Implementation status
**FULLY IMPLEMENTED** - Clean abstraction over JSON file persistence.

### Notable patterns/quirks
- Atomic writes: temp file with PID + timestamp, then rename (atomic on POSIX)
- Graceful handling of missing files via fallback
- Schema validation ensures type safety on read

---

## 10. Workspace Entries (`workspaceEntries.ts`)

### What it does
Manages workspace file entries - scanning directories, searching, and handling large directory chunking.

### How it works
- `searchWorkspaceEntries(cwd, options)` - Recursively scans workspace for files matching patterns
- Supports glob patterns, max depth, ignored directories (node_modules, .git, etc.)
- Chunking for large directories: uses cursor-based pagination to avoid memory issues
- `readWorkspaceEntryChunk(path, cursor, limit)` - Returns partial results with next cursor
- Caching via `Cache` to avoid repeated scans
- File type detection (file vs directory vs symlink)
- UTF-8 BOM stripping for text files

### Connection to rest of system
- Used by `projects.searchEntries` WebSocket method
- Frontend uses this for file tree, search, source file listing

### Implementation status
**FULLY IMPLEMENTED** - Full search and chunking implementation.

### Notable patterns/quirks
- Symlinks are resolved via `realpathSync` to avoid duplicate entries
- Binary files detected via null byte presence
- Chunking limit is 500 entries per chunk
- Results cached for 5 seconds via `Cache.withExpires`

---

## 11. Project Workspace Metadata (`projectWorkspaceMetadata.ts`)

### What it does
Reads and manages project-level metadata: agents config, command templates, skills, source files.

### How it works
- `readProjectAgentsFile(cwd)` - Reads `AGENTS.md` or `agents.json`
- `draftProjectAgentsFile(cwd, content)` - Writes agent configuration
- `listProjectCommandTemplates(cwd)` - Scans for command template files
- `listProjectSkills(cwd)` - Finds skill definition files
- `scanSourceFiles(cwd, options)` - Scans workspace for source code files
- Schema validation for agent definitions using Effect

### Connection to rest of system
- Used by `projects.readAgentsFile`, `projects.draftAgentsFile`, `projects.listCommandTemplates`, `projects.listSkills` WS methods
- Integrates with workspaceEntries for file scanning

### Implementation status
**FULLY IMPLEMENTED** - All metadata reading/writing.

### Notable patterns/quirks
- Supports both Markdown (AGENTS.md) and JSON (agents.json) formats
- Command templates identified by `.t3.md` extension
- Skills stored in `.t3/skills/` directory

---

## 12. Attachment Paths (`attachmentPaths.ts`)

### What it does
Resolves and validates attachment file paths within the server's state directory.

### How it works
- `resolveAttachmentRelativePath(relativePath)` - Validates and normalizes attachment relative paths
- `normalizeAttachmentRelativePath(raw)` - Removes `..`, `.`, slashes, etc.
- `resolveAttachmentPath(stateDir, relativePath)` - Joins stateDir with validated relative path
- `ATTACHMENTS_ROUTE_PREFIX` = `/_rowl/attachments/`
- Attachment ID format: `{projectId}/{attachmentId}` for namespacing

### Connection to rest of system
- Used by HTTP route handler in `wsServer.ts` for serving attachments
- Attachment IDs generated by `attachmentStore`

### Implementation status
**FULLY IMPLEMENTED** - Path validation prevents directory traversal.

### Notable patterns/quirks
- Project-namespaced attachment IDs prevent collisions
- Strict validation: only alphanumeric, dash, underscore allowed in path components

---

## 13. Attachment Store (`attachmentStore.ts`)

### What it does
Stores and retrieves binary attachments (images, files) in the server's state directory.

### How it works
- `createAttachmentId(projectId, ...parts)` - Generates attachment ID
- `resolveAttachmentPath(stateDir, attachmentId)` - Maps ID to filesystem path
- `resolveAttachmentPathById(stateDir, attachmentId)` - Looks up attachment by ID
- `listAttachments(stateDir, projectId)` - Lists all attachments for a project
- `deleteAttachment(stateDir, attachmentId)` - Removes attachment
- Uses atomic writes (temp file + rename)

### Connection to rest of system
- WS methods: `projects.writeFile` for workspace files
- Thread attachments stored via this system
- HTTP attachment routes served from this store

### Implementation status
**FULLY IMPLEMENTED** - Full CRUD for attachments.

### Notable patterns/quirks
- No actual file content stored in this module - just path resolution
- Attachment content stored in `attachments/{projectId}/{attachmentId}/` tree
- Cleanup of orphaned attachments not implemented (known gap)

---

## 14. Image MIME (`imageMime.ts`)

### What it does
Detects image MIME types from file content or data URLs.

### How it works
- `parseBase64DataUrl(dataUrl)` - Parses `data:image/png;base64,...` format
- Maps MIME type to file extension
- `detectImageMimeType(buffer)` - Detects from magic bytes (PNG, JPEG, GIF, WebP, AVIF)
- Uses file extension lookup

### Connection to rest of system
- Used when storing images to determine correct file extension
- HTTP routes use this for Content-Type headers

### Implementation status
**FULLY IMPLEMENTED** - All common web image formats supported.

### Notable patterns/quirks
- Magic byte signatures: PNG (89 50 4E 47), JPEG (FF D8 FF), GIF (47 49 46), WebP (52 49 46 46), AVIF (ftypavif)

---

## 15. Thread Artifacts (`threadArtifacts.ts`)

### What it does
Manages thread state snapshots, continuations, and restore operations.

### How it works
- `buildThreadRestoreState(threadState)` - Creates serializable restore state for a thread
- `buildThreadContinuationSummary(threadState)` - Creates summary for continuation
- `buildThreadContinuationSummaryFromState(snapshot)` - Rebuilds from snapshot
- `buildThreadShareSnapshot(state)` - Creates shareable snapshot (excludes ephemeral data)
- `parseLatestResumeContext(input)` - Parses resume context from various formats
- Activity tracking: `THREAD_RESUME_CONTEXT_ACTIVITY_KIND`, `THREAD_IMPORT_ACTIVITY_KIND`

### Connection to rest of system
- Used by thread WS methods: `threads.undo`, `threads.redo`, `threads.compact`
- Thread sharing uses share snapshot builder
- Orchestration engine uses restore/continuation for state recovery

### Implementation status
**FULLY IMPLEMENTED** - Complete thread state management.

### Notable patterns/quirks
- Restore state excludes: ephemeral turns, undo history, transient provider options
- Continuation summary is a "best effort" reconstruction for resuming threads
- Activity kinds track how threads were created/resumed for telemetry

---

## 16. Thread Share Store (`threadShareStore.ts`)

### What it does
Manages sharing of threads via signed, time-limited URLs.

### How it works
- `createThreadShare(stateDir, share)` - Creates share with `shareId`, `threadId`, `createdAt`, `expiresAt`
- `getThreadShare(stateDir, shareId)` - Retrieves share (returns null if expired/not found)
- `getActiveThreadShare(stateDir, threadId)` - Gets most recent active share for a thread
- `revokeThreadShare(stateDir, shareId)` - Deletes a share
- Shares stored at `thread-share/{shareId}.json`
- Uses `Schema.TaggedClass` for `ThreadShare` type

### Connection to rest of system
- WS methods: `threads.createShare`, `threads.getShare`, `threads.revokeShare`, `threads.getShareStatus`
- Share URLs include HMAC signature for tamper-proofing (signature = `HMAC-SHA256(shareId, token)`)

### Implementation status
**FULLY IMPLEMENTED** - Complete share lifecycle.

### Notable patterns/quirks
- Expired shares are not auto-deleted (cleanup is manual/optional)
- HMAC signing uses server's auth token as secret key
- `THREAD_SHARE_TOKEN_BYTES = 32` for cryptographic strength

---

## 17. Thread Redo Store (`threadRedoStore.ts`)

### What it does
Manages thread undo/redo history as a stack of snapshots.

### How it works
- `pushThreadRedoSnapshot(stateDir, threadId, snapshot)` - Pushes new snapshot, caps stack at `MAX_REDO_STACK_DEPTH = 20`
- `popThreadRedoSnapshot(stateDir, threadId)` - Pops and returns most recent snapshot
- `getThreadRedoStatus(stateDir, threadId)` - Returns count of available redo snapshots
- `clearThreadRedoSnapshots(stateDir, threadId)` - Deletes all redo snapshots for a thread
- Redo files stored at `thread-redo/{threadId}.json`

### Connection to rest of system
- WS methods: `threads.redo`, `threads.getRedoStatus`
- `threads.undo` pushes to redo stack before applying undo
- Thread compact clears redo history

### Implementation status
**FULLY IMPLEMENTED** - Stack-based undo/redo with bounded depth.

### Notable patterns/quirks
- MAX_REDO_STACK_DEPTH is 20 - hardcoded, not configurable
- No compression of snapshots (could be large for long threads)
- Redo stack is cleared on new user actions (standard undo behavior)

---

## 18. Open Browser/Editor (`open.ts`)

### What it does
Service for opening URLs in browser and workspace paths in configured editors.

### How it works
- `OpenError` - Tagged error class for open failures
- `resolveAvailableEditors(platform)` - Detects installed editors on the system
- `isCommandAvailable(command, options)` - Checks if a command is on PATH
- `resolveEditorLaunch(input, platform)` - Builds command line for launching editor
- `launchDetached(launch)` - Spawns detached child process
- Uses `open` npm package for browser URL launching
- Supports editors: cursor, vscode, vscode-insiders, zed, antigravity, file-manager

### Connection to rest of system
- WS method: `shell.openInEditor` uses this service
- File manager fallback: `open` (macOS), `explorer` (Windows), `xdg-open` (Linux)

### Implementation status
**FULLY IMPLEMENTED** - Full browser/editor launch with cross-platform support.

### Notable patterns/quirks
- Detached processes: `child.unref()` so server can exit independently
- Windows: handles `PATHEXT` for .COM, .EXE, .BAT, .CMD extensions
- `--goto` flag support for line/column navigation in Cursor, VSCode, Zed
- `isCommandAvailable` searches PATH for executables

---

## 19. Keybindings (`keybindings.ts`)

### What it does
Manages user keybinding configuration with parsing, validation, merge, and persistence.

### How it works
- `KeybindingsConfigError` - Tagged error with configPath, detail, cause
- `parseKeybindingShortcut(value)` - Parses "mod+shift+d" into `{key, metaKey, ctrlKey, shiftKey, altKey, modKey}`
- `parseKeybindingWhenExpression(expression)` - Parses "terminalFocus && !terminalOpen" into AST
- `compileResolvedKeybindingRule(rule)` - Validates and compiles a rule
- `compileResolvedKeybindingsConfig(config)` - Compiles full config
- `DEFAULT_KEYBINDINGS` - 12 default bindings (sidebar, terminal, chat, commandPalette)
- `mergeWithDefaultKeybindings(custom)` - Merges user config with defaults
- `upsertKeybindingRule(rule)` - Adds/updates rule, persists atomically
- File watching with hot-reload via `fs.watch`
- Uses `Semaphore` for concurrent write serialization

### Connection to rest of system
- WS methods: `server.upsertKeybinding`
- Broadcasts config changes via `streamChanges` PubSub
- Push channel: `serverConfigUpdated` with keybindings issues

### Implementation status
**FULLY IMPLEMENTED** - Complete keybindings management with defaults, merge, validation.

### Notable patterns/quirks
- MAX_KEYBINDINGS_COUNT = 100 (from @t3tools/contracts)
- MAX_WHEN_EXPRESSION_DEPTH = 10 (from @t3tools/contracts)
- Malformed config: runtime uses defaults, file left unchanged
- Invalid entries: logged and skipped, others still applied
- Conflict detection: warns if user shortcut matches default shortcut context
- Atomic writes: PID+timestamp temp file, then rename

---

## 20. Path Authorization (`pathAuthorization.ts`)

### What it does
Validates that file paths stay within allowed roots, handling symlinks and path traversal.

### How it works
- `isWithinAllowedRoot(requestedPath, rootPath)` - Checks if path is inside root
- `resolvePathForContainmentCheck(args)` - Resolves symlinks to find real path before containment check
- Handles non-existent paths by walking up to nearest existing ancestor

### Connection to rest of system
- Used by `wsServer.ts` to validate workspace file paths before reads/writes
- Prevents path traversal attacks via `../` or symlinks pointing outside workspace

### Implementation status
**FULLY IMPLEMENTED** - Security-critical path validation.

### Notable patterns/quirks
- Converts Windows backslashes to forward slashes before comparison
- Uses `Path.relative()` to compute relative path, then validates it doesn't escape
- `resolvePathForContainmentCheck` handles the "symlink to outside" attack vector

---

## 21. OS Jank (`os-jank.ts`)

### What it does
Miscellaneous OS-specific workarounds and path utilities.

### How it works
- `fixPath()` - On macOS, reads PATH from login shell (zsh) to fix PATH issues in GUI apps
- `expandHomePath(input)` - Expands `~` to `$HOME`
- `resolveStateDir(raw)` - Resolves state directory, defaults to `~/.t3/userdata`

### Connection to rest of system
- `fixPath()` called in `main.ts` before server startup
- `resolveStateDir()` used by config to resolve `ROWL_STATE_DIR`

### Implementation status
**FULLY IMPLEMENTED** - macOS PATH workaround + path utilities.

### Notable patterns/quirks
- `fixPath()` only runs on macOS, silently ignores failures
- Uses `@t3tools/shared/shell` for shell PATH reading
- State dir resolution supports `~` in config value

---

## 22. Telemetry / Analytics (`AnalyticsService.ts`, `Identify.ts`)

### What it does
Anonymous telemetry via PostHog with buffered batch sending and user identification.

### How it works
**AnalyticsService.ts**:
- `AnalyticsServiceLayerLive` - Effect Layer for analytics
- Buffers events in `Ref<ReadonlyArray<BufferedAnalyticsEvent>>`
- Flushes every 1 second via `Effect.forever` fiber
- Batch sending to PostHog `/batch/` endpoint
- Config: `ROWL_POSTHOG_KEY`, `ROWL_POSTHOG_HOST`, `ROWL_TELEMETRY_ENABLED`, `ROWL_TELEMETRY_FLUSH_BATCH_SIZE`, `ROWL_TELEMETRY_MAX_BUFFERED_EVENTS`
- Fallback key: `phc_XOWci4oZP4VvLiEyrFqkFjP4CZn55mjYYBMREK5Wd6m`
- Client type: "desktop-app" or "cli-web-client"

**Identify.ts**:
- `getTelemetryIdentifier()` - Gets hashed user identifier
- Tries: 1) `~/.codex/auth.json` `tokens.account_id`, 2) `~/.t3/telemetry/anonymous-id`
- Hashes with SHA-256 for privacy
- Falls back to `null` if neither found

### Connection to rest of system
- `AnalyticsService.record(event, properties)` called throughout codebase
- Telemetry ID persisted to `stateDir/anonymous-id`

### Implementation status
**FULLY IMPLEMENTED** - Production telemetry with buffering and fallback identification.

### Notable patterns/quirks
- Automatic flush on finalizer (shutdown)
- On flush failure: events re-buffered (no data loss)
- Buffer overflow: drops oldest events, logs warning
- Disabled by `ROWL_TELEMETRY_ENABLED=false`

---

## 23. Frontend WS Transport (`wsTransport.ts`)

### What it does
Client-side WebSocket transport with request/response RPC, push subscriptions, and automatic reconnection.

### How it works
- `WsTransport` class manages a single WebSocket connection
- `request<T>(method, params, options)` - Sends RPC request, returns Promise with optional result schema validation
- `subscribe<C>(channel, listener, options)` - Subscribes to push channel, returns unsubscribe fn
- `getLatestPush<C>(channel)` - Gets last received push for a channel
- `subscribeState(listener)` - Subscribes to connection state changes
- `dispose()` - Closes connection and cleans up
- Reconnection with exponential backoff: 500ms, 1s, 2s, 4s, 8s (max)
- State machine: `connecting` → `open` ↔ `reconnecting` → `closed` | `disposed`
- Auth token: extracted from URL query params, removed from `location`

### Connection to rest of system
- Used by `createWsNativeApi()` to communicate with server
- Supports desktop bridge URL updates via `window.desktopBridge.onBackendWsUrlUpdated`
- Push channels: `serverWelcome`, `serverConfigUpdated`, `terminalEvent`, `orchestration.domainEvent`

### Implementation status
**FULLY IMPLEMENTED** - Production client transport with reconnection and schema validation.

### Notable patterns/quirks
- Request timeout: 60 seconds (REQUEST_TIMEOUT_MS)
- Pending requests flushed when socket opens
- In-flight requests rejected on disconnect (before response received)
- Auth token redaction in console logs: `redactWsAuthToken`
- Desktop bridge integration: waits for URL before connecting

---

## 24. Frontend WS Native API (`wsNativeApi.ts`)

### What it does
Thin wrapper around `WsTransport` that exposes typed API methods for all server WebSocket methods.

### How it works
- `createWsNativeApi()` - Singleton factory, returns `NativeApi` object
- Subscribes to push channels and fans out to listeners
- `onServerWelcome(listener)` - Subscribe to welcome payload with replay for late subscribers
- `onServerConfigUpdated(listener)` - Subscribe to config updates with replay
- `subscribeServerConnectionState(listener)` - Connection state change notifications
- `getServerConnectionState()` - Current state getter

**API namespaces** (all via `transport.request`):
- `dialogs` - pickFolder, confirm
- `terminal` - open, write, resize, clear, restart, close, onEvent
- `projects` - searchEntries, readAgentsFile, draftAgentsFile, listCommandTemplates, listSkills, listSourceFiles, readFile, writeFile, deleteFile
- `threads` - getShareStatus, createShare, getShare, revokeShare, importShare, compact, undo, redo, getRedoStatus
- `context` - createNode, getNode, listByProject, listByThread, compressNode, restoreNode, deleteNode, getBudget
- `memory` - create, search, listByProject, delete
- And more: review, codebaseHealth, prompts, harness, featureThreadLinks, agents, features, goals, git, contextMenu, server, orchestration

### Connection to rest of system
- Imports type definitions from `@t3tools/contracts`
- `NativeApi` type is the public API surface for the frontend

### Implementation status
**FULLY IMPLEMENTED** - Complete typed API for all server methods.

### Notable patterns/quirks
- Singleton: `createWsNativeApi()` returns cached instance
- Welcome replay: late subscribers immediately receive last welcome payload
- `orchestration.replayEvents` converts iterable to array (server sends async generator)
- Desktop bridge fallback: `dialogs.pickFolder` uses native file picker if available

---

## 25. Native API (`nativeApi.ts`)

### What it does
Provides access to the typed `NativeApi` from frontend code.

### How it works
- `readNativeApi()` - Returns `NativeApi | undefined` (undefined in SSR/node context)
- `ensureNativeApi()` - Returns `NativeApi` or throws if not available
- Caching: `cachedApi` module-level singleton

### Connection to rest of system
- Used throughout frontend to access server capabilities
- `window.nativeApi` (from Electron preload) takes precedence over WebSocket fallback

### Implementation status
**FULLY IMPLEMENTED** - Simple cache wrapper.

### Notable patterns/quirks
- SSR guard: `typeof window === "undefined"` returns undefined
- Priority: Electron preload (`window.nativeApi`) > WebSocket transport fallback

---

## 26. Router (`router.ts`)

### What it does
React Router setup with TanStack Router for the frontend application.

### How it works
- `getRouter(history)` - Creates router with `QueryClient`, `StoreProvider`, `routeTree`
- Uses `@tanstack/react-router` for routing
- `routeTree.gen` is the generated route tree from file structure
- `AppRouter` type for registration

### Connection to rest of system
- Provides routing context for React components
- StoreProvider wraps app with state management

### Implementation status
**FULLY IMPLEMENTED** - Standard TanStack Router setup.

### Notable patterns/quirks
- Type-only module declaration extends TanStack Router types
- No custom routing logic - just framework setup

---

## 27. Env (`env.ts`)

### What it does
Detects if running inside Electron via preload bridge.

### How it works
- `isElectron` - True if `window.desktopBridge` or `window.nativeApi` is defined
- Uses preload script's `contextBridge` to expose native APIs

### Connection to rest of system
- Used by other frontend modules to detect Electron vs browser environment
- Affects: WebSocket transport (desktop bridge URL), native dialogs, context menus

### Implementation status
**FULLY IMPLEMENTED** - Simple environment detection.

### Notable patterns/quirks
- Relies on Electron preload script setting `window.nativeApi` before app code runs

---

## Summary: Implementation Status

| Area | Status | Notes |
|------|--------|-------|
| WebSocket Server | ✅ Full | Complete with all method handlers |
| Push Bus | ✅ Full | PubSub-based, clean design |
| Readiness | ✅ Full | Deferred-based, simple |
| Networking | ✅ Full | Origin validation, loopback detection |
| Config | ✅ Full | Schema-validated, env-driven |
| Logger | ✅ Full | Structured logging with request tracking |
| Main Entry | ✅ Full | Proper startup/shutdown lifecycle |
| Server Layers | ✅ Full | Complete DI graph |
| State JSON File | ✅ Full | Atomic writes, schema validation |
| Workspace Entries | ✅ Full | Search, chunking, caching |
| Project Metadata | ✅ Full | Agents, templates, skills |
| Attachment Paths | ✅ Full | Validation, traversal prevention |
| Attachment Store | ✅ Full | Path resolution only |
| Image MIME | ✅ Full | Magic bytes + extension |
| Thread Artifacts | ✅ Full | Snapshot/restore/continuation |
| Thread Share Store | ✅ Full | HMAC-signed share URLs |
| Thread Redo Store | ✅ Full | Bounded stack (20) |
| Open Browser/Editor | ✅ Full | Cross-platform, detached |
| Keybindings | ✅ Full | Parse, validate, merge, watch |
| Path Authorization | ✅ Full | Symlink-aware traversal prevention |
| OS Jank | ✅ Full | macOS PATH fix |
| Telemetry | ✅ Full | PostHog with buffering |
| WS Transport (FE) | ✅ Full | Reconnection, schema validation |
| WS Native API (FE) | ✅ Full | Complete typed API |
| Native API (FE) | ✅ Full | Cache wrapper |
| Router (FE) | ✅ Full | TanStack Router setup |
| Env (FE) | ✅ Full | Electron detection |

---

## Known Issues / Stubbed Areas

1. **Attachment cleanup**: `attachmentStore.ts` has no orphaned attachment cleanup
2. **Thread share expiration**: Expired shares not auto-deleted
3. **Thread redo compression**: Snapshots stored uncompressed (could be large)
4. **WS reconnect sequence numbers**: Push bus sequence numbers reset on reconnect (per-instance, not global)
5. **Provider MCP statuses**: `listCodexMcpServerStatuses` imported but implementation not reviewed

---

## Notable Cross-Cutting Patterns

1. **Effect Runtime**: Heavy use of Effect's `Layer`, `Scope`, `Ref`, `Deferred`, `PubSub`, `Cache`
2. **Schema Validation**: Effect `Schema` for all data validation (configs, state, messages)
3. **Atomic Writes**: Temp file + rename pattern in stateJsonFile, keybindings, thread stores
4. **Singleton Services**: `createWsNativeApi()`, `readNativeApi()` are cached singletons
5. **Push-Based Updates**: PubSub for keybindings changes, push bus for server config
6. **Symlink Handling**: `resolvePathForContainmentCheck` used before any path containment validation
