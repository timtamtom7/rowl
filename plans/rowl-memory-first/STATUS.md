# STATUS — Rowl Memory-First Agent

**Overall status:** spec-draft (awaiting user review before phase-1a planning)
**Owner:** timtamtom7
**Spec approved:** not yet
**Plan written:** not yet
**Current branch:** n/a (no code written yet)

---

## Phase status tracker

| Phase | Description | Status | Branch | Tag on ship | Notes |
|---|---|---|---|---|---|
| 1a | Core memory substrate | pending (awaiting spec approval) | — | — | Will be the first implementation milestone. |
| 1b | Agent management (multi-agent, personalities, commands) | pending | — | — | Starts after 1a ships. |
| 1c | Memory Palace + in-app `/memory` view (read-only) | pending | — | — | |
| 1d | Editable memory + `/init` + `/doctor` | pending | — | — | |
| 1e | Consolidation (`/compact`, `/reflect`) — optional | pending | — | — | Can be cut if scope gets tight. |

---

## Locked decisions (chronological)

- **2026-04-17** — Rowl confirmed as base (t3code fork), NOT craft-agents-oss. Verified via git remotes + package.json.
- **2026-04-17** — Letta integration path = **Option C** (port pattern, no Letta dependency). See RESEARCH §2.
- **2026-04-17** — Memory scope is **two-tier**: global at `~/.rowl/agents/{id}/memory/`, project at `{projectRoot}/.rowl/memory/`.
- **2026-04-17** — Agent-thread model: **one agent per project**. Threads inherit the project's agent.
- **2026-04-17** — Self-editing memory from phase 1a, gated via Rowl's existing approval system (new approval type: `memory-write`).
- **2026-04-17** — Project memory **gitignored by default**. Opt-in to commit via `commitMemory: true` in `.rowl/agent.json`.
- **2026-04-17** — Docs convention: align with existing Rowl `plans/` system (SPEC/RESEARCH/STATUS/PLAN/NOTES per initiative), not a new `docs/rowl/` structure.
- **2026-04-17** — Living front door = `plans/STATE.md` at the plans root. Every future session reads it first.
- **2026-04-17** — State dir convention = `~/.t3/rowl/` (matches existing `ROWL_STATE_DIR` default per AGENTS.md), not `~/.rowl/`. Spec corrected.
- **2026-04-17** — Existing `MemoryService` + `MemoryEntries` stub = future **archival memory** layer (SQLite/FTS5, type-categorized, query-searchable). Sub-project #1 does NOT implement it. Sub-project #1 adds a NEW, parallel `CoreMemoryService` for Letta-style named blocks injected every turn. Two-layer model (core + archival) matches Letta's architecture. See SPEC §12.
- **2026-04-17** — `.rowl/project-brief.md` and `AGENTS.md` stay user-authored; they are NOT memory blocks. The reminder engine reads all three (project-brief, AGENTS.md, memory blocks) when assembling turn context.

---

## Open questions (blocking / non-blocking)

From SPEC §11, repeated here for quick access:

- [ ] **(non-blocking)** What is Rowl's approval system's extension API? — investigate in phase 1a plan.
- [ ] **(non-blocking)** System prompt vs system-reminder injection per provider adapter — decide per-adapter in phase 1a plan.
- [ ] **(non-blocking)** UI placement of agent name/indicator — revisit at phase 1b.
- [ ] **(blocking-for-1a)** Verify `~/.rowl/` is free of collisions on target systems. Quick check at start of 1a planning.

---

## Session handoff (most recent)

**Session end: 2026-04-17 (brainstorming complete)**
- Brainstormed sub-project #1 scope, decomposition, architectural decisions
- Cloned 4 ref repos to `/Users/mauriello/Dev/_reference/`
- Confirmed Rowl's actual base = t3code fork
- Drafted SPEC.md, RESEARCH.md, STATUS.md for rowl-memory-first
- Next steps when session resumes:
  1. User reviews SPEC.md and RESEARCH.md
  2. If approved, proceed to phase-1a planning via `superpowers:writing-plans` skill
  3. Plan produces `plans/rowl-memory-first/PHASE-1A-PLAN.md`
  4. Execute plan via `superpowers:executing-plans` skill (separate fresh session)

---

## Retro log

_(empty — no phase has shipped yet)_

Each phase, on ship:
1. Add entry to "Retro log" below: what went well, what was painful, what future phases should know.
2. Update phase status tracker above.
3. Update `plans/STATE.md` at the plans root.
4. Tag the commit (e.g., `v-phase-1a`).
