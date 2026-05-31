# SPEC — Rowl Memory-First Agent

**Status:** spec-draft
**Sub-project:** #1 of a multi-initiative evolution toward a memory-first, research-organized, agent control room.
**Base:** current Rowl (t3code fork). No new base platform; we build on what exists.
**Last updated:** 2026-04-17

---

## 1. Why this sub-project exists

Rowl today is a strong orchestration shell — multi-provider, plan sidebar, permission gates, workspace-local skills/commands. What it is missing is **memory**. Every new thread starts from zero. The agent does not know the project across conversations, does not know the user across projects, does not accumulate understanding over time.

Letta's "memory-first agent" pattern solves this: agents have persistent memory blocks (markdown files with frontmatter), versioned in git, injected into the prompt every turn. The agent can edit its own memory; the user can browse and edit it too. Memory is inspectable, editable, and portable — not a black-box vector DB.

This sub-project ports that pattern into Rowl, adapted to Rowl's existing architecture (project-centric, t3code-derived, approval-gated).

## 2. Non-goals (explicit scope limits)

To keep this shippable, the following are **out of scope** for sub-project #1:

- Paperclip-style goal/issue/document organizing layer — that is sub-project #2.
- t3code git-checkpoint system and worktree automation — sub-project #3.
- Full archival/semantic memory with vector search — deferred (phase 1e provides a compaction-style substitute, and we can add real archival later as a pluggable module).
- A dependency on Letta's server or API — we port the pattern, we do not integrate with Letta (see RESEARCH.md §2 for the A/B/C decision).
- Multi-tenant / team-shared memory — single-user, single-machine model for now.

## 3. Architectural decisions (locked)

| Decision                           | Choice                                                                  | Why                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Integration path for Letta pattern | **Port the pattern, no Letta dependency (Option C)**                    | Self-contained Rowl; full control over memory semantics; privacy by default. See RESEARCH.md §2.                                 |
| Memory scope                       | **Two tiers: global (cross-project) + project (per-codebase)**          | Global holds persona/user preferences; project holds the _real_ memory — architecture, decisions, conventions, gotchas.          |
| Agent ↔ thread relationship        | **One agent per project. Threads belong to the project's agent.**       | Matches Rowl's project-centric model. A project's agent accumulates project understanding; all threads in that project share it. |
| Self-editing memory                | **Yes, from phase 1a, gated by Rowl's existing approval system**        | Without self-editing the agent cannot actually _learn_ the project. Approval gates make it safe; git makes it reversible.        |
| Storage format                     | **Markdown files with YAML frontmatter (`.md`), git-backed**            | Same pattern as Letta. Human-readable, diffable, portable.                                                                       |
| Global memory location             | **`~/.t3/rowl/agents/{agentId}/memory/`**                               | Matches existing `ROWL_STATE_DIR` default (`~/.t3/rowl`) per AGENTS.md. Per-agent, cross-project.                                |
| Project memory location            | **`{projectRoot}/.rowl/memory/`** (gitignored by default)               | Lives with the project but is private to the user unless opted in (`commitMemory: true`).                                        |
| File extension                     | **`.md`, not `.mdx`**                                                   | Rowl does not use MDX elsewhere; plain markdown is simpler. Frontmatter stays YAML.                                              |
| Memory-editing mechanism in 1a     | **Agent uses existing file-edit tools; dedicated memory tool deferred** | Rowl has no cross-provider tool registry. File-edit tools already have `file-change` approval. See §6 for deferral note.         |

## 4. Data model

### 4.1 Memory block

A memory block is a markdown file with YAML frontmatter:

```markdown
---
label: architecture
description: High-level architecture of this project — packages, data flow, key boundaries
read_only: false
scope: project
version: 1
---

# Project architecture

[markdown body]
```

Frontmatter fields:

- `label` (required) — unique within its scope. Used as the block's identifier.
- `description` (required) — one-line description, injected into the system prompt alongside the block body.
- `read_only` (optional, default false) — if true, agent cannot edit via memory tool. User can always edit.
- `scope` (required) — `global` or `project`.
- `version` (optional) — integer incremented on each edit. Used for conflict detection.

Block body is plain markdown. No hard length limit in phase 1a, but soft warning above ~4k tokens per block.

### 4.2 Agent

An agent is a named, persisted entity with:

- `id` — uuid
- `name` — user-assigned (default "Rowl")
- `personality` — preset name (e.g., `rowl-default`, `linus`, `kawaii`) that seeds `persona` block
- `model` — default provider + model for threads owned by this agent (user can override per-thread)
- `created_at`, `updated_at`
- `tags` — optional, string array
- `pinned` — boolean

Agent metadata stored at `~/.t3/rowl/agents/{agentId}/agent.json`.
Agent's global memory blocks stored at `~/.t3/rowl/agents/{agentId}/memory/*.md` (one git repo per agent).

### 4.3 Project-to-agent binding

A project binds to exactly one agent via `{projectRoot}/.rowl/agent.json`:

```json
{
  "agentId": "01J...",
  "boundAt": "2026-04-17T14:30:00Z",
  "commitMemory": false
}
```

