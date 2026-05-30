# Rowl — Current State (Plans Front Door)

**Last updated:** 2026-05-30 (worktree checkpoint UI implemented in worktree)
**Current focus:** Sub-project #3 — rowl-t3-cherrypicks (worktree checkpoint UI; root verification blockers remain)

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

- **Sub-project:** #3 — rowl-t3-cherrypicks
- **Phase:** worktree checkpoint UI **implemented in worktree**
- **Branch:** `phase-1a/core-memory-substrate` (to be merged + tagged `v-phase-1a`)
- **Blocker:** root `bun run typecheck` still exits non-zero on pre-existing server Effect diagnostics; root `bun run test` is blocked in this sandbox by loopback `listen EPERM` in `packages/shared/src/Net.test.ts`.

## Last session handoff

- 2026-05-30: Worktree checkpoint UI implemented and committed (`Add worktree checkpoint UI`). Added `apps/web/src/git/useWorktreeCheckpoints.ts` with NativeApi/WS-backed `checkpoints.listByWorktree` and `checkpoints.createInWorktree` actions, loading/error state, refresh, and 15s polling while mounted. Added `apps/web/src/git/WorktreeCheckpointPanel.tsx` for expanded worktree checkpoint lists, inline checkpoint creation, checkpoint-to-main cherry-pick, and worktree branch merge. `WorktreePanel` now expands/collapses checkpoints per worktree and sends worktree integration operations to `main`. `wsNativeApi` now exposes `NativeApi.checkpoints` and the missing `git.stackBranch` binding; `packages/contracts/src/ipc.ts` already had the `NativeApi.checkpoints` contract binding. Fixed pre-existing web organizing exact-optional/PositiveInt type issues so web typecheck passes. Verification: `cd apps/web && bun run test` passes (79 files / 687 tests), `cd apps/web && bun run typecheck` passes, `bun run fmt` passes, and `bun run lint` exits 0 with existing warnings. Root `bun run typecheck` remains blocked by pre-existing server diagnostics in `apps/server/src/git/Layers/WorktreeService.ts` plus branded ID issues in organizing service tests. Root `bun run test` remains blocked by sandbox loopback `listen EPERM` failures in `packages/shared/src/Net.test.ts`.
- 2026-05-30: Organizing-layer slash commands implemented in worktree. Added server-side `/goals`, `/goals create`, `/goals update`, `/doc`, `/doc create`, `/doc read`, `/approve`, `/approve create`, `/approve approve`, and `/approve reject` handling in `apps/server/src/core-agent/coreAgentSlashCommands.ts`; `ProviderCommandReactor` now handles typed organizing commands with an assistant response instead of sending a provider turn. The commands route through `GoalsService` plus the existing document/approval service implementations, and docs now list the new commands in `README.md` and `.docs/provider-settings.md`. Focused verification passes: `cd apps/server && bun run test src/core-agent/coreAgentSlashCommands.test.ts` and `cd apps/server && bun run test src/core-agent/coreAgentSlashCommands.test.ts src/orchestration/Layers/ProviderCommandReactor.test.ts -t "slash commands|core agent slash command|core agent slash command execution"`. `bun run fmt` passes; `bun run lint` exits 0 with pre-existing warnings. `cd apps/server && bun run typecheck` remains blocked by pre-existing `WorktreeService` Effect error-channel diagnostics and organizing service tests that use unbranded string IDs. Root `bun run typecheck` is additionally blocked by existing web organizing UI type errors. Root `bun run test` remains blocked by sandbox loopback `listen EPERM` failures in `packages/shared/src/Net.test.ts`.
- 2026-05-30: Phase 1e implemented in worktree — `/compact` and `/reflect` server slash commands. `/compact` summarizes current thread messages with `ContextTrimmer` when available, writes a Memory Palace note tagged `compacted` + `conversation-summary`, and returns the filename. `/reflect` reads all active-agent notes and returns read-only patterns/gaps/contradictions/suggestions. Composer handling now lets typed `/compact` reach the server memory command, while `/summarize` remains the thread-continuation compaction shortcut. Docs updated. Focused tests pass: `cd apps/server && bun run test src/core-agent/coreAgentSlashCommands.test.ts src/core-agent/MemoryPalaceService.test.ts`, `cd apps/web && bun run test src/composer-logic.test.ts`, and `cd apps/server && bun run test src/orchestration/Layers/ProviderCommandReactor.test.ts -t "handles core agent slash commands without sending a provider turn"`. `bun run fmt` passes; `bun run lint` exits 0 with pre-existing warnings. `bun run typecheck` and full `bun run test` remain blocked as noted above. Commit could not be created because `.git/index.lock` cannot be created.
- 2026-05-29: Phase 1c shipped — Memory Palace service (file-based .md notes with YAML frontmatter at `~/.t3/rowl/memory/{agentId}/`), WebSocket API (memoryNotes.list/read/write/delete), memory-changed push events, two-pane memory panel UI with useMemoryNotes hook, 1,355 lines across 18 files. All tests pass.
- 2026-05-29: Phase 1d shipped — Editable memory UI (New Note, title/filename/tags/content editor, Save, delete with confirmation), /init command (seeds project-overview, tech-stack, conventions notes from workspace context), /doctor command (diagnoses memory health, suggests fixes). /init moved from client to server-side slash command. 1,007 lines across 14 files. All 154 tests pass.
- 2026-05-29: Fixed 3 pre-existing typecheck errors (EvaluatorServiceLive readonly array, ContextTrimmerLive.test type mismatch, OrchestrationEngineHarness missing ContextTrimmer layer).
- 2026-05-29: Phase 1b fully implemented and verified (tasks 1-14).
- **Next session:** resolve the remaining root verification blockers and decide whether `rowl-t3-cherrypicks` needs a formal SPEC/STATUS folder before further checkpoint/worktree expansion.
- 2026-05-29: Phase 1B explicit task 10 and task 11 request implemented in the worktree. Added `apps/web/src/core-agent/AgentPanel.tsx`, `apps/web/src/core-agent/useCoreAgents.ts`, and tests in `AgentPanel.test.tsx`; the panel lists scoped agents, shows the active agent, switches via `coreAgents.setActive`, and creates preset-backed agents via `coreAgents.create`. Added `NativeApi.coreAgents` bindings in contracts and `wsNativeApi`, and mounted the panel in the right sidebar Context tab. Added `/new` inherited-agent flow in `apps/web/src/core-agent/newAgentThread.ts` with tests: `/new` lists the project-scoped active agent, creates a sibling project agent inheriting name/description/personality/model metadata, sets it active, then opens the new draft thread without dispatching a provider turn; `ChatView` now uses that flow for the existing `/new` handler. Verification: initial focused tests failed for missing modules as expected; then `cd apps/web && bun run test src/core-agent/AgentPanel.test.tsx src/core-agent/newAgentThread.test.ts`, `cd apps/web && bun run test`, `cd apps/web && bun run typecheck`, `cd packages/contracts && bun run test`, and `cd packages/contracts && bun run typecheck` pass. Root `bun run fmt` passes. Root `bun run lint` exits 0 with pre-existing warnings only. Root `bun run typecheck` remains blocked by pre-existing `apps/server` orchestration/test errors (`OrchestrationEngineHarness.integration.ts`, `ContextTrimmerLive.test.ts`, `EvaluatorServiceLive.ts`). Commits for tasks 10 and 11 could not be created because `.git` is not writable (`Operation not permitted` creating `.git/index.lock`).
- 2026-05-29: Phase 1B tasks 7 and 9 are implemented in the worktree. Task 7 added `apps/server/src/core-agent/agentIdentityRouting.ts`, routes provider turns through `CoreAgentService.resolveActiveAgent`, threads `{agentId, projectRoot}` into `CoreMemoryService`, adds active-agent identity/personality to the `<agent_memory>` preamble, and commits memory updates against the active agent memory dir with commit messages that include the agent ID. Task 9 added `apps/server/src/core-agent/coreAgentSlashCommands.ts` for `/agents`, `/switch <name|id>`, and `/persona <preset|custom instructions>`, and `ProviderCommandReactor` now handles those commands with an assistant response instead of sending a provider turn. Focused tests pass for `cd apps/server && bun run test src/core-agent/`, `cd apps/server && bun run test src/orchestration/Layers/ProviderCommandReactor.test.ts -t "routes provider turns through the active project agent memory context"`, and `cd apps/server && bun run test src/orchestration/Layers/ProviderCommandReactor.test.ts -t "handles core agent slash commands without sending a provider turn"`. `cd apps/server && bun run typecheck` remains blocked by pre-existing orchestration/test errors unrelated to these tasks (`OrchestrationEngineHarness.integration.ts`, `ContextTrimmerLive.test.ts`, `EvaluatorServiceLive.ts`). Full `ProviderCommandReactor.test.ts` still has the pre-existing session-status assertion failure (`clears a prior session error when a new turn starts successfully`, expected `running`, received `error`). Commits for tasks 7 and 9 could not be created because `.git` is not writable (`Operation not permitted` creating `.git/index.lock`).
- 2026-05-29: Phase 1B tasks 5 and 6 are implemented in the worktree. Task 5 made `CoreMemoryService` agent-aware with validated optional `agentId`, active-agent resolution from project/global `active-agent.json`, global memory resolution under `{stateDir}/agents/{agentId}/memory`, preserved default-agent behavior, and project memory still shared at `{projectRoot}/.rowl/memory` per the two-tier model. Task 6 added `CoreAgentEvents.ts`, publishes `coreAgent.activeChanged` through the existing WS push bus, and wires `coreAgents.setActive` through that event path while thinly delegating the other core-agent WS routes to `CoreAgentService`. Focused tests pass for `cd apps/server && bun run test src/core-agent/` and `cd apps/server && bun run test src/core-agent/CoreAgentEvents.test.ts src/memory/Layers/CoreMemoryAgent.test.ts src/memory/Layers/CoreMemoryLive.test.ts src/memory/paths.test.ts`. Root `bun run fmt` passes. Root `bun run lint` exits 0 with existing warnings. `cd apps/server && bun run typecheck` remains blocked by pre-existing orchestration/test errors unrelated to tasks 5-6 (`OrchestrationEngineHarness`, `ContextTrimmerLive.test`, `EvaluatorServiceLive`). `cd apps/server && bun run test src/orchestration/Layers/ProviderCommandReactor.test.ts` has 25 passing tests and one repeated session-status assertion failure (`clears a prior session error when a new turn starts successfully`, expected `running`, received `error`). `cd apps/server && bun run test src/wsServer.test.ts` is blocked in this sandbox by `listen EPERM 0.0.0.0` and `EMFILE: too many open files, watch`. Commits for tasks 5 and 6 could not be created because `.git` is not writable (`Operation not permitted` creating `.git/index.lock`).
- 2026-05-29: Phase 1B tasks 3 and 4 are implemented in the worktree: built-in personality presets (`default`, `concise`, `planner`, `reviewer`, `implementer`), preset materialization into editable metadata, and a pure `CoreAgentService` with injected store/clock/id generator, CRUD, active-agent resolution, preset creation, stable active-change payloads, and serialized same-agent updates. Focused tests pass for `cd apps/server && bun run test src/core-agent/` and `cd packages/contracts && bun run test src/core-agent.test.ts`. `bun run fmt` passes. `bun run lint` exits 0 with existing warnings. Root/server typecheck remains blocked by pre-existing orchestration/type errors unrelated to core-agent work (`ContextTrimmer`, `EvaluatorServiceLive`, `OrchestrationEngineHarness`). Commits for tasks 3 and 4 could not be created because `.git` is not writable (`Operation not permitted` creating `.git/index.lock`). There is an unrelated untracked `CreatedImage.jpeg` in the worktree.
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

| #   | Initiative                                | Status                                    | Why this order                                                                                                                                                 |
| --- | ----------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [rowl-memory-first](./rowl-memory-first/) | phase-1a shipped; 1b verified in worktree | Foundational. Every subsequent feature behaves differently if agents have memory vs not.                                                                       |
| 2   | rowl-organizing-layer _(future folder)_   | command surface in worktree               | Paperclip-style Goal/Issue/Document/Feedback/Approval layer on top of memory.                                                                                  |
| 3   | rowl-t3-cherrypicks _(future folder)_     | not-started                               | Git checkpointing, worktrees, stacked PRs, composer-draft persistence, context-window meter, per-turn diff tree, etc. Self-contained cherry-picks from t3code. |
| 4   | rowl-research-ux _(future folder)_        | not-started                               | Surfaces sub-project #2's data model as a real research workflow UI.                                                                                           |

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
- **2026-04-17** — Memory storage: two-tier (global in `~/.t3/rowl/agents/{id}/memory/` by default, project in `.rowl/memory/` gitignored default).
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
