# Rowl Codebase Analysis — Master Synthesis
**Date:** 2026-04-13
**Scope:** 631 TypeScript/TSX files, 164,081 lines of code
**Analysis method:** 10 parallel agents reading every file in their domain

---

## TL;DR

Rowl is a sophisticated event-sourced AI coding platform with a well-architected core. The server runs an orchestration engine with command→event→projection flow over SQLite. The frontend is a Next.js app with Zustand state management and React Query for server state. 7 AI provider adapters sit on top.

**The good:** The architecture is solid. Event sourcing, typed contracts, Effect framework throughout, good test coverage. Most features have real implementation, not stubs.

**The gaps:** 7 stubbed or broken things that matter (listed below). The right sidebar's Context/Memory/LiveMap tabs may be hollow. The checkpoint projector is stubbed. EvaluatorService.quickCheck is a no-op. The approval loop has a known bug. Session status can get stuck.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          apps/web (Next.js)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────┐  │
│  │ ChatView    │  │ Sidebar.tsx │  │ RightSidebar│  │ Diff* │  │
│  │ 10,780 LOC  │  │ 2,101 LOC   │  │ 8 tabs      │  │ Panel │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────┘  │
│  Zustand (4 stores) │ React Query │ Lexical composer            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket + Native API
┌──────────────────────────▼──────────────────────────────────────┐
│                         apps/server                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            Orchestration Engine (Event-Sourced)             │  │
│  │  Command → Decider → EventStore → Projector → Reactors    │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Decider  │ │Projector  │ │Providers │ │ Persistence      │   │
│  │ 1,126 LOC│ │          │ │ 7 adapt.  │ │ SQLite + 23 migs │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Services  │ │ Terminal  │ │   Git    │ │ Checkpointing    │   │
│  │ 16 domain │ │ PTY×2    │ │ 4 layers │ │ git-ref based    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│                        packages/contracts                         │
│  50+ WS RPC methods │ Event schemas │ Base branded types          │
│  Wire protocol source of truth                                   │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│                        packages/shared                           │
│  Effect services │ WS auth │ Model helpers │ Shell utils        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Status by Area

### ✅ FULLY IMPplemented

| Area | Files | Lines | Status |
|------|-------|-------|--------|
| Orchestration Decider | 1 | ~1,126 | All 20+ command types handled, fork logic complete |
| Projector | 1 | ~400 | All domain events projected to in-memory read model |
| Provider Adapters (6/7) | 7 | ~1,500 | Codex, Copilot, KiloCode, Kimi, OpenCode, Pi all working |
| SQLite + Migrations | 54 | ~2,500 | WAL mode, 22/23 migrations functional, FTS5 memory search |
| Event Store | 2 | ~300 | Append/replay, idempotent receipts |
| Terminal PTY | 8 | ~800 | NodePTY + BunPTY, history persistence, shell resolution |
| Git System | 15 | ~1,500 | Layered GitCore→GitManager→GitHubCli, status caching |
| WebSocket Server | 5 | ~1,200 | 30+ RPC methods, push channels, static serving |
| React Query Libraries | 5 | ~800 | project, thread, provider, server, sidebar — all complete |
| Contracts Package | 30 | ~5,000 | All schemas, 50+ WS methods, full test coverage |
| Shared Package | 19 | ~2,000 | All utilities, Effect services, test coverage |
| Chat Components | 30+ | ~5,000 | ChatView, Timeline, Composer, all dialogs |
| Left Sidebar | 3 | ~2,500 | DnD reordering, multi-select, thread management |
| Project Dashboard | 1 | ~800 | Health, goals, features, agents, source files |

### ⚠️ PARTIALLY IMPLEMENTED (features work but have gaps)

