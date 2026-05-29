# ROWL ROADMAP V2 — Comprehensive Product Roadmap

## Document purpose

This is the single source of truth for all Rowl product decisions. It replaces `docs/ROWL_ROADMAP.md` (V1). Every feature is evaluated through one lens: **"How does this help someone who does not write code build a product with AI?"**

**Execution layer:** Detailed implementation plans for each initiative live in `~/Dev/rowl/plans/` (see `plans/INDEX.md`).

Rowl is an agentic engineering control room. The AI agents are coding-first (extremely capable). The human experience is project-first. The user knows nothing about code. They know what they want to build. Rowl bridges that gap.

---

## Current state of the product (updated 2026-04-12)

### What ships today and works

**Core Platform:**

- 7 provider integrations: Codex, GitHub Copilot, KiloCode, Kimi Code, MiniMax, OpenCode, Pi
- Event-sourced orchestration engine with full decider/projector pipeline, SQLite persistence
- Git checkpointing: automatic snapshots before and after AI changes, rollback support
- Approval gating: allow/ask/deny policies per tool category (auto-accept in Full Access mode)
- Worktree isolation: git worktrees for safe parallel work
- Plan mode: structured first-draft review before execution
- Workspace instructions: AGENTS.md injection into every provider turn
- Thread sharing: export, import, share/unshare threads
- Undo/redo: full turn-level undo with redo stack
- Slash commands: built-in commands plus repo-local `.rowl/commands/*.md` templates
- Queue/Steer follow-ups during active turns
- Image attachments (up to 8 per message, 10MB each)
- Desktop app (Electron), cross-platform releases (macOS/Linux/Windows)
- Provider model picker with per-provider model selection

**Project Management Layer (Tier 1 — Complete):**

- Right Sidebar with 5 tabs: PM Chat, Threads, Features, Goals, Context
  - Responsive: inline mode (>1280px), overlay mode (1024-1279px), collapsed (<1024px)
- Threads Tab: project thread list with status indicators, click to switch, sorted by recency
- Goals Tab: full CRUD with main goal designation, inline editing, thread linking
- Features Board: kanban columns (Backlog, In Progress, Done, Wishlist), stage transitions, delete
- Context Tab: context node visualization with budget gauge, compress/restore/delete nodes
- PM Chat: real AI conversation with project-aware system prompt (brief, goals, features, active threads)
- Project Brief: markdown editor for `.rowl/project-brief.md`, integrated into Goals tab
- Skills: AI-powered skill generation (describe what you need, AI creates full SKILL.md)
- Feature-Turn Linking: composer dropdown to select which feature you're working on
- Smart Thread Titles: derived from feature name, thread goal, or message content

**AI Integration (Phase 1 — Wired, needs real-world testing):**

- Project context injection: brief, goals, features, and thread goal injected into every AI turn via `<project_context>` XML block in `applyThreadTurnContext()`
- Auto context node creation: OverseerReactor creates context nodes on turn completion
- Feature-turn linking: active feature name included in turn context

**Onboarding:**

- 3-step setup wizard after project creation: Brief, Goal, Features
- Default model inherits from most recent thread (not hardcoded Codex)
- Duplicate project prevention (normalized path comparison + projector dedup)

**Settings:**

- 3-tab interface: General, Providers, Advanced
- Collapsible accordion for each provider
- Unified custom model section with provider pills

### Feature status

