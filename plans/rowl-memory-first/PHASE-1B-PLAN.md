# Rowl Memory-First Phase 1B Plan

Date: 2026-05-29

Phase 1B turns Phase 1A's memory substrate into a user-visible multi-agent system. Work stays TDD-first: every task starts with the smallest failing test that proves the contract, then implements only enough production code to pass, then runs focused checks before commit.

## Ground Rules

- Keep `packages/contracts` schema-only.
- Keep `packages/shared` runtime helpers behind explicit subpath exports.
- Preserve provider-native runtime behavior; agent identity is Rowl context layered around providers, not a provider wrapper.
- Project memory remains git-backed and commit-per-change.
- Agent memory remains global-per-agent and git-backed.
- Do not let agent metadata persistence depend on React or provider code.
- Update docs in the same commit as user-visible behavior.

## Verification Cadence

For each task:

1. Write or extend the test first.
2. Run the focused command and verify it fails for the expected reason.
3. Implement the production change.
4. Run the focused command and verify it passes.
5. Run the relevant package checks if the touched surface is shared.
6. Commit with the task number in the subject.

Before the final tag:

```sh
bun run fmt
bun run lint
bun run typecheck
bun run test
```

## Tasks

### 1. Shared Core-Agent Contracts

Goal: define the shared data model for core agents so server, web, and future providers agree on IDs, scope, metadata, and WebSocket payloads.

- Write tests:
  - Add schema round-trip tests in `packages/contracts/src/core-agent.test.ts:1`.
  - Extend WebSocket contract tests in `packages/contracts/src/ws.test.ts:1`.
  - Cover valid global agents, project agents, preset-backed agents, custom agents, active-agent updates, list responses, create requests, update requests, delete requests, and validation failures.
- Verify fail:
  - Run `bun run test packages/contracts/src/core-agent.test.ts packages/contracts/src/ws.test.ts`.
  - Expected failure: missing `CoreAgent*` schemas and missing WebSocket message variants.
- Implement:
  - Add schema-only types in `packages/contracts/src/core-agent.ts:1`.
  - Export them through existing explicit contract exports in `packages/contracts/src/index.ts:1`.
  - Add WebSocket request/response/event variants in `packages/contracts/src/ws.ts:1`.
  - Keep the contract names provider-neutral: `CoreAgent`, `CoreAgentScope`, `CoreAgentPersonality`, `CoreAgentMetadata`, `CoreAgentListResponse`, `CoreAgentCreateRequest`, `CoreAgentUpdateRequest`, `CoreAgentDeleteRequest`, `CoreAgentSetActiveRequest`.
- Verify pass:
  - Re-run the focused contract tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 1 add core agent contracts"`

### 2. Agent Metadata File IO

Goal: add deterministic file IO for agent metadata under global and project memory roots, separate from provider runtime concerns.

- Write tests:
  - Add server unit tests in `apps/server/src/core-agent/agentMetadataStore.test.ts:1`.
  - Cover first-run directory creation, atomic writes, corrupted JSON quarantine or typed error behavior, stable sorting, global path resolution at `~/.t3/rowl/agents/{agentId}/metadata.json`, and project path resolution at `{projectRoot}/.rowl/agents/{agentId}/metadata.json`.
  - Cover gitignored project agent metadata location assumptions without committing project-local data.
- Verify fail:
  - Run `bun run test apps/server/src/core-agent/agentMetadataStore.test.ts`.
  - Expected failure: metadata store module does not exist.
- Implement:
  - Add `apps/server/src/core-agent/agentMetadataStore.ts:1`.
  - Use existing server filesystem helpers where available from `apps/server/src/*:1`; otherwise keep a small module-local adapter with injected `fs`.
  - Use Effect Schema decoding from `packages/contracts/src/core-agent.ts:1`.
  - Keep write behavior deterministic with pretty JSON, trailing newline, and temp-file-then-rename.
- Verify pass:
  - Re-run the focused store tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 2 add core agent metadata store"`

### 3. Personality Presets

Goal: ship built-in personality presets that can seed new agents while preserving user-editable metadata.

- Write tests:
  - Add tests in `apps/server/src/core-agent/personalityPresets.test.ts:1`.
  - Cover preset IDs, display names, descriptions, default instruction blocks, immutability of preset definitions, and materializing a preset into editable agent metadata.
  - Add contract validation coverage in `packages/contracts/src/core-agent.test.ts:1` for preset-backed metadata.
- Verify fail:
  - Run `bun run test apps/server/src/core-agent/personalityPresets.test.ts packages/contracts/src/core-agent.test.ts`.
  - Expected failure: preset catalog and materializer are absent.
