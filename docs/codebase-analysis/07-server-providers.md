# Server Provider Integrations Analysis

## Overview

The Rowl server has 7 AI provider adapters: Codex, GitHub Copilot, KiloCode, Kimi Code, MiniMax, OpenCode, and Pi. Each follows a standardized adapter pattern that wraps a provider-specific manager. The adapters are composed using the Effect library's `Layer` system.

---

## Architecture

### Two Layers of Abstraction

1. **ProviderAdapter Layer** (`provider/Layers/*.ts`): Thin Effect Layer wrappers that translate Rowl commands into provider-specific calls and handle error normalization. Each adapter creates its manager instance (or uses a provided `makeManager` option).

2. **Manager Classes** (`*.ts` in server root): Concrete implementations that handle provider communication (CLI processes, API calls, SDKs).

### Shared Infrastructure

- **`acpAdapterSupport.ts`**: Contains `createAcpEventStream()` helper that bridges EventEmitter-based managers to Effect `Stream`. Also provides `toAcpRequestError()` and `toAdapterMessage()` for error normalization.
- **`acpRuntimeShared.ts`**: Shared utilities for ACP-based managers: `extractTextFromContentBlock()`, `mapPlanEntryStatus()`, `mapToolCallStatus()`, `mapToolKindToItemType()`, `mapToolKindToRequestType()`, `summarizeToolContent()`, `permissionDecisionFromOutcome()`, `killChildTree()`, etc.

---

## Provider Adapters

### 1. Codex

**What it does**: Connects to the official OpenAI Codex CLI (`codex app-server`) which runs as a subprocess with JSON-RPC over stdio.

**Connection to orchestration engine**: The adapter wraps `CodexAppServerManager` and exposes it as an Effect service via `Layer.effect`.

**Rowl command translation**:
- `startSession` → spawns `codex app-server` subprocess with `--cwd` and `--model` args
- `sendTurn` → sends JSON-RPC `agent/sendTurn` request over stdio
- `interruptTurn` → sends JSON-RPC `agent/interruptTurn` request
- `respondToRequest` → sends `requestPermission/request` with approval decision
- `stopSession` → kills the subprocess
- `streamEvents` → uses `createAcpEventStream()` to bridge manager's EventEmitter to Effect Stream

**Capability**: `sessionModelSwitch: "restart-session"` (must restart to switch models)

**Implementation status**: Fully implemented. Manager (`codexAppServerManager.ts`, ~2096 lines) handles:
- Process lifecycle with timeout-protected initialization
- Session resumption via `--resume` flag
- Permission request/response flow
- Tool call events, content deltas, plan updates
- `lastError` propagation on session

**Known issues/quirks**: None significant. Well-established provider.

---

### 2. GitHub Copilot

**What it does**: Connects to GitHub Copilot's ACP-backed runtime via `copilot acp` CLI subprocess with ACP protocol over stdio.

**Connection to orchestration engine**: Adapter wraps `CopilotAcpManager`, extends `AcpBaseManager` which extends `EventEmitter`. Uses `createAcpEventStream()` for event bridging.

**Rowl command translation**:
- `startSession` → spawns `copilot acp --cwd <dir>` subprocess, waits for `initialized` notification
- `sendTurn` → sends ACP `session.sendTurn` request
- `interruptTurn` → sends ACP `session.interruptTurn` request
- `respondToRequest` → sends ACP `requestPermission/request` response
- `stopSession` → sends `session.stop`, kills process
- `streamEvents` → bridged from manager's EventEmitter

**Capability**: `sessionModelSwitch: "in-session"` (supports model switching within session via ACP)

**Implementation status**: Fully implemented. Manager (`copilotAcpManager.ts`, ~983 lines) handles:
- ACP protocol over stdio with JSON-RPC
- Connection timeout (10s for initialize, 10s for session start)
- Permission request queuing and resolution
- Session reconnection/resume support
- stderr capture for error diagnostics

**Known issues/quirks**: None significant. Auth check in health (`checkCopilotProviderStatus`) probes `copilot auth status` — warns if not authenticated.

---

### 3. KiloCode

**What it does**: Connects to KiloCode CLI (`kilo acp`) which uses ACP protocol over stdio, similar to Copilot.

**Connection to orchestration engine**: Adapter wraps `KiloCodeAcpManager`, extends `AcpBaseManager` (EventEmitter pattern).

