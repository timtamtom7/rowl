# Provider architecture

The web app communicates with the server via WebSocket using typed request/response envelopes from `@t3tools/contracts`.

- **Requests**: `{ id, body }`, where `body` is a tagged payload with a `_tag` matching the operation.
- **Responses**: `{ id, result? , error? }`
- **Push events**: `{ type: "push", channel, data }`

Current push channels include:

- `orchestration.domainEvent`
- `terminal.event`
- `server.welcome`
- `server.configUpdated`

Request bodies cover more than provider lifecycle calls. The WebSocket surface currently includes:

- orchestration commands and diff/snapshot queries
- project registry search/write operations, including workspace `AGENTS.md` discovery/drafting, `.rowl/commands/*.md` template discovery, and `.rowl/skills/<name>/SKILL.md` discovery
- thread collaboration and history operations, including share create/get/revoke/import, compaction, undo, redo, and redo-status queries
- shell/editor integration
- git operations
- terminal operations
- server metadata, Copilot reasoning probing, and keybinding updates

Provider-native runtime details are hidden behind the server provider layer:

- **Codex**: `codex app-server` over JSON-RPC stdio
- **GitHub Copilot**: ACP-backed runtime sessions
- **KiloCode**: ACP-backed runtime sessions through `kilo acp`, with Kilo Gateway OAuth authentication
- **Kimi Code**: ACP-backed runtime sessions, with optional API-key-backed startup
- **MiniMax**: direct API sessions via OpenAI-compatible streaming endpoint (MiniMax-M2.7), with native tool calling and image support
- **OpenCode**: ACP-backed runtime sessions through `opencode acp`
- **Pi**: embedded `@mariozechner/pi-coding-agent` Node SDK sessions with Rowl-owned approval gating and Pi resource discovery disabled

Unexpected provider exits are reduced into orchestration session state as stopped sessions that still preserve the runtime exit reason in `thread.session.lastError`, so crashes do not render as silent clean stops in the UI.

When a thread resolves to a workspace root and that workspace contains `AGENTS.md`, the server-side provider reactor wraps each outgoing provider turn with the contents of that file before dispatching the turn to the active provider runtime. This keeps workspace instructions provider-agnostic instead of relying on a provider-specific session bootstrap mechanism.

Pi is the main exception to the repo's usual external-CLI pattern: Rowl embeds Pi through its Node SDK, reuses Pi auth/models config from `~/.pi/agent`, and keeps Pi packages, AGENTS files, system prompts, extensions, skills, prompt templates, and themes disabled so Pi threads do not double-apply repo instructions that Rowl already injects.

Codex, GitHub Copilot, KiloCode, Kimi Code, MiniMax, OpenCode, and Pi are the currently implemented providers. Gemini models are accessible through OpenRouter/Codex, not as a standalone provider. `claudeCode` and `cursor` remain unavailable placeholders for future support.

In the current OpenCode phase, Rowl still treats credential storage and OAuth flows as provider-owned concerns, but it now inspects OpenCode's resolved config paths plus `opencode auth list`, `opencode mcp list`, and `opencode mcp auth list` to surface provider credentials and MCP status in both Settings and `server.getConfig`. Rowl still launches `opencode acp`, consumes its ACP model/session events, and applies per-session runtime-mode overrides through `OPENCODE_CONFIG_CONTENT` rather than proxying the underlying auth flows itself.

For the researched GLM Coding Plan and MiniMax roadmap, see [./glm-minimax-support-plan.md](./glm-minimax-support-plan.md).