- Implement:
  - Add `apps/server/src/core-agent/personalityPresets.ts:1`.
  - Add preset metadata fields to `packages/contracts/src/core-agent.ts:1` only if the task 1 schema does not already cover them.
  - Include conservative initial presets: default, concise, planner, reviewer, and implementer.
- Verify pass:
  - Re-run focused tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 3 add core agent personality presets"`

### 4. CoreAgentService

Goal: centralize agent CRUD, active-agent resolution, preset creation, and metadata persistence behind one server service.

- Write tests:
  - Add tests in `apps/server/src/core-agent/CoreAgentService.test.ts:1`.
  - Cover list by scope, create from preset, create custom, update name/personality/instructions, delete inactive agent, reject deleting active agent without replacement, set active global agent, set active project agent, fallback to default agent, and stable event payloads.
  - Add concurrency tests for two updates to the same agent ID.
- Verify fail:
  - Run `bun run test apps/server/src/core-agent/CoreAgentService.test.ts`.
  - Expected failure: service module does not exist.
- Implement:
  - Add `apps/server/src/core-agent/CoreAgentService.ts:1`.
  - Compose `agentMetadataStore` from `apps/server/src/core-agent/agentMetadataStore.ts:1`.
  - Compose presets from `apps/server/src/core-agent/personalityPresets.ts:1`.
  - Keep service pure enough for tests through injected clock, ID generator, project root resolver, and store.
- Verify pass:
  - Re-run focused service tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 4 add core agent service"`

### 5. Agent-Aware CoreMemoryService

Goal: teach memory reads and writes about agent identity without weakening Phase 1A's memory directory and git guarantees.

- Write tests:
  - Extend memory tests in `apps/server/src/memory/CoreMemoryService.test.ts:1`.
  - Cover resolving global agent memory by active `agentId`, resolving project memory by project-root plus active project agent, preserving existing default memory behavior, rejecting path traversal agent IDs, and committing metadata/memory changes to the correct memory repo.
- Verify fail:
  - Run `bun run test apps/server/src/memory/CoreMemoryService.test.ts`.
  - Expected failure: `CoreMemoryService` accepts no agent identity and always resolves the Phase 1A default path.
- Implement:
  - Update `apps/server/src/memory/CoreMemoryService.ts:1` to accept an optional `coreAgentId` or `CoreAgentContext`.
  - Keep repo initialization and commit behavior in the existing memory service path, not duplicated in agent code.
  - Update call sites that construct the service in `apps/server/src/provider/Layers/ProviderService.ts:1` and `apps/server/src/wsServer.ts:1`.
- Verify pass:
  - Re-run focused memory tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 5 make core memory agent aware"`

### 6. Agent Identity In Memory Preamble

Goal: inject active agent identity and editable personality into the memory preamble that providers receive.

- Write tests:
  - Extend turn-context tests in `apps/server/src/provider/applyThreadTurnContext.test.ts:1`.
  - Cover preamble content for default global agent, custom global agent, project agent, renamed agent, no memory files, and user-edited personality text.
  - Assert provider prompts do not include private metadata fields such as filesystem paths.
- Verify fail:
  - Run `bun run test apps/server/src/provider/applyThreadTurnContext.test.ts`.
  - Expected failure: memory preamble lacks agent identity/personality sections.
- Implement:
  - Update `apps/server/src/provider/applyThreadTurnContext.ts:1`.
  - Add a small formatter helper in `apps/server/src/core-agent/agentPreamble.ts:1` if formatting grows beyond a few lines.
  - Keep provider event shapes unchanged.
- Verify pass:
  - Re-run focused turn-context tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 6 include agent identity in memory preamble"`

### 7. Active-Agent Turn Injection And Memory Commits

Goal: ensure every provider turn uses the currently selected agent and that `/remember` commits land in that agent's memory repo.

- Write tests:
  - Add integration tests in `apps/server/src/provider/activeAgentTurnContext.test.ts:1`.
  - Extend slash-command or memory command tests in `apps/server/src/memory/rememberCommand.test.ts:1`.
  - Cover switching active agent before a turn, switching back, concurrent sessions with different active agents, `/remember` global memory commit, `/remember` project memory commit, and commit author/message content including the agent ID.
- Verify fail:
  - Run `bun run test apps/server/src/provider/activeAgentTurnContext.test.ts apps/server/src/memory/rememberCommand.test.ts`.
  - Expected failure: active-agent state is not threaded into provider turn context or memory commits.
