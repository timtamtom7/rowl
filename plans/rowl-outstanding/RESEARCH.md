# Rowl Outstanding — Research

## Primary Sources

- `docs/ROWL_ROADMAP_V2.md` — single source of truth (229 lines)
- `docs/superpowers/specs/2026-04-13-comprehensive-build-plan.md` — detailed remaining work (161 lines)
- `docs/ROWL_VISION.md` — long-term vision arc

## Key Context from ROWL_ROADMAP_V2.md

### Current State (updated 2026-04-12)

**What ships today and works (Tier 1 complete):**
- 7 provider integrations (Codex, GitHub Copilot, KiloCode, Kimi Code, MiniMax, OpenCode, Pi)
- Event-sourced orchestration engine, SQLite persistence
- Git checkpointing with rollback
- Approval gating (allow/ask/deny per tool category)
- Worktree isolation
- Plan mode, workspace instructions, thread sharing, undo/redo
- Slash commands + repo-local `.rowl/commands/` templates
- Right sidebar with 5 tabs + Skills section
- Project Brief, Feature-Turn Linking, Smart Thread Titles
- Onboarding wizard, Settings reorganization

**Feature status table (from roadmap):**
- Provider Integrations: 100%, Yes
- Settings Reorganization: 100%, Yes
- Thread Goal Statement: 100%, Yes
- Right Sidebar: 100%, Yes (but needs deep improvements)
- Threads/Goals/Features/Context/PM Chat/Project Brief/Skills/Onboarding: Implemented, Needs user verification
- Project Context Injection/Auto Context Nodes/Feature-Turn Linking/Smart Thread Titles: 90%, Needs testing
- Overseer/Guardian: 70%, Needs testing
- Review System: 50%, Needs testing
- Project Dashboard: 50%, Partial

### Three Remaining Gaps

1. **Provider session reliability** — Non-coders can't diagnose failures. Every failure state needs non-technical error message + auto-retry.
2. **Checkpoint clarity** — Git checkpointing works but UI needs non-technical language.
3. **PM multi-question clarification** — Infrastructure exists (`user-input.requested` events, `ComposerPendingUserInputPanel`) but PM doesn't trigger structured multi-question flows.

### Tier 2 Status

> Most of Tier 2 is implemented. Remaining work:
> - Overseer Hardening: patterns exist, needs testing with real AI output, false-positive tuning, confidence scoring
> - PM Multi-Question Clarification: infrastructure exists, needs behavioral integration
> - Context Compression (Real): current is toggle, needs LLM-based summarization

### Tier 3 Status

> - Multi-Agent Coordination: start simple (two independent agents in separate worktrees), add task graph later
> - Agent Process Isolation: each agent in isolated subprocess, crash one → others continue, auto-restart
> - Apply/Review System: turn review cards exist, needs end-to-end testing
> - Visual Project Dashboard: component exists, needs polish + deeper integration

### Tier 4 Status

> - Agent Type Abstraction: refactor so agent ≠ coding agent; agents declare can_code, can_generate_images, can_generate_video, can_write_documents
> - Flora Integration: image generation as first-class agent type
> - Flashboards Integration: video generation and visual canvas
> - Cross-Medium Context: image mockups become coding agent input

### Priority Stack (from ROWL_ROADMAP_V2.md)

| # | Item | Tier | Status |
|---|---|---|---|
| 1 | Provider session resilience | 0 | Partial |
| 2 | Checkpoint UX hardening | 0 | Not started |
| 3 | Context budget meter | 0 | Done |
| 4 | Settings reorganization | 0 | Done |
| 5-10 | Threads/Goals/Features/Brief/Skills/Context | 1 | Done |
| 11 | Overseer | 2 | Needs testing |
| 12 | PM Chat | 2 | Done |
| 13 | Real-world integration testing | - | Next |
| 14 | Multi-Agent Coordination | 3 | Not started |
| 15 | Process Isolation | 3 | Not started |
| 16 | Apply/Review System | 3 | Partial |
| 17 | Visual Dashboard | 3 | Partial |
| 18-20 | Agent Type Abstraction/Flora/Flashboards | 4 | Not started |

## Key Insight: Overseer is the Safety Net

The roadmap explicitly states: "The Overseer is critical because non-coders cannot evaluate whether an AI is stuck, looping, writing bad code, or asking the user to do something technical. The system must catch these automatically."

This is the highest-leverage feature for non-coder adoption. It should be tested and hardened before anything else in Tier 2.

## Key Insight: Start Multi-Agent Simple

The roadmap says: "Start simple: Two independent agents in separate worktrees. Add task-graph orchestration later." Don't over-engineer the multi-agent system at first.