**Rowl command translation**:
- `startSession` → spawns `kilo acp --cwd <dir>` subprocess, waits for `initialized` + `sessionStarted`
- `sendTurn` → sends ACP `session.sendTurn` request
- `interruptTurn` → sends ACP `session.interruptTurn` request
- `respondToRequest` → sends ACP permission response
- `stopSession` → sends `session.stop`, kills process
- `streamEvents` → bridged via `createAcpEventStream()`

**Capability**: `sessionModelSwitch: "in-session"` (model switchable within session)

**Error normalization**: `normalizeKiloCodeStartErrorMessage()` provides user-friendly messages for:
- Auth required → "Complete the Kilo Gateway OAuth flow"
- API key invalid → "Re-authenticate through Kilo Gateway OAuth flow"
- CLI not found → "KiloCode CLI (`kilo`) is not installed or not on PATH"
- Timeout → "KiloCode took too long to start"
- Rate limit → "KiloCode rate limit reached"

**Implementation status**: Fully implemented. Manager (`kilocodeAcpManager.ts`, ~914 lines) handles:
- ACP protocol over stdio
- Session initialization timeout (10s)
- Session start timeout (10s)
- Permission request handling
- Tool snapshots for tracking call state

**Known issues/quirks**: The health check only verifies CLI presence via `--version` — does not check Kilo Gateway OAuth auth status (always returns "warning"/"unknown" auth status).

---

### 4. Kimi Code

**What it does**: Connects to Kimi Code CLI (`kimi acp`) which uses ACP protocol over stdio, with optional API key authentication.

**Connection to orchestration engine**: Adapter wraps `KimiAcpManager`, extends `AcpBaseManager`.

**Rowl command translation**:
- `startSession` → spawns `kimi acp` with optional `--config-file`, optional `--model`, and `--yolo` flag for `full-access` runtime mode
- `sendTurn` → sends ACP `session.sendTurn`
- `interruptTurn` → sends ACP `session.interruptTurn`
- `respondToRequest` → sends ACP permission response
- `stopSession` → sends `session.stop`, kills process
- `streamEvents` → bridged via `createAcpEventStream()`

**Capability**: `sessionModelSwitch: "in-session"`

**Authentication options** (unique among ACP providers):
1. API key via `KIMI_API_KEY` env var + `KIMI_BASE_URL` + config file (`buildKimiApiKeyConfig()`)
2. Interactive login via `kimi login --json` probe check

**Error normalization**: `normalizeKimiStartErrorMessage()` handles:
- Auth required → "Run `kimi login`, or start `kimi` and run `/login`, or add a Kimi API key"
- Probes login state via `spawnSync` with 2s timeout

**Implementation status**: Fully implemented. Manager (`kimiAcpManager.ts`, ~1030 lines) handles:
- ACP protocol over stdio
- Temporary config directory for API key (auto-cleaned on exit)
- Login state probe before start
- Session + thread started events
- Permission request handling with `toolSnapshots`

**Known issues/quirks**: Creates temporary config directory (`mkdtempSync`) for API key config with `chmod 0o700` — best-effort only (catch block silently ignores errors). Config file cleaned up via `rmSync` on exit.

---

### 5. MiniMax

**What it does**: Direct API integration with MiniMax's OpenAI-compatible endpoint (`/chat/completions`) using the MiniMax-M2.7 model. The only provider that uses REST/HTTP instead of CLI subprocess.

**Connection to orchestration engine**: Adapter wraps `MiniMaxApiManager` (extends `EventEmitter`). No subprocess — uses native `fetch` for streaming.

**Rowl command translation**:
- `startSession` → validates API key, sets session to "ready" (no CLI to start)
- `sendTurn` → calls `streamChatCompletion()` with conversation history, emits turn events
- `interruptTurn` → sets `abortController.abort()`, which kills the fetch stream
- `respondToRequest` → N/A (no permission requests in API mode)
- `stopSession` → marks session as closed
- `streamEvents` → bridged via `createAcpEventStream()`

**Capability**: `sessionModelSwitch: "restart-session"` (must start new session to change model)

**Context management**: Notable surgical context trimming:
- Keeps last 10 messages intact
- For older messages with content >4000 chars: trims to `[Trimmed: <preview>... (<X> tokens freed)]`
- Strips `tool_call_id` from user messages

