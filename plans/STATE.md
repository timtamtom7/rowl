# Rowl — Current State (Plans Front Door)

**Last updated:** 2026-05-29 (phase 1b tasks 1-2 in progress)
**Current focus:** Sub-project #1 — Memory-First Agent (phase 1a shipped; phase 1b tasks 1-2 in progress)

> **If you are a new session resuming Rowl work, read this file FIRST.**
> It orients you in ~60 seconds and tells you what to read next.

---

## Overall Goal (immutable)

Rowl's memory-first evolution is a deliberate synthesis of four open-source reference projects. Each contributes a specific layer. Do NOT forget this — it is the whole reason for the multi-sub-project arc. If any future session proposes narrowing or replacing this vision, check with the user first.

| Source repo                                                      | License    | Contributes                                                                                                                                                                                                     | Sub-project                                                 |
| ---------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [letta-code](https://github.com/letta-ai/letta-code)             | MIT        | **Memory-first agent architecture** — git-backed memory blocks, reminder engine, self-editing memory tool, Palace viewer, slash-command surface, agent creation flow                                            | #1                                                          |
| [paperclip](https://github.com/paperclipai/paperclip)            | Apache-2.0 | **Organizing layer** — Goal → Issue → Document/Feedback/Approval model, goal ancestry, versioned research docs as first-class artifacts                                                                         | #2                                                          |
| [t3code](https://github.com/pingdotgg/t3code)                    | MIT        | **Runtime base** (current Rowl already a fork) + **cherry-pick features** — git-native turn checkpoints, worktrees, stacked PRs, composer draft persistence, context meter, per-turn diff trees, approval gates | base + #3                                                   |
| [craft-agents-oss](https://github.com/lukilabs/craft-agents-oss) | Apache-2.0 | **UI / window aesthetic inspiration** — sidebar + skills/MCP surface, Mac-native desktop feel, information architecture. Reference for visual polish as Rowl matures.                                           | ongoing (visual reference across all sub-projects, esp. #4) |

All four are license-compatible (MIT / Apache-2.0). The cloned reference repos live at `/Users/mauriello/Dev/_reference/`.

**The goal in one sentence:** memory-first agents (Letta pattern) inside a t3code-derived runtime base, organized by Paperclip-style goal/issue/document structure, with Craft Agents-grade UI polish.

---

## Where we are right now

- **Sub-project:** #1 — [rowl-memory-first](./rowl-memory-first/)
- **Phase:** 1a **shipped**; 1b pending.
- **Branch:** `phase-1a/core-memory-substrate` (to be merged + tagged `v-phase-1a`).
- **Blocker:** none. Phase 1b ("Agent management — multi-agent, personalities, commands") is the next planning target; kick off with `superpowers:writing-plans` to produce `PHASE-1B-PLAN.md`.

## Last session handoff

- 2026-05-29: Phase 1B execution started. Tasks 1 and 2 are implemented in the worktree: shared core-agent contracts, WebSocket contract variants, and deterministic core-agent metadata file IO. Focused tests pass for `packages/contracts` and `apps/server/src/core-agent/agentMetadataStore.test.ts`. Commits could not be created in this environment because `.git` is not writable (`Operation not permitted` creating `.git/index.lock`). Server package typecheck remains blocked by pre-existing orchestration/type errors unrelated to these changes; the new core-agent WebSocket exhaustiveness case was handled with placeholder route errors pending Task 8.
- 2026-05-29: Phase 1B planning is complete; `plans/rowl-memory-first/PHASE-1B-PLAN.md` now contains the 14-task TDD implementation plan for core-agent contracts, metadata IO, presets, services, memory integration, WebSocket routes, slash commands, UI, `/new` inheritance, docs, verification, and tagging.

**Session end: 2026-04-17 (phase 1a shipped)**

All 15 tasks of `plans/rowl-memory-first/PHASE-1A-PLAN.md` executed. Branch `phase-1a/core-memory-substrate` is ready for merge + `v-phase-1a` tag. See `plans/rowl-memory-first/STATUS.md` "Retro log → Phase 1a" for what went well / what was painful / notes for future phases.

**Scope adjustment shipped:** memory edits use the agent's existing file-edit tools (gated by `file-change` approval) instead of a dedicated `memory` tool. SPEC §6 updated. Dedicated tool + `memory-write` approval kind deferred — research cross-provider tool layer before phase 1b starts.

**Next session resumes by:** writing `PHASE-1B-PLAN.md` (agent management). Read `plans/rowl-memory-first/SPEC.md` §7 and the STATUS phase tracker first.

---

**Previous session end: 2026-04-17 (spec revisions committed, ready for phase-1a planning)**

Brainstormed the memory-first evolution of Rowl. Decided:

- Base = current Rowl (a t3code fork, confirmed via git remotes + package.json)
- Letta integration = **Option C** — port the memory pattern, no Letta dependency
- Memory = two-tier: global (`~/.t3/rowl/agents/{id}/memory/`) + project (`{repo}/.rowl/memory/`, gitignored)
- Agent model: one agent per project; threads inherit project's agent
- Self-editing memory: yes, from phase 1a, gated by existing approval system

Wrote SPEC.md, RESEARCH.md, STATUS.md for sub-project #1, then revised:

- State dir path corrected `~/.rowl/` → `~/.t3/rowl/` throughout (matches `ROWL_STATE_DIR` default per AGENTS.md).
- Added SPEC §12 "Relationship to existing Rowl subsystems" — documents that existing `MemoryService`/`MemoryEntries` stub is reserved for future archival memory (SQLite/FTS5), and phase 1a introduces a NEW parallel `CoreMemoryService` for Letta-style named blocks. Two-layer model (core + archival) matches Letta's actual architecture.
- `.rowl/project-brief.md` and `AGENTS.md` stay user-authored (NOT memory blocks). Reminder engine reads all three sources when assembling turn context.

Architecture findings confirmed in-tree (for phase-1a plan author):

- Tool system dispatches via `ProviderAdapterRegistry`; approval types enumerated at `apps/server/src/orchestration/providerRuntime.ts:127-138`; approval rules at `apps/server/src/orchestration/approvalRules.ts:5-11`.
- Frontmatter parser helpers already exist at `apps/server/src/projectWorkspaceMetadata.ts:185+` (`parseFrontmatterSection`, `parseFlatFrontmatter`, `parseFrontmatterValue`) — no external YAML lib needed.
- Test framework: Vitest via `bun run test`. Pre-commit gates: `bun run fmt && bun run lint && bun run typecheck`.

**Next session resumes by:** invoke `superpowers:writing-plans` skill to produce `plans/rowl-memory-first/PHASE-1A-PLAN.md`. All inputs (SPEC/RESEARCH/STATUS) are in `plans/rowl-memory-first/`. After plan is written, hand off to a fresh execution session via `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`.

## The multi-initiative map

Sub-projects planned (in dependency order):

| #   | Initiative                                | Status                       | Why this order                                                                                                                                                 |
| --- | ----------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [rowl-memory-first](./rowl-memory-first/) | phase-1a shipped; 1b pending | Foundational. Every subsequent feature behaves differently if agents have memory vs not.                                                                       |
| 2   | rowl-organizing-layer _(future folder)_   | not-started                  | Paperclip-style Goal/Issue/Document/Feedback/Approval layer on top of memory.                                                                                  |
| 3   | rowl-t3-cherrypicks _(future folder)_     | not-started                  | Git checkpointing, worktrees, stacked PRs, composer-draft persistence, context-window meter, per-turn diff tree, etc. Self-contained cherry-picks from t3code. |
| 4   | rowl-research-ux _(future folder)_        | not-started                  | Surfaces sub-project #2's data model as a real research workflow UI.                                                                                           |

Each sub-project = one folder under `plans/` with SPEC/RESEARCH/STATUS (and PHASE-\*-PLAN.md files written as each phase begins).

## Reading order when you resume

**Every session start:**

1. This file (`plans/STATE.md`) — top section
2. Current sub-project's `STATUS.md` — session handoff + open questions
3. Current phase's `PHASE-*-PLAN.md` (if one exists)

**If zooming out or ambiguity:** 4. Current sub-project's `SPEC.md` — all phases, decisions, rationale 5. Current sub-project's `RESEARCH.md` — source-repo analysis + tradeoffs 6. `plans/INDEX.md` — full list of all Rowl initiatives (includes older pre-memory-first ones) 7. `docs/ROWL_VISION.md` — philosophical north star (agentic engineering control room, vibe coding)

## Reference material (external)

Reference repos cloned to `/Users/mauriello/Dev/_reference/`:

- `letta-code/` — **primary source for memory pattern**
- `craft-agents-oss/` — reference only (not our base)
- `paperclip/` — source for sub-project #2 (organizing layer)
- `t3code/` — the base of current Rowl

## Locked decisions across all sub-projects

- **2026-04-17** — Rowl base = current `/rowl` (t3code fork), NOT a fresh fork of craft-agents.
- **2026-04-17** — Letta: Option C (port pattern, no dep).
- **2026-04-17** — Memory storage: two-tier (global in `~/.rowl/`, project in `.rowl/memory/` gitignored default).
- **2026-04-17** — Agent ↔ thread: one agent per project.
- **2026-04-17** — Plans convention: use existing `plans/{initiative}/SPEC|RESEARCH|STATUS|PLAN|NOTES.md` pattern.
- **2026-04-17** — This STATE.md is the living front door. It is updated at every session end, every phase transition, every significant decision.
- **2026-04-17** — State dir = `~/.t3/rowl/` (not `~/.rowl/`). Matches existing `ROWL_STATE_DIR` default.
- **2026-04-17** — Two-layer memory model: new `CoreMemoryService` (phase 1a, Letta-style blocks) + existing `MemoryService` stub reserved for future archival/semantic layer. Not competing; complementary.
- **2026-04-17** — Phase 1a scope adjusted: memory edits via existing file-edit tools, not a dedicated `memory` tool. SPEC §6 updated. Dedicated tool + `memory-write` approval kind deferred to a later phase. Rowl has no cross-provider tool registry; doing it right requires either a new abstraction layer or seven per-adapter implementations, both outside phase-1a scope.

## Update discipline (non-negotiable)

Whenever you, the AI working on Rowl, do any of the following, you MUST update this file:

1. **Session end** — update "Last session handoff" with what happened and what's next.
2. **Phase transition** — update "Where we are right now".
3. **Sub-project transition** — update "Where we are right now" and the multi-initiative map.
4. **Architectural decision** — append to "Locked decisions across all sub-projects" with date.
5. **Spec revision** — note in "Last session handoff" that spec was revised and why.

Do not skip these updates. Future-you (with no context) will be reading this file to orient. If it is stale, orientation fails.
