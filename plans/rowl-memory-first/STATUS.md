# STATUS — Rowl Memory-First Agent

**Overall status:** phase-1a shipped; phase-1b implementation verified in worktree
**Owner:** timtamtom7
**Spec approved:** yes
**Plan written:** `PHASE-1A-PLAN.md` (complete, executed)
**Current branch:** `phase-1a/core-memory-substrate`

---

## Phase status tracker

| Phase | Description                                             | Status  | Branch                           | Tag on ship  | Notes                                                                                                                                                  |
| ----- | ------------------------------------------------------- | ------- | -------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1a    | Core memory substrate                                   | shipped | `phase-1a/core-memory-substrate` | `v-phase-1a` | All 15 tasks executed. Memory tool deferred (see locked decisions).                                                                                    |
| 1b    | Agent management (multi-agent, personalities, commands) | active  | `phase-1a/core-memory-substrate` | —            | Tasks 1-14 implemented and focused verification complete in worktree; root typecheck remains blocked by pre-existing server orchestration/test errors. |
| 1c    | Memory Palace + in-app `/memory` view (read-only)       | pending | —                                | —            |                                                                                                                                                        |
| 1d    | Editable memory + `/init` + `/doctor`                   | pending | —                                | —            |                                                                                                                                                        |
| 1e    | Consolidation (`/compact`, `/reflect`) — optional       | pending | —                                | —            | Can be cut if scope gets tight.                                                                                                                        |

---

## Locked decisions (chronological)

- **2026-04-17** — Rowl confirmed as base (t3code fork), NOT craft-agents-oss. Verified via git remotes + package.json.
- **2026-04-17** — Letta integration path = **Option C** (port pattern, no Letta dependency). See RESEARCH §2.
- **2026-04-17** — Memory scope is **two-tier**: global at `~/.t3/rowl/agents/{id}/memory/` by default, project at `{projectRoot}/.rowl/memory/`.
- **2026-04-17** — Agent-thread model: **one agent per project**. Threads inherit the project's agent.
- **2026-04-17** — Self-editing memory from phase 1a, gated via Rowl's existing approval system (new approval type: `memory-write`).
- **2026-04-17** — Project memory **gitignored by default**. Opt-in to commit via `commitMemory: true` in `.rowl/agent.json`.
- **2026-04-17** — Docs convention: align with existing Rowl `plans/` system (SPEC/RESEARCH/STATUS/PLAN/NOTES per initiative), not a new `docs/rowl/` structure.
- **2026-04-17** — Living front door = `plans/STATE.md` at the plans root. Every future session reads it first.
- **2026-04-17** — State dir convention = `~/.t3/rowl/` (matches existing `ROWL_STATE_DIR` default per AGENTS.md), not `~/.rowl/`. Spec corrected.
- **2026-04-17** — Existing `MemoryService` + `MemoryEntries` stub = future **archival memory** layer (SQLite/FTS5, type-categorized, query-searchable). Sub-project #1 does NOT implement it. Sub-project #1 adds a NEW, parallel `CoreMemoryService` for Letta-style named blocks injected every turn. Two-layer model (core + archival) matches Letta's architecture. See SPEC §12.
- **2026-04-17** — `.rowl/project-brief.md` and `AGENTS.md` stay user-authored; they are NOT memory blocks. The reminder engine reads all three (project-brief, AGENTS.md, memory blocks) when assembling turn context.
- **2026-04-17** — Phase 1a scope adjusted: memory edits via existing file-edit tools, not a dedicated memory tool. SPEC §6 updated. Dedicated `memory` tool + `memory-write` approval kind deferred to a later phase. Rationale: Rowl has no cross-provider tool registry; a dedicated tool would have required either a new abstraction layer or seven per-adapter implementations, both outside phase-1a scope.

---

## Open questions (blocking / non-blocking)

From SPEC §11, repeated here for quick access:

- [ ] **(non-blocking)** What is Rowl's approval system's extension API? — investigate in phase 1a plan.
- [ ] **(non-blocking)** System prompt vs system-reminder injection per provider adapter — decide per-adapter in phase 1a plan.
- [ ] **(non-blocking)** UI placement of agent name/indicator — revisit at phase 1b.
- [ ] **(blocking-for-1a)** Verify `~/.t3/rowl/` is free of collisions on target systems. Quick check at start of 1a planning.