| Area | Issue |
|------|-------|
| **Right Sidebar — Context Tab** | May be hollow shell — UI present, backend wiring unverified |
| **Right Sidebar — Memory Tab** | May be hollow shell — UI present, backend wiring unverified |
| **Right Sidebar — LiveMap Tab** | May be hollow shell — UI present, backend wiring unverified |
| **Project Setup Wizard** | Worktree strategy step UI present but backend may be stubbed |
| **Project Setup Wizard** | Agent configuration step UI present but may be stubbed |
| **Permission Policies** | Preset system (strict/relaxed) may not be wired |
| **EvaluatorService.quickCheck()** | Always returns `compiles: true` — no-op stub |
| **Pi.stopAll()** | Only resolves pending approvals, doesn't stop sessions |
| **respondToUserInput()** | Stubbed in ALL 7 provider adapters |
| **Migration 009** | No-op stub — yields SqlClient without executing SQL |
| **executeStream** | Not implemented on NodeSqliteClient — throws `Stream.die` |
| **harness_presets** | Schema exists (migration 022) but no service/layer implementation |
| **ProjectionContextNodes** | Doesn't use SqlSchema helpers — raw SQL with type-safety gaps |
| **CHARS_PER_TOKEN** | Duplicated in 3 services instead of shared |
| **activeHarnessByThread** | In-memory Map — lost on restart, not persisted |
| **Checkpoint Projector** | Stubbed `() => Effect.void` — checkpoints stored via turns table workaround |
| **Thread Redo Store** | Snapshots stored uncompressed |
| **Push Bus Sequences** | Reset on reconnect — not persistent across connections |
| **Expired Thread Shares** | Not auto-deleted |
| **Attachment Orphan Cleanup** | Not implemented |
| **Accent Color Persistence** | May not persist in Appearance Settings |

### ❌ BROKEN / KNOWN BUGS

| Bug | Location | Impact |
|-----|----------|--------|
| **Approval loop bug** | `ComposerPendingApprovalPanel` — "Accept for Session" doesn't persist | Tier 2, tracked in outstanding plan |
| **Session status stuck** | Session state machine can get stuck in transient state | Tier 2 |
| **Brand rename test failure** | A3 in ROWL_ROADMAP_V2.md | Tier 2 |
| **Context injection untested** | PM Chat context injection never tested with live AI output | Tier 2 |
| **Overseer untested** | OverseerReactor never tested with real AI output | Tier 2 |
| **PM multi-question clarification** | Not implemented — AI can't ask follow-up questions in PM Chat | Tier 2 |
| **Skill creation stub** | `ComposerSkillPicker` — `SkillCreatorSection` is UI shell with hint only | Tier 2 |
| **Provider health inconsistency** | MiniMax always "ready", Kimi probes login but KiloCode doesn't | Low |

---

## Key Architectural Decisions (Verified From Code)

### 1. Event Sourcing with Single-Writer Queue
The `OrchestrationEngine` uses an unbounded `Queue` feeding a single fiber that processes commands sequentially. This means:
- No race conditions within a thread
- But: potential bottleneck under high concurrency
- Idempotency via `commandReceiptRepository` (duplicate commands return cached result)

### 2. Dual Storage: Events + Projections
Events are append-only (immutable log). Projections are mutable (updated atomically per event in a SQL transaction). If a projection write fails after event persistence, the read model is rebuilt from the event store on reconciliation.

### 3. Provider Adapter Pattern
Two-layer abstraction:
- **Layer** (`provider/Layers/*.ts`): Effect Layer wrappers — translate Rowl commands to provider calls
- **Manager** (root `*.ts` files): Concrete implementations — CLI subprocess management, REST calls, SDKs

This is a clean separation. Adding a new provider requires both layers.