| Feature                   | Status      | Usable?                 | Notes                                                                                 |
| ------------------------- | ----------- | ----------------------- | ------------------------------------------------------------------------------------- |
| Provider Integrations (7) | 100%        | Yes                     | All 7 providers with routing fixes                                                    |
| Settings Reorganization   | 100%        | Yes                     | 3-tab layout with provider accordions                                                 |
| Thread Goal Statement     | 100%        | Yes                     | Editable, injected into AI context                                                    |
| Right Sidebar             | 100%        | Yes                     | Responsive with 5 tabs + skills section                                               |
| Threads Tab               | Implemented | Needs user verification | Store-based, filters by project                                                       |
| Goals Tab                 | Implemented | Needs user verification | Full CRUD with persistence                                                            |
| Features Board            | Implemented | Needs user verification | Kanban with stage transitions                                                         |
| Context System            | Implemented | Needs user verification | Budget gauge, compress/restore                                                        |
| PM Chat                   | Implemented | Needs user verification | Real AI chat with project context                                                     |
| Project Brief             | Implemented | Needs user verification | File-based markdown editor                                                            |
| Skills AI Creation        | Implemented | Needs user verification | AI-powered generation                                                                 |
| Onboarding Wizard         | Implemented | Needs user verification | 3-step wizard after project creation                                                  |
| Project Context Injection | 90%         | Needs testing           | Wired but not verified with real AI                                                   |
| Auto Context Nodes        | 90%         | Needs testing           | OverseerReactor creates on turn.completed                                             |
| Feature-Turn Linking      | 90%         | Needs testing           | Composer picker + context injection                                                   |
| Smart Thread Titles       | 90%         | Needs testing           | Feature/goal-aware naming                                                             |
| Overseer/Guardian         | Partial     | Needs testing           | Scaffolded — patterns exist, untested with real AI output, confidence scoring missing |
| Review System             | Partial     | Needs testing           | Cards exist, approve/reject/rollback flow stubbed, needs E2E verification             |
| Project Dashboard         | Partial     | Needs polish            | Bird's-eye view exists, live status indicators pending                                |

### What needs work next

1. **Real-world testing:** Context injection, auto context nodes, feature linking, smart titles all need testing with actual AI conversations to verify they work end-to-end.
2. **Overseer verification:** Pattern matching exists but needs testing with real provider output.
3. **Review system completion:** Turn review cards exist but approve/reject flow needs end-to-end testing.

---

## Design principles

1. **Project-first, not code-first.** The user manages a product, not a codebase. Goals, Features Board, PM Chat, and Project Brief are the core product, not scope creep.

2. **Non-coder safety net.** The Overseer is critical because non-coders cannot evaluate whether an AI is stuck, looping, writing bad code, or asking the user to do something technical. The system must catch these automatically.

3. **Multi-provider is table stakes, not a moat.** Many tools support multiple AI providers. Rowl's moat is the project management layer on top: goals, features, context management, PM coordination, and eventually multi-medium creative agents.

4. **100% complete before moving on.** A feature is not done until backend is implemented, frontend is wired to real APIs, and it works for the user.

5. **Make what exists rock-solid before building new things.**

6. **The full arc.** Coding tool (today) -> product building platform (near-term) -> multi-medium creative workspace (future). Every decision must be compatible with this trajectory.

---

## Remaining gaps

### Gap 1: Provider session reliability

Each of the 7 provider integrations has different failure modes. When a provider session crashes, a non-coder has no ability to diagnose what happened. Every failure state must produce a non-technical error message. Automatic retry for transient failures.

### Gap 2: Checkpoint clarity

Git checkpointing works, but the UI for understanding and rolling back checkpoints needs clearer non-technical language.

### Gap 3: Multi-question clarification

The PM should proactively ask clarifying questions before coding starts. Infrastructure exists (`user-input.requested` events, `ComposerPendingUserInputPanel`), but PM doesn't yet trigger structured multi-question flows.

---

## Roadmap tiers (remaining work)

### TIER 2: Intelligence and Oversight (In Progress)

Most of Tier 2 is scaffolded. Remaining work is testing and hardening:

#### 2.1 Overseer Hardening ⚠️ PRIORITY

Background patterns exist in `OverseerReactor.ts`. **Needs:**

- Testing with real AI provider output (not mocked)
- False-positive tuning (reduce noise)
- Confidence scoring (severity levels for alerts)
- Learning loop for user dismissals

> **Status per codebase audit:** Scaffolded only — no real AI output testing performed yet.

#### 2.2 PM Multi-Question Clarification

PM should emit structured `user-input.requested` events to gather requirements before coding. Infrastructure exists (`ComposerPendingUserInputPanel`); needs behavioral integration.

> **Status per codebase audit:** Not implemented — PM cannot ask follow-up questions in structured flow.

#### 2.3 Context Compression (Real)

Current compression is a toggle (compressed/active). Needs: LLM-based summarization that actually reduces token count while preserving key information.

> **Status per codebase audit:** Budget display exists; compression is a toggle, not LLM-based summarization.

---

### TIER 3: Scaling and Orchestration

#### 3.1 Multi-Agent Session Coordination

Multiple provider sessions simultaneously within a project. Each agent on a different thread/task. Task graph defines dependencies.

**Start simple:** Two independent agents in separate worktrees. Add task-graph orchestration later.

> **Status per codebase audit:** Not started — design exists, no implementation.