**API details**:
- Base URL: `https://api.minimaxi.chat/v1`
- Default model: `MiniMax-M2.7`
- Streaming: `stream: true` in request body
- Multipart messages: supports image attachments via `{ type: "image_url", image_url: { url: <attachment.url> } }`

**Error normalization**: `normalizeMiniMaxApiError()` maps HTTP status codes:
- 401 → "API key is invalid or expired"
- 403 → "API access denied"
- 429 → "Rate limit reached"
- 402 → "Payment required"
- 500/502/503 → "API temporarily unavailable"

**Implementation status**: Fully implemented. Manager (`minimaxApiManager.ts`, ~637 lines) handles:
- Conversation history management
- Abortable fetch streams
- Content delta events (assistant_text stream)
- Turn completion with `end_turn` stop reason
- Interrupted turns (aborted) clean up conversation history

**Known issues/quirks**: No support for permission requests or tool calls in the adapter itself — this is a pure text/completion API. The `sessionModelSwitch` being "restart-session" rather than "in-session" is a limitation of the API design.

---

### 6. OpenCode

**What it does**: Connects to OpenCode CLI (`opencode acp`) which uses ACP protocol over stdio, routing to OpenRouter for model access.

**Connection to orchestration engine**: Adapter wraps `OpenCodeAcpManager`, extends `AcpBaseManager`.

**Rowl command translation**:
- `startSession` → spawns `opencode acp --cwd <dir>` with optional `OPENROUTER_API_KEY` env
- `sendTurn` → sends ACP `session.sendTurn`
- `interruptTurn` → sends ACP `session.interruptTurn`
- `respondToRequest` → sends ACP permission response
- `stopSession` → sends `session.stop`, kills process
- `streamEvents` → bridged via `createAcpEventStream()`

**Capability**: `sessionModelSwitch: "in-session"`

**Model normalization**: `normalizeRequestedOpenCodeModel()` handles `provider/modelId` format with normalization:
- `zai/foo` → `z-ai/foo` (OpenRouter provider ID normalization)

**Runtime config**: `buildOpenCodeRuntimeConfig()` sets permission to "ask" for non-full-access mode:
```typescript
{ permission: { edit: "ask", bash: "ask" } }
```
Merges with existing `OPENCODE_CONFIG_CONTENT` env var.

**Error normalization**: `normalizeOpenCodeStartErrorMessage()` handles:
- Missing `OPENROUTER_API_KEY` → specific message about adding it
- Auth required → "Run `opencode auth login`"
- CLI not found → "OpenCode CLI (`opencode`) is not installed or not on PATH"
- Timeout → "OpenCode took too long to start"

**Health check**: Uses `opencode auth list` to enumerate stored credentials (authenticated providers).

**Implementation status**: Fully implemented. Manager (`opencodeAcpManager.ts`, ~1018 lines) handles:
- ACP protocol over stdio
- Config merging for runtime permissions
- Session initialization timeout (10s)
- Session start timeout (10s)
- Permission request handling with `toolSnapshots`

**Known issues/quirks**: None significant. Well-integrated with OpenRouter's provider model.

---

### 7. Pi

**What it does**: Embeds the `@mariozechner/pi-coding-agent` Node SDK directly in Rowl. Manages sessions through Pi's `createAgentSession()` API. Rowl intentionally disables Pi's own resource discovery (packages, extensions, skills, themes, prompts) so Rowl remains the sole source of workspace instructions.

**Connection to orchestration engine**: Adapter wraps `PiSdkManager` (extends `EventEmitter`). No subprocess — uses Pi SDK directly.

**Rowl command translation**:
- `startSession` → calls `createAgentSession()` with `cwd`, `tools`, optional `model`, auth storage, settings
- `sendTurn` → calls `session.prompt()` with text + attachments
- `interruptTurn` → calls `session.abort()`
- `respondToRequest` → resolves pending approval via `approvalCacheKey`
- `stopSession` → ends session, clears context
- `streamEvents` → bridged via `createAcpEventStream()`

**Capability**: `sessionModelSwitch: "restart-session"` (must restart session to switch models)

**Model support**: Pi uses a model registry (`ModelRegistry`) with available models from `~/.pi/agent/models.json`. Models are identified by `provider/modelId` slugs (e.g., `anthropic/claude-sonnet-4-20250514`).