---

## Session handoff (most recent)

**Session end: 2026-05-29 (phase 1b docs, smoke matrix, and final focused verification complete in worktree)**

- Added `docs/ROWL_PHASE1B_MIGRATION.md` with concise migration guidance for core-agent scope, global vs project storage, preset/custom personalities, `/agents`, `/switch`, `/persona`, `/new` inheritance, memory block resolution, and `coreAgents.*` WebSocket methods.
- Added `apps/server/src/core-agent/coreAgentSmoke.test.ts`, a focused smoke matrix covering:
  - create project agent, set active, and resolve the correct active agent memory blocks;
  - switch agent and verify global memory switches;
  - `/agents`, `/switch`, and `/persona reviewer`;
  - `/new` child-agent inheritance behavior with parent memory preserved;
  - shared-schema WebSocket route coverage for `coreAgents.list`, `coreAgents.create`, `coreAgents.update`, `coreAgents.delete`, and `coreAgents.setActive`.
- Verification:
  - `bun run fmt` passes.
  - `bun run lint` exits 0 with 73 pre-existing warnings.
  - `cd packages/contracts && bun run test` passes.
  - `cd apps/server && bun run test src/core-agent/ src/memory/` passes.
  - `cd apps/web && bun run test src/core-agent/` passes.
  - `bun run typecheck` remains blocked by pre-existing server orchestration/test errors unrelated to this docs/smoke work (`integration/OrchestrationEngineHarness.integration.ts`, `src/orchestration/Layers/ContextTrimmerLive.test.ts`, `src/orchestration/Layers/EvaluatorServiceLive.ts`).
- Worktree additions from this session: `docs/ROWL_PHASE1B_MIGRATION.md` and `apps/server/src/core-agent/coreAgentSmoke.test.ts`.
- Next task: resolve the pre-existing server typecheck blockers, then commit/tag the Phase 1B work.

**Session end: 2026-05-29 (phase 1b agent panel + `/new` inheritance implemented in worktree)**

- Implemented `apps/web/src/core-agent/AgentPanel.tsx` and `apps/web/src/core-agent/useCoreAgents.ts`. The panel is mounted in the right sidebar Context tab, lists scoped agents, highlights the active agent, switches active agents, and creates preset-backed agents through the `coreAgents.*` WebSocket/native API surface.
- Added `NativeApi.coreAgents` contract and web WS bindings for `list`, `create`, `update`, `delete`, and `setActive`.
- Implemented `apps/web/src/core-agent/newAgentThread.ts` and wired the existing composer `/new` handler to create a project-scoped inherited agent, set it active, and then open the new draft thread without sending a provider turn.
- Verification:
  - `cd apps/web && bun run test src/core-agent/AgentPanel.test.tsx src/core-agent/newAgentThread.test.ts` passes.
  - `cd apps/web && bun run test` passes.
  - `cd apps/web && bun run typecheck` passes.
  - `cd packages/contracts && bun run test` passes.
  - `cd packages/contracts && bun run typecheck` passes.
  - Root `bun run fmt` passes.
  - Root `bun run lint` exits 0 with pre-existing warnings only.
  - Root `bun run typecheck` remains blocked by pre-existing `apps/server` orchestration/test errors unrelated to this work (`OrchestrationEngineHarness.integration.ts`, `ContextTrimmerLive.test.ts`, `EvaluatorServiceLive.ts`).
- Commits for these tasks could not be created because `.git` is not writable in this environment (`Operation not permitted` creating `.git/index.lock`).
- Next task: continue Phase 1B docs/finalization once server typecheck blockers and git permissions are resolved.

**Session end: 2026-05-29 (phase 1b tasks 5-6 implemented in worktree)**