- Implement:
  - Wire `CoreAgentService` into `apps/server/src/provider/Layers/ProviderService.ts:1`.
  - Pass active agent context into `apps/server/src/provider/applyThreadTurnContext.ts:1`.
  - Pass the same context into memory write paths in `apps/server/src/memory/CoreMemoryService.ts:1`.
  - Keep provider managers such as `apps/server/src/codexAppServerManager.ts:1`, `apps/server/src/copilotAcpManager.ts:1`, and `apps/server/src/opencodeAcpManager.ts:1` unaware of core-agent persistence.
- Verify pass:
  - Re-run focused integration tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 7 route turns through active core agent"`

### 8. Core-Agent WebSocket Routes

Goal: expose core-agent list/create/update/delete/set-active operations over the existing WebSocket protocol.

- Write tests:
  - Extend WebSocket server tests in `apps/server/src/wsServer.test.ts:1`.
  - Cover auth-required requests, list global/project agents, create from preset, create custom, update metadata, delete inactive agent, reject invalid payloads, set active agent, and broadcast active-agent changes to subscribed clients.
  - Extend contract tests in `packages/contracts/src/ws.test.ts:1` for request and event payload decoding.
- Verify fail:
  - Run `bun run test apps/server/src/wsServer.test.ts packages/contracts/src/ws.test.ts`.
  - Expected failure: WebSocket handlers do not recognize core-agent methods.
- Implement:
  - Add handlers in `apps/server/src/wsServer.ts:1`.
  - Keep routing thin by delegating to `apps/server/src/core-agent/CoreAgentService.ts:1`.
  - Add any shared request constants to `packages/contracts/src/ws.ts:1`.
- Verify pass:
  - Re-run focused WebSocket tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 8 add core agent websocket routes"`

### 9. Slash Command Parsing

Goal: parse agent-related slash commands consistently before UI/server mutation work.

- Write tests:
  - Add parser tests in `apps/web/src/slashCommands.test.ts:1`.
  - Cover `/agent`, `/agent list`, `/agent use <name-or-id>`, `/agent new`, `/agent edit`, `/agent delete`, `/new`, quoted names, whitespace, unknown subcommands, and preservation of existing `/remember` behavior.
  - Add server-side parser tests in `apps/server/src/slashCommands.test.ts:1` only if the server owns any slash parsing after Phase 1A.
- Verify fail:
  - Run `bun run test apps/web/src/slashCommands.test.ts apps/server/src/slashCommands.test.ts`.
  - Expected failure: agent slash commands are unrecognized.
- Implement:
  - Update `apps/web/src/slashCommands.ts:1`.
  - Update shared slash-command types in `packages/contracts/src/core-agent.ts:1` or `packages/contracts/src/ws.ts:1` only when payloads cross the WebSocket boundary.
  - Avoid duplicating parsing logic between server and web; extract to `packages/shared/src/slashCommands.ts:1` if both runtimes need it.
- Verify pass:
  - Re-run focused parser tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 9 parse core agent slash commands"`

### 10. Selector And Manager UI

Goal: add visible controls to select, create, edit, and remove agents while matching the current Rowl UI patterns.

- Write tests:
  - Add React tests in `apps/web/src/components/CoreAgentSelector.test.tsx:1`.
  - Add manager tests in `apps/web/src/components/CoreAgentManager.test.tsx:1`.
  - Cover loading state, empty state with default agent, active agent label, switching agents, create-from-preset form, custom agent form, editing name/personality/instructions, deleting inactive agents, blocking active-agent deletion, keyboard navigation, and error display.
- Verify fail:
  - Run `bun run test apps/web/src/components/CoreAgentSelector.test.tsx apps/web/src/components/CoreAgentManager.test.tsx`.
  - Expected failure: UI components do not exist.
- Implement:
  - Add `apps/web/src/components/CoreAgentSelector.tsx:1`.
  - Add `apps/web/src/components/CoreAgentManager.tsx:1`.
  - Add agent WebSocket client helpers near the existing session WebSocket client in `apps/web/src/*:1`.
  - Mount the selector in the existing session chrome or composer-adjacent control at `apps/web/src/App.tsx:1`, using the current layout system instead of a standalone landing page.
- Verify pass:
  - Re-run focused component tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 10 add core agent selector ui"`

### 11. Slash Command UI Mutations

Goal: make slash commands drive the same agent mutations as the visible UI, with optimistic feedback and typed failures.

- Write tests:
  - Extend composer tests in `apps/web/src/components/Composer.test.tsx:1`.
  - Add command integration tests in `apps/web/src/slashCommandMutations.test.tsx:1`.
  - Cover `/agent use`, `/agent list`, `/agent new`, `/agent edit`, `/agent delete`, `/new`, command result rendering, WebSocket failure display, and no provider turn being sent for handled local mutations.