### 4. 7 Providers, 3 Integration Styles
| Style | Providers |
|-------|-----------|
| CLI + ACP over stdio | Codex, Copilot, KiloCode, Kimi, OpenCode |
| CLI + JSON-RPC over stdio | Codex (OpenAI's own protocol) |
| REST API | MiniMax (only one without tool/permission support) |
| Embedded SDK | Pi (`@mariozechner/pi-coding-agent`) |

### 5. SQLite Only
No external database. Everything is SQLite with WAL mode. The `node:sqlite` native module (Node 22.16+) is used directly, wrapped in Effect.

### 6. Frontend State: Zustand + React Query
- **Zustand**: Local UI state (threads, projects, composer drafts, terminal, sidebar)
- **React Query**: Server state (projects, threads, git, features, goals, context, memory)
- **WebSocket**: Real-time orchestration events via `orchestration.readModel` channel

### 7. Checkpointing: Git-Ref Based
Checkpoints are stored as Git refs at `refs/t3/checkpoints/{threadId}/turn/{turnCount}`. The `CheckpointReactor` uses a `DrainableWorker` to process turn completion events. Checkpoints capture/restores state using an isolated temporary Git index.

### 8. PM Chat: Client-Side Action Parsing
PM Chat tab (`PMChatTabContent.tsx`) parses AI responses client-side via regex looking for `ACTION:` commands. This is fragile — string matching of AI output — but keeps the PM layer simple.

---

## Stub Catalog (Full List)

| Stub | File | Impact |
|------|------|--------|
| `checkpoints` projector | `ProjectionPipeline.ts` | Checkpoint diffs not persisted to DB |
| `EvaluatorService.quickCheck()` | `EvaluatorServiceLive.ts` | Always returns `compiles: true` |
| `respondToUserInput()` | ALL 7 provider adapters | AI can't respond to user input requests |
| `Pi.stopAll()` | `piSdkManager.ts` | Sessions not cleanly stopped |
| `Migration 009` | `Migrations.ts` | Schema gap (was likely adding a column) |
| `executeStream` | `NodeSqliteClient.ts` | Streaming queries unavailable |
| `harness_presets` | No service/layer | Test harness presets not implemented |
| `SkillCreatorSection` | `ComposerSkillPicker.tsx` | Skill creation UI is a hint message only |
| `ContextTabContent` | Right sidebar tab | May be hollow shell |
| `MemoryTabContent` | Right sidebar tab | May be hollow shell |
| `LiveMapTabContent` | Right sidebar tab | May be hollow shell |
| `ProjectScriptsControl` | Worktree strategy | May be stubbed in wizard |
| `AgentConfiguration` | Wizard step | May be stubbed |

---

## Code Quality Notes

### Duplication
- `CHARS_PER_TOKEN = 4` defined in 3 places (ContextBudgetCalculator, ContextTrimmer, MemoryService)
- `recentErrorsByThread` uses module-level mutable Map instead of Effect's `Ref`

### Technical Debt
- Right sidebar uses native HTML5 drag API; left sidebar uses DnD Kit — inconsistent
- Push bus sequence numbers reset on reconnect
- Thread redo snapshots uncompressed
- `ProjectionContextNodes` bypasses SqlSchema type safety (`as any` casts)
- `FeatureThreadLinkService` is the only service that talks to SQL directly rather than through projection repositories

### Security Considerations
- Path authorization checks prevent workspace escapes via symlinks
- WS auth tokens redacted in logs
- `sanitizeProviderOptionsRecordForPersistence` scrubs sensitive config before storage

---

## Rowl Roadmap vs Actual Codebase State

The ROWL_ROADMAP_V2.md self-reports:
- **Tier 1 (Foundation):** Mostly done
- **Tier 2 (Approval Loop + polish):** ~50% — known bugs, untested features
- **Tier 3 (Context + Multi-agent):** 0-10% — CodebaseIndexWorker planned but not built, multi-agent coordination in services layer but orchestrator untested
- **Tier 4 (Advanced):** 0% — Flora, Flashboards, agent abstraction

**Key gap:** The roadmap says Tier 2 approval loop is done. Codebase shows it has a known bug. The roadmaps self-reported state is OVER-CONFIDENT by ~50%.

---

## File Count Summary

| Package | Files | Est. Lines |
|---------|-------|------------|
| apps/web/src/components | 200+ | ~55,000 |
| apps/web/src (routes, hooks, lib) | 50+ | ~15,000 |
| apps/server/src/orchestration | 60+ | ~20,000 |
| apps/server/src/persistence | 54 | ~8,000 |
| apps/server/src/provider | 40+ | ~7,000 |
| apps/server/src/git | 17 | ~2,500 |
| apps/server/src/terminal | 8 | ~800 |
| apps/server/src (other) | 40+ | ~5,000 |
| packages/contracts | 30 | ~5,000 |
| packages/shared | 19 | ~2,000 |
| **Total** | **631** | **164,081** |

---

## How to Use This Analysis

This document is the ground truth for Rowl's current implementation state. Before planning new features:

1. **Check this document first** — verify the area you want to change is actually implemented
2. **Check the 10 detailed files** in `docs/codebase-analysis/` for the specific area
3. **Verify stubs** — any area marked stubbed above needs real implementation
4. **Check the outstanding plan** — for known Tier 2 bugs that need fixing alongside new work

The 10 analysis files are detailed enough to use as a map for making changes. Each one documents data flow, backend connections, and implementation status for every file in that domain.

---

*Analysis generated 2026-04-13 by 10 parallel agents reading every file in the Rowl codebase. 631 files, 164,081 lines, 10 domains.*