#### 3.2 Agent Process Isolation and Recovery

Each agent session in isolated subprocess. Crash one, others continue. Auto-restart with state restoration.

> **Status per codebase audit:** Not started.

#### 3.3 Apply/Review System (Complete)

Structured review queue for AI-generated changes. Turn review cards exist. Needs end-to-end testing of the approve/reject/rollback flow.

> **Status per codebase audit:** Partial — cards exist, approve/reject/rollback flow not implemented.

#### 3.4 Visual Project Dashboard (Partial)

Dashboard component exists (`ProjectDashboard.tsx`). Shows project cards with goals, feature progress, thread counts. Needs polish and live agent status indicators.

> **Status per codebase audit:** Partial — screen exists, live status indicators not implemented.

#### 3.4 Visual Project Dashboard (Partial)

Dashboard component exists (`ProjectDashboard.tsx`). Shows project cards with goals, feature progress, thread counts. Needs polish and deeper integration.

#### 3.5 Codebase Intelligence System

Rowl needs to maintain a persistent, queryable model of project codebases. Background worker (CodebaseIndexWorker) keeps the PM's context updated. Hybrid pattern: persistent 5-min sync + event-based updates + PM-requested targeted re-scans.

**Pattern:** Cursor's custom embedding model trained on actual session traces (12.5% better than grep). Devin's eager indexing on repo add. PM+b coordination pattern: PM owns what, builders own how.

**Not in scope for this item:** Building the analysis tools used by humans to understand the Rowl codebase during development. This item covers the runtime index for PM coordination.

**Plan:** `~/Dev/rowl/plans/rowl-codebase-context/`

---

### TIER 4: Multi-Medium Creative Workspace

#### 4.1 Agent Type Abstraction

Refactor provider/agent layer so "agent" is not synonymous with "coding agent." Agents declare capabilities: can_code, can_generate_images, can_generate_video, can_write_documents.

#### 4.2 Flora Integration (Image Agents)

AI image generation as a first-class agent type.

#### 4.3 Flashboards Integration (Video/Canvas Agents)

AI video generation and visual canvas.

#### 4.4 Cross-Medium Context

Context flows between mediums. Image agent mockups become coding agent input.

---

### DEPRIORITIZED: Voice Input

Lowest priority. Revisit after Tier 3.

---

## Priority stack

| #   | Item                           | Tier | Status        |
| --- | ------------------------------ | ---- | ------------- |
| 1   | Provider session resilience    | 0    | Partial       |
| 2   | Checkpoint UX hardening        | 0    | Not started   |
| 3   | Context budget meter           | 0    | Done          |
| 4   | Settings reorganization        | 0    | Done          |
| 5   | Threads Tab                    | 1    | Done          |
| 6   | Goals Tab                      | 1    | Done          |
| 7   | Features Board                 | 1    | Done          |
| 8   | Project Brief                  | 1    | Done          |
| 9   | Skills AI Creation             | 1    | Done          |
| 10  | Context System (full)          | 2    | Done          |
| 11  | Overseer                       | 2    | Needs testing |
| 12  | PM Chat                        | 2    | Done          |
| 13  | Real-world integration testing | -    | Next          |
| 14  | Multi-Agent Coordination       | 3    | Not started   |
| 15  | Process Isolation              | 3    | Not started   |
| 16  | Apply/Review System            | 3    | Partial       |
| 17  | Visual Dashboard               | 3    | Partial       |
| 18  | Codebase Intelligence          | 3    | Not started   |
| 19  | Agent Type Abstraction         | 4    | Not started   |
| 20  | Flora (Image)                  | 4    | Not started   |
| 21  | Flashboards (Video)            | 4    | Not started   |

---

## Architectural patterns

1. **Contracts first.** Effect Schemas in `packages/contracts/src/`. No runtime logic.
2. **Service interface, then Layer implementation.** Services in `Services/`, Layers in `Layers/`.
3. **Persistence via projections.** New data -> new projection service + layer + migration.
4. **WebSocket wiring.** Methods in `ws.ts`, handlers in `wsServer.ts`.
5. **Event sourcing.** Significant state changes through decider/projector pipeline.
6. **Frontend reads via store/nativeApi.** Components read from store, dispatch via `readNativeApi()`.

---

_Version 2.2 — Updated 2026-04-13 to add Codebase Intelligence System (Tier 3, item 3.5)_
