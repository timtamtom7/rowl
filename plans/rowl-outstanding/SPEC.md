# Rowl Outstanding — SPEC

## Vision

Comprehensive compilation of all remaining Rowl work from ROWL_ROADMAP_V2.md, organized as plans for independent execution. Each initiative can be started, tested, and shipped separately.

## Scope

All items from ROWL_ROADMAP_V2.md priority stack that are:

- Status: not-started or partial
- Tier: 2, 3, or 4

Excludes: items already marked 100%/Done.

## Source Document

`docs/ROWL_ROADMAP_V2.md` — single source of truth for all Rowl product decisions.

## Items Covered

### Tier 2: Intelligence and Oversight

| #   | Item                           | Status        | Gap                                                                  |
| --- | ------------------------------ | ------------- | -------------------------------------------------------------------- |
| 11  | Overseer                       | Needs testing | Pattern matching exists, untested with real AI output                |
| 12  | PM Chat                        | Done          | Wired, needs real-world E2E testing                                  |
| 13  | Real-world integration testing | Next          | Context injection, auto context nodes, feature linking, smart titles |
| 14  | Context Compression (Real)     | Not started   | LLM-based summarization that actually reduces tokens                 |

### Tier 3: Scaling and Orchestration

| #       | Item                         | Status          | Gap                                                                            |
| ------- | ---------------------------- | --------------- | ------------------------------------------------------------------------------ |
| 15      | Multi-Agent Coordination     | Not started     | Two+ agents in separate worktrees, task graph later                            |
| 16      | Process Isolation + Recovery | Not started     | Isolated subprocess per agent, auto-restart                                    |
| 17      | Apply/Review System          | Partial         | End-to-end approve/reject/rollback flow untested                               |
| 18      | Visual Dashboard             | Partial         | Polish, live agent status indicators                                           |
| **3.5** | **Codebase Intelligence**    | **Not started** | **CodebaseIndexWorker, hybrid persistent+event-based sync, PM+b coordination** |

### Tier 4: Multi-Medium Creative Workspace

| #   | Item                       | Status      | Gap                                                           |
| --- | -------------------------- | ----------- | ------------------------------------------------------------- |
| 19  | Agent Type Abstraction     | Not started | Refactor so agent ≠ coding agent; agents declare capabilities |
| 20  | Flora (Image Agents)       | Not started | First-class image generation agent type                       |
| 21  | Flashboards (Video/Canvas) | Not started | AI video generation and visual canvas                         |
| 22  | Cross-Medium Context       | Not started | Image agent mockups → coding agent input                      |

### Gap Items (from ROWL_ROADMAP_V2.md)

| Gap                             | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| Provider session reliability    | Every failure state → non-technical error message + auto-retry |
| Checkpoint clarity              | Git checkpointing UI needs clearer non-technical language      |
| PM multi-question clarification | PM emits structured user-input.requested events before coding  |

### From Comprehensive Build Plan

| Phase | Items                                                                               |
| ----- | ----------------------------------------------------------------------------------- |
| A     | Fix blockers (approval loop, session status, brand rename)                          |
| B     | Harness presets + ProjectPromptsService                                             |
| C     | E2E testing all existing features                                                   |
| D     | Polish to Valo-level (live map, context ring, memory UX, dashboard)                 |
| E     | Advanced (cross-thread context, evaluator, custom harnesses, codebase intelligence) |

## Relationship to rowl-right-sidebar

The right sidebar improvements are the **UI layer** for much of this work:

- Overseer alerts → OverseerAlerts component (above composer)
- Context budget → Context tab
- Memory auto-extraction → Memory tab
- Multi-agent status → Threads tab + AgentOverview
- Visual dashboard → Dashboard component

All sidebar tabs need the shared hooks system (from rowl-right-sidebar) to display this data correctly.