Project memory blocks live at `{projectRoot}/.rowl/memory/*.md`. This directory is a git repo (separate from the project's own git repo, to avoid polluting project history). The project memory repo is gitignored from the project's outer repo unless `commitMemory: true`.

### 4.4 Default blocks

On agent creation, these blocks are seeded:

**Global:**

- `persona` — who the agent is (seeded from personality preset)
- `human` — who the user is (minimal seed; fills in over time)
- `preferences` — general coding/communication preferences (empty seed)

**Project (on first bind to a project):**

- `overview` — one-paragraph description of what the project is (seeded from first exchange or manual input)
- `architecture` — empty; fills in as the agent learns
- `conventions` — empty
- `decisions` — empty, append-only log
- `current-focus` — empty, what we're working on right now

## 5. Reminder engine (prompt assembly)

On every turn, before the LLM call, assemble a **memory preamble** and inject it as part of the system prompt (or a system-reminder message, depending on provider format).

Assembly order:

1. Agent identity line — "You are {agent.name}, a memory-first coding agent."
2. Global blocks, in order: `persona`, `human`, `preferences`, then any others alphabetically
3. Project blocks, in order: `overview`, `architecture`, `conventions`, `decisions`, `current-focus`, then any others alphabetically
4. Memory-editing instructions (if agent has memory tool available)

Each block rendered as:

```
## {label} — {description}
{body}
```

Total memory-preamble token budget: **soft cap 8k tokens per turn**. If exceeded, log a warning and emit a status event to UI; do not silently truncate in phase 1a. (Phase 1e addresses this via consolidation.)

## 6. Memory tool (agent self-editing)

> **Phase 1a implementation:** memory edits use the agent's existing file-edit tools, gated by the existing `file-change` approval. The dedicated `memory` tool (six subcommands, `memory-write` approval kind) described below is deferred to a later phase — we will either invent a cross-provider tool layer or prototype per-adapter. Rationale: Rowl has no central cross-provider tool registry (see RESEARCH.md §3 update), so a dedicated tool would have required either (a) a new abstraction layer or (b) seven per-adapter implementations, both outside phase-1a scope.

A new tool `memory` is registered for agents that have memory. Subcommands:

| Command              | Args                                              | Effect                                 |
| -------------------- | ------------------------------------------------- | -------------------------------------- |
| `create`             | `label`, `description`, `scope`, `body`, `reason` | Create new block in scope's memory dir |
| `str_replace`        | `label`, `scope`, `old`, `new`, `reason`          | Exact string replace in block body     |
| `insert`             | `label`, `scope`, `after_line`, `text`, `reason`  | Insert text after given line           |
| `delete`             | `label`, `scope`, `reason`                        | Delete entire block                    |
| `rename`             | `label`, `scope`, `new_label`, `reason`           | Rename block                           |
| `update_description` | `label`, `scope`, `new_description`, `reason`     | Update frontmatter description         |

Every call:

1. Passes through Rowl's existing approval gate (new approval type: `memory-write`). Scopes: approve once / always-this-session / decline / cancel-turn.
2. On approval: mutation applied, file saved, git commit made with message `{command}: {label} — {reason}`.
3. Result returned to agent: success + new file hash, or error + reason.

Pre-commit hook (local git repo hook inside the memory repo):

- Validates YAML frontmatter parseable
- Enforces `read_only` fields cannot be altered
- Enforces `description` is non-empty

## 7. Memory Palace (browser viewer)

`/palace` slash command generates a self-contained HTML file at `~/.t3/rowl/palaces/{agentId}-{timestamp}.html` and opens it in the default browser.

Contents:

- **Left pane:** file tree (global + project memory, grouped by scope)
- **Center pane:** selected block rendered as markdown, with raw/rendered toggle
- **Right pane:** commit history for the selected block (last 100 commits), diff viewer for each commit
- **Top bar:** agent name, project name, total memory size, "refresh" button

Phase 1a: **read-only**. No editing from the palace.
Phase 1d: editing enabled (inline edit → commit with reason → refresh).

## 8. In-app memory view (`/memory`)

`/memory` slash command opens an in-Rowl panel (likely in the right sidebar, matching Rowl's existing sidebar pattern). Text-tree navigation of memory blocks, with content preview on selection. Keyboard: `↑↓` navigate, `Enter` expand, `E` edit (phase 1d+), `O` open palace in browser.

Less rich than Palace, but fast, in-app, and doesn't require a browser.

## 9. Slash commands (phase by phase)

Phase 1a commands:

- `/remember {text}` — user tells agent to remember X. Creates or appends to appropriate block; asks agent which block.
- `/memory` — opens in-app memory view

Phase 1b commands:

- `/agents` — list and switch between agents
- `/new` — create a new thread (optionally create new agent)
- `/rename` — rename current agent
- `/description` — update current agent's description
- `/pin`, `/unpin` — pin/unpin current agent

Phase 1c commands:

- `/palace` — open Memory Palace in browser

Phase 1d commands:

- `/init` — initialize or re-initialize project memory (seeds default project blocks by having agent read the repo)
- `/doctor` — agent audits and refines memory structure

Phase 1e commands (optional):

- `/compact` — summarize long conversation into memory
- `/reflect` — spawn subagent to review recent transcript and update memory

## 10. Phase breakdown

Each phase ships a working app. No phase starts until the prior ships (all tests pass, manual smoke, retro written).

### Phase 1a — Core memory substrate

**Goal:** agents have persistent global + project memory; memory is injected each turn; agent can edit memory via approval-gated tool.

Scope:

- Memory block format, storage, git repos (global + project)
- Agent data model (JSON file), project-to-agent binding
- Default blocks seeded on agent creation and project binding
- Reminder engine assembles memory into system prompt
- Memory tool with 6 commands (create/str_replace/insert/delete/rename/update_description)
- New approval type `memory-write`
- `/remember` slash command (minimal)
- Migration: existing threads assigned to a default agent bound to their project

Out of scope for 1a:

- Multi-agent management UI (only one implicit default agent)
- Memory Palace UI (only raw file inspection via file explorer)
- Personality presets beyond "rowl-default"

### Phase 1b — Agent management

**Goal:** multi-agent support with named agents, personality presets, agent switching UI.

Scope:

- `/agents`, `/new`, `/rename`, `/description`, `/pin`, `/unpin` commands
- Agent selector in main UI (sidebar or header)
- Personality presets: `rowl-default`, `linus`, `kawaii`, `claude`, `codex`
- Agent creation dialog (name, personality, model)
- Multi-agent per project (one is "active", user can switch)

### Phase 1c — Memory Palace (read-only)

**Goal:** inspectable, navigable memory via browser palace + in-app view.

Scope:

- `/palace` command generates HTML, opens in browser
- `/memory` opens in-app sidebar view
- Both are read-only
- Palace includes file tree, content, commit history, diff viewer

### Phase 1d — Editable memory + `/init` + `/doctor`

**Goal:** users can edit memory directly; agent can bootstrap project memory from repo scan.

Scope:

- Palace and in-app `/memory` view gain edit capability
- Edits commit to git with user-provided reason (or auto reason "user edit")
- `/init` command: agent scans repo, proposes initial project blocks, user approves
- `/doctor` command: agent audits memory for redundancy, staleness, missing blocks; proposes fixes

### Phase 1e — Consolidation (optional, can defer)

**Goal:** long conversations compress into memory; prevent context bloat.

Scope:

- `/compact` command: agent summarizes current transcript, writes key facts to project memory
- `/reflect` command: spawn subagent that reads recent transcripts and refines memory blocks
- Optional: automatic compaction when thread exceeds N tokens

## 11. Open questions (resolve before phase 1a starts)

- [ ] What is Rowl's existing approval system's extension API? (Checked in phase 1a plan — may need small refactor to add a new approval type.)
- [ ] Should the memory preamble go in the system prompt, a system-reminder message, or both? (Depends on each provider adapter. Probably both patterns in different adapters.)
- [ ] Where in the UI does the agent name/indicator go? (Product question — revisit at phase 1b.)
- [ ] Should `~/.t3/rowl/` conflict with anything on the user's system? (Verify: letta uses `~/.letta/`, t3code uses various. `~/.t3/rowl/` should be clean.)

## 12. Relationship to existing Rowl subsystems

Three existing Rowl surfaces sit near this work. Preserving their roles keeps the mental model clean:

- **`.rowl/project-brief.md`** (existing) — user-authored project instructions. Read as context each turn. **We do NOT merge it with memory blocks.** Project-brief is stable, human-authored; memory is evolving, agent-co-authored. The reminder engine reads both sources and concatenates them.
- **`AGENTS.md`** (existing, repo root) — global workspace instructions. Same as project-brief: read as context, never written to by the agent. Distinct from memory.
- **`apps/server/src/orchestration/Services/MemoryService.ts`** (existing stub, unimplemented) — interface for SQLite/FTS5-backed, type-categorized, importance-scored, query-searchable memory entries. This is the natural home for **archival / semantic memory** in a later phase. We do NOT implement it in sub-project #1. Phase 1e may call into it for consolidation.

Phase 1a introduces a NEW, parallel service:

- **`CoreMemoryService`** — Letta-style named blocks, whole-memory injection each turn, file+git-based, inspectable. This is the core memory layer.

The long-term model is Letta's two-layer memory: **core memory** (always in prompt, small, curated) + **archival memory** (searched on demand, large, compressed). Sub-project #1 builds core memory. Archival memory is future work that will implement the already-sketched `MemoryService` interface.

## 13. Success criteria

Sub-project #1 is "done" when:

- An agent remembers the user's preferences across every project.
- An agent accumulates project understanding across conversations within that project.
- The user can inspect and edit memory through Palace and in-app.
- Memory writes are safe (approval-gated, git-versioned).
- No existing Rowl functionality regresses.
- All of `bun run fmt`, `bun run lint`, `bun run typecheck`, `bun run test` pass.