- Implemented agent-aware `CoreMemoryService` access with validated optional `agentId`, active-agent resolution from project/global `active-agent.json`, global memory resolution under `{stateDir}/agents/{agentId}/memory`, preserved default-agent fallback behavior, and project memory retained at `{projectRoot}/.rowl/memory` per the two-tier model.
- Added `CoreAgentEvents.ts` to publish `coreAgent.activeChanged` through the existing WS push bus, and wired `coreAgents.setActive` through that publisher. The other core-agent WS routes now delegate thinly to `CoreAgentService`.
- Verification:
  - `cd apps/server && bun run test src/core-agent/` passes.
  - `cd apps/server && bun run test src/core-agent/CoreAgentEvents.test.ts src/memory/Layers/CoreMemoryAgent.test.ts src/memory/Layers/CoreMemoryLive.test.ts src/memory/paths.test.ts` passes.
  - Root `bun run fmt` passes.
  - Root `bun run lint` exits 0 with existing warnings.
  - `cd apps/server && bun run typecheck` remains blocked by pre-existing orchestration/test errors unrelated to tasks 5-6.
  - `cd apps/server && bun run test src/orchestration/Layers/ProviderCommandReactor.test.ts` has 25 passing tests and one repeated session-status assertion failure (`clears a prior session error when a new turn starts successfully`, expected `running`, received `error`).
  - `cd apps/server && bun run test src/wsServer.test.ts` is blocked in this sandbox by `listen EPERM 0.0.0.0` plus `EMFILE` watcher errors.
- Commits for tasks 5 and 6 could not be created because `.git` is not writable in this environment (`Operation not permitted` creating `.git/index.lock`).
- Next task: Phase 1B Task 7, route active-agent identity through provider turns and memory write paths.

**Session end: 2026-05-29 (phase 1b tasks 3-4 implemented in worktree)**

- Implemented built-in personality presets (`default`, `concise`, `planner`, `reviewer`, `implementer`) and preset-to-editable-metadata materialization.
- Implemented `CoreAgentService` with injected store/clock/id generator, CRUD, active-agent resolution, preset creation, stable active-change payloads, and same-agent update serialization.
- Verification:
  - `cd apps/server && bun run test src/core-agent/` passes.
  - `cd packages/contracts && bun run test src/core-agent.test.ts` passes.
  - `bun run fmt` passes.
  - `bun run lint` exits 0 with existing warnings.
  - `bun run typecheck` remains blocked by pre-existing orchestration/type errors unrelated to core-agent work.
- Commits for tasks 3 and 4 could not be created because `.git` is not writable in this environment (`Operation not permitted` creating `.git/index.lock`).
- Next task: Phase 1B Task 5, agent-aware `CoreMemoryService`.

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

### Phase 1a — Core memory substrate (shipped 2026-04-17)

**What went well:**

- Boring-by-design filesystem layer made unit testing trivial; all 35 memory unit tests run in <2s with no mocks.
- TDD discipline (write failing test → verify fail → implement → verify pass → commit) per task caught a few off-by-one issues early (e.g., `.md`-filter in `listBlocksInDir` after git repo init).
- Reusing existing file-edit tools for agent self-editing was the right call — the scope adjustment away from a dedicated `memory` tool dropped ~5 tasks of adapter-plumbing work without losing functionality for 1a.

**What was painful:**

- Effect-TS layer composition caught us twice: `coreMemoryLayer` depended on `ServerConfig` but sat inside `Layer.mergeAll`, so peer layers couldn't resolve it until we moved it into `provideMerge` post-merge (same pattern already used for `gitCoreLayer`). Worth documenting in AGENTS.md for future layer work.
- Integration harness (`OrchestrationEngineHarness.integration.ts`) needed a hand-written stub for every new service we added to the reactor. Friction scales with reactor deps.

**Notes for future phases:**

- Dedicated memory tool still owed. Before phase 1b starts, either research a cross-provider tool layer or commit to per-adapter implementations. The current `/remember` slash command is a user-facing UX stand-in, not a substitute for first-class agent tool calls.
- The post-turn git commit hook is best-effort (fires right after `providerService.sendTurn`). If a cleaner "turn-complete" event is added to the orchestration engine, re-wire this to run on actual turn completion rather than turn-kick-off.
- Memory preamble assembly is provider-agnostic — any new provider adapter gets `<agent_memory>` for free via `applyThreadTurnContext`.

Each phase, on ship:

1. Add entry to "Retro log" below: what went well, what was painful, what future phases should know.
2. Update phase status tracker above.
3. Update `plans/STATE.md` at the plans root.
4. Tag the commit (e.g., `v-phase-1a`).
