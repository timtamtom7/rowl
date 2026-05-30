# Rowl Phase 1B Migration Guide

Phase 1B adds visible core agents on top of the Phase 1A memory substrate. Agents are Rowl metadata and memory context layered around provider-native sessions; Codex, Copilot, OpenCode, KiloCode, Kimi Code, MiniMax, and Pi still run through their existing adapters.

## Agent Scope

Rowl supports two agent scopes:

- Global agents live under `{ROWL_STATE_DIR}/agents/{agentId}/metadata.json`. If `ROWL_STATE_DIR` is unset, the default state dir is `~/.t3/rowl`.
- Project agents live under `{projectRoot}/.rowl/agents/{agentId}/metadata.json`.

Each scope also has an `active-agent.json` file. Provider turns resolve the active project agent when a project is open, otherwise they fall back to the active global agent. If no active agent exists, Rowl creates a default preset-backed agent for that scope.

## Personality Presets

New agents can start from built-in presets:

- `default`
- `concise`
- `planner`
- `reviewer`
- `implementer`

Presets only seed editable metadata. After creation, an agent's `personality.instructions` can be customized without changing the preset catalog. Custom personalities use:

```json
{
  "kind": "custom",
  "instructions": "Always explain release risk before implementation details."
}
```

Preset-backed personalities use:

```json
{
  "kind": "preset",
  "presetId": "reviewer",
  "instructions": "Review for correctness, tests, and regressions."
}
```

## Slash Commands

Phase 1B adds server-handled agent commands:

- `/agents` lists agents in the current scope and marks the active agent.
- `/switch <name-or-id>` switches the active agent in the current scope.
- `/persona <preset>` updates the active agent to a built-in preset.
- `/persona <custom instructions>` replaces the active agent personality with custom instructions.

Phase 1D adds memory maintenance commands handled by the same server slash-command path:

- `/init` seeds or refreshes project memory notes from the active workspace. It reads repository context including git metadata, `package.json`, README content, and existing `.rowl/` files, then writes `project-overview`, `tech-stack`, and `conventions` notes through the Memory Palace service.
- `/doctor` diagnoses memory health for the active agent and scope. It reports note count, last updated time, empty notes, active-agent metadata consistency, and suggested fixes such as running `/init`.

Phase 1E adds consolidation commands:

- `/compact` summarizes the current conversation and writes a tagged Memory Palace note with `compacted` and `conversation-summary` tags. The response includes the created note filename.
- `/reflect` reads all memory notes for the active agent and returns a read-only diagnostic covering patterns, gaps, contradictions, and suggestions.

The existing `/new` flow creates a new draft thread and creates a project-scoped child agent that inherits the current agent's personality, description, tags, and default model. Rowl sets the child active before opening the draft thread.

## Memory Blocks

Global memory blocks are per agent:

```text
{ROWL_STATE_DIR}/agents/{agentId}/memory/*.md
```

Project memory blocks are per project in Phase 1B:

```text
{projectRoot}/.rowl/memory/*.md
```

When a turn starts, Rowl injects the active agent identity, editable personality, global agent memory, and project memory into the provider-agnostic memory preamble. Switching agents changes which global memory blocks are read. Project memory remains shared for the project and is gitignored by default.

## Editable Memory Notes

The right-sidebar Agent panel includes a Memory tab. Users can create notes with **New Note**, edit the selected note's title, filename, tags, and markdown body, then save through `memoryNotes.write`. Each note row has a delete control with confirmation before `memoryNotes.delete`.

After writes and deletes, the server publishes `memory-changed`; connected clients refresh matching active-agent memory notes from that push event.

## WebSocket API

Core-agent operations are exposed through the existing WebSocket RPC envelope:

- `coreAgents.list`
- `coreAgents.create`
- `coreAgents.update`
- `coreAgents.delete`
- `coreAgents.setActive`

Requests use the shared schemas from `@t3tools/contracts`:

- `CoreAgentListRequest`
- `CoreAgentCreateRequest`
- `CoreAgentUpdateRequest`
- `CoreAgentDeleteRequest`
- `CoreAgentSetActiveRequest`

`coreAgents.setActive` also publishes `coreAgent.activeChanged` so connected clients can refresh selectors and active-agent labels.

Memory note operations use the same WebSocket RPC envelope:

- `memoryNotes.list`
- `memoryNotes.read`
- `memoryNotes.write`
- `memoryNotes.delete`

`memoryNotes.write` and `memoryNotes.delete` publish `memory-changed` with the affected scope, agent id, filename, and operation.