**Thinking levels**: Supports `thinkingLevel` on session: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`. Exposed in `session.configured` event via `availableThinkingLevels`.

**Tool set**: `PI_FULL_TOOL_NAMES = ["read", "bash", "edit", "write", "grep", "find", "ls"]` for normal mode, `PI_PLAN_TOOL_NAMES = ["read", "bash", "grep", "find", "ls"]` for plan mode (no file mutations).

**Plan mode**: Wraps prompts with `<collaboration_mode name="plan">` XML tag via `PI_PLAN_MODE_PROMPT_PREFIX`. Extracts `<proposed_plan>...</proposed_plan>` markdown from responses.

**Approval caching**: `approvalAllowCache` Set caches approved decisions by `cacheKey` to avoid re-prompting for repeated operations.

**Harness utilities** (`piHarness.ts`): Contains shared logic:
- `buildPiModelSlug()` / `parsePiModelSlug()` — model ID formatting
- `createLockedPiSettingsManager()` — merges global + project settings but locks packages/extensions/skills/prompts/themes
- `createLockedPiResourceLoader()` — disables Pi resource discovery
- `mapPiToolNameToItemType()` / `mapPiToolNameToRequestType()` — tool mapping
- `extractAssistantTextFromPiSessionEvent()` — extracts text from Pi session events
- `extractProposedPlanMarkdown()` — extracts plan markup

**Setup message**: `PI_PROVIDER_SETUP_MESSAGE` documents that Rowl embeds Pi through Pi Node SDK, reuses `~/.pi/agent/auth.json`, and intentionally disables Pi packages/extensions/prompts/skills/themes/AGENTS.

**Implementation status**: Fully implemented. Manager (`piSdkManager.ts`, ~1372 lines) handles:
- Session lifecycle with `AgentSession`, `SessionManager`, `SettingsManager`, `ModelRegistry`, `AuthStorage`
- Deferred turn tracking (`PiPendingTurn` with `Deferred<void>`)
- Tool call approvals with cache
- Usage aggregation (input/output/cacheRead/cacheWrite/totalTokens/totalCost)
- Thinking level management
- Session configured payload with available models and thinking levels

**Known issues/quirks**: 
- Session restart required for model switch (`sessionModelSwitch: "restart-session"`)
- `stopAll()` in manager is stubbed — just resolves pending approvals, doesn't kill all sessions
- Health check reads catalog snapshot but doesn't attempt actual auth verification

---

## Shared Patterns

### Event Emission

All managers extend `EventEmitter<KiloXxxManagerEvents>` where `events = { event: [ProviderRuntimeEvent] }`. Events are bridged to Effect `Stream` via `createAcpEventStream()` in the adapter layer.

### Session Context Pattern

Each manager maintains:
- `sessions: Map<ThreadId, SessionContext>` — active sessions
- `startingSessions: Map<ThreadId, SessionContext>` — sessions being initialized
- Per-context: `session`, `currentTurnId`, `turnInFlight`, `stopping`, plus provider-specific fields

### Error Handling

Adapters use `toAcpRequestError()` to normalize errors:
- Maps "unknown session" messages → `ProviderAdapterSessionNotFoundError`
- Maps "session is closed" messages → `ProviderAdapterSessionClosedError`
- Others → `ProviderAdapterRequestError`

### ACP Protocol Events

ACP-based managers emit these event types:
- `session.started` — session initialization complete
- `thread.started` — thread context established
- `session.configured` — model config available
- `turn.started` — turn began
- `content.delta` — streaming text (`streamKind`: `assistant_text` | `reasoning_text`)
- `item.started` — tool call began
- `item.updated` — tool call progress
- `item.completed` — tool call finished
- `turn.plan.updated` — plan entries changed
- `thread.token-usage.updated` — usage update
- `request.opened` — permission request opened
- `request.resolved` — permission request answered
- `session.exited` — session terminated
- `runtime.error` — error during turn

### Health Checks

Each provider has a health check function in `ProviderHealth.ts`:
- **Codex**: `checkCodexProviderStatus` — runs `codex --version`
- **Copilot**: `checkCopilotProviderStatus` — runs `copilot auth status`
- **KiloCode**: `checkKiloCodeProviderStatus` — runs `kilo --version`
- **Kimi**: `checkKimiProviderStatus` — runs `kimi --version`, login probe via `kimi login --json`
- **MiniMax**: `checkMiniMaxProviderStatus` — always "ready" (API-based, no CLI)
- **OpenCode**: `checkOpenCodeProviderStatus` — runs `opencode --version` + `opencode auth list`
- **Pi**: `checkPiProviderStatus` — reads `~/.pi/agent/auth.json` and `models.json`

---

## Provider Capability Matrix

| Provider | sessionModelSwitch | Auth Method | Protocol | CLI-based |
|----------|-------------------|-------------|----------|-----------|
| Codex | restart-session | API key | JSON-RPC over stdio | Yes |
| Copilot | in-session | `copilot login` / `gh auth` | ACP over stdio | Yes |
| KiloCode | in-session | Kilo Gateway OAuth | ACP over stdio | Yes |
| Kimi | in-session | `kimi login` or API key | ACP over stdio | Yes |
| MiniMax | restart-session | API key | REST/HTTP streaming | No |
| OpenCode | in-session | `opencode auth login` + OpenRouter API key | ACP over stdio | Yes |
| Pi | restart-session | Pi CLI `/login` or env vars | Node SDK | No |

---

## Stubbed / Placeholder Providers

According to `AGENTS.md`:
- **Claude Code**: Unavailable placeholder
- **Cursor**: Unavailable placeholder

These are documented as future integrations but not implemented.

---

## Notable Issues / Inconsistencies

1. **Pi `stopAll()` stub**: In `piSdkManager.ts`, the `stopAll()` method only resolves pending approvals but doesn't actually stop active sessions. This appears incomplete.

2. **Kimi temp config cleanup**: `chmodSync(dirPath, 0o700)` is best-effort only — errors are caught and silently ignored. The config directory is cleaned up via `rmSync` on session exit, but only if `tempConfigDir` is set.

3. **MiniMax lacks tool/permission support**: MiniMax is purely a text-completion API. There's no mechanism for permission requests or tool calls, unlike all ACP-based providers.

4. **Health check inconsistencies**: 
   - MiniMax health always "ready" regardless of whether API key is configured
   - Kimi health probes login state but KiloCode doesn't
   - Pi health reads catalog but doesn't verify auth actually works

5. **ProviderSession vs AgentSession**: Pi uses its own `AgentSession` type from `@mariozechner/pi-coding-agent` while all other providers use the shared `ProviderSession` from `@t3tools/contracts`. The adapter translates between them.

6. **No `respondToUserInput` implementation**: All adapters have `respondToUserInput` as a stub method that throws "Not implemented" — this appears to be unused placeholder for future multi-turn clarification flows.

---

## File Reference

### Adapter Layers (Effect Layer wrappers)
- `provider/Layers/CodexAdapter.ts`
- `provider/Layers/CopilotAdapter.ts`
- `provider/Layers/KiloCodeAdapter.ts`
- `provider/Layers/KimiAdapter.ts`
- `provider/Layers/MiniMaxAdapter.ts`
- `provider/Layers/OpenCodeAdapter.ts`
- `provider/Layers/PiAdapter.ts`

### Manager Classes
- `codexAppServerManager.ts` (~2096 lines)
- `copilotAcpManager.ts` (~983 lines)
- `kilocodeAcpManager.ts` (~914 lines)
- `kimiAcpManager.ts` (~1030 lines)
- `minimaxApiManager.ts` (~637 lines)
- `opencodeAcpManager.ts` (~1018 lines)
- `piSdkManager.ts` (~1372 lines)

### Shared Infrastructure
- `provider/acpAdapterSupport.ts` — Event stream bridging + error helpers
- `provider/acpRuntimeShared.ts` — ACP event mapping utilities
- `provider/Layers/EventNdjsonLogger.ts` — NDJSON event logging layer
- `provider/Layers/OpenCodeState.ts` — OpenCode-specific session state
- `piHarness.ts` — Pi SDK utilities and configuration

### Service Layers
- `provider/Services/ProviderAdapter.ts` — `ProviderAdapterShape` interface
- `provider/Services/ProviderService.ts` — Main orchestration service
- `provider/Services/ProviderAdapterRegistry.ts` — Adapter registry
- `provider/Services/ProviderHealth.ts` — Health check definitions
- `provider/Services/ProviderSessionDirectory.ts` — Session directory interface