- Verify fail:
  - Run `bun run test apps/web/src/components/Composer.test.tsx apps/web/src/slashCommandMutations.test.tsx`.
  - Expected failure: parsed agent commands do not mutate UI state or call WebSocket routes.
- Implement:
  - Update composer command handling in `apps/web/src/components/Composer.tsx:1`.
  - Add mutation orchestration in `apps/web/src/coreAgentMutations.ts:1` or the existing session store at `apps/web/src/session-logic.ts:1` if that is the established pattern.
  - Reuse the selector/manager WebSocket client from task 10.
- Verify pass:
  - Re-run focused UI mutation tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 11 wire core agent slash mutations"`

### 12. `/new` Project-Agent Inheritance

Goal: make `/new` create a project-scoped agent that inherits the current agent's personality while giving the new session/project its own memory path.

- Write tests:
  - Add tests in `apps/server/src/core-agent/projectAgentInheritance.test.ts:1`.
  - Extend `/new` flow tests in `apps/web/src/slashCommandMutations.test.tsx:1`.
  - Cover inheritance from global agent to project agent, inheritance from project agent to sibling project agent, generated name uniqueness, memory path isolation, active-agent switch after `/new`, and preservation of the parent agent's global memory.
- Verify fail:
  - Run `bun run test apps/server/src/core-agent/projectAgentInheritance.test.ts apps/web/src/slashCommandMutations.test.tsx`.
  - Expected failure: `/new` starts sessions without project-agent creation/inheritance.
- Implement:
  - Add inheritance helper in `apps/server/src/core-agent/CoreAgentService.ts:1` or `apps/server/src/core-agent/projectAgentInheritance.ts:1`.
  - Wire `/new` server route handling in `apps/server/src/wsServer.ts:1`.
  - Wire `/new` UI mutation in `apps/web/src/coreAgentMutations.ts:1` and composer handling in `apps/web/src/components/Composer.tsx:1`.
- Verify pass:
  - Re-run focused inheritance tests.
  - Run `bun run typecheck`.
- Commit:
  - `git commit -m "task 12 inherit project agents on new sessions"`

### 13. Docs And State Updates

Goal: keep user-facing and developer-facing docs aligned with the new core-agent behavior.

- Write tests:
  - Add or extend docs smoke checks in `apps/server/src/docsLinks.test.ts:1` or the existing docs validation file at `docs/*:1` if present.
  - Add provider availability or onboarding copy tests in `apps/web/src/session-logic.test.ts:1` only if copy changes touch provider claims.
  - Cover docs references to agent memory paths, slash commands, UI selector behavior, `/new` inheritance, and git-backed memory commits.
- Verify fail:
  - Run the focused docs/copy tests.
  - Expected failure: docs do not mention Phase 1B core-agent behavior.
- Implement:
  - Update `README.md:1`.
  - Update `CONTRIBUTING.md:1` if developer workflow changes.
  - Update relevant guides under `docs/:1` or `.docs/:1`.
  - Update `plans/rowl-memory-first/STATUS.md:1`.
  - Update `plans/STATE.md:1` with the current handoff and any locked decisions.
  - Update `AGENTS.md:1` only if the implementation exposes a repeatable workflow correction.
- Verify pass:
  - Re-run focused docs/copy tests.
  - Run `bun run fmt`.
- Commit:
  - `git commit -m "task 13 document core agent phase 1b"`

### 14. Final Verification And Tag

Goal: prove the whole Phase 1B slice is clean, then tag the implementation point for future sessions.

- Write tests:
  - No new feature tests in this task unless final verification exposes a gap.
  - Add regression tests at the closest failing surface if any bug is found during full-suite verification.
- Verify fail:
  - If a regression is found, first add the failing test in the relevant file named by the failing behavior, such as `apps/server/src/core-agent/CoreAgentService.test.ts:1`, `apps/server/src/memory/CoreMemoryService.test.ts:1`, or `apps/web/src/components/CoreAgentSelector.test.tsx:1`.
- Implement:
  - Fix only the verified regression.
  - Avoid unrelated cleanup.
- Verify pass:
  - Run `bun run fmt`.
  - Run `bun run lint`.
  - Run `bun run typecheck`.
  - Run `bun run test`.
  - For user-visible UI changes, start the dev server with the established Rowl command and verify the selector, manager, slash commands, and `/new` inheritance in browser.
- Tag:
  - Confirm a clean worktree with `git status --short`.
  - Create an annotated tag: `git tag -a rowl-memory-first-phase-1b -m "Rowl memory-first phase 1b"`.
  - Push only if that is part of the release/session request.
- Commit:
  - If final fixes were needed, `git commit -m "task 14 finalize core agent phase 1b"`.
  - If no fixes were needed, no extra commit is required before the tag.
