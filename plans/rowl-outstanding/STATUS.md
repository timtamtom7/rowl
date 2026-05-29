# Rowl Outstanding — Status

## Last Updated

2026-04-13

## Current Phase

**ANALYSIS COMPLETE** — 10 parallel agents read 631 files (164,081 lines). Findings integrated.

## What's Done

- [x] All ROWL_ROADMAP_V2.md items catalogued
- [x] Priority order established (blockers → Overseer → E2E → multi-agent)
- [x] Dependencies mapped
- [x] PER劳 from comprehensive build plan integrated
- [x] **Codebase audit complete** — 631 files, 164,081 lines, 10 domains
- [x] **Master synthesis written** — `docs/codebase-analysis/MASTER_SYNTHESIS.md`
- [x] **10 domain analysis files** — ground truth for all areas

---

## What The Analysis Found

### Roadmap Self-Reported State is Over-Confident by ~50%

| Tier   | Roadmap Claims | Reality                                                                                          |
| ------ | -------------- | ------------------------------------------------------------------------------------------------ |
| Tier 1 | All done       | ✅ Actually done                                                                                 |
| Tier 2 | ~60% done      | ⚠️ ~30% done — stubs + bugs in most items                                                        |
| Tier 3 | Not started    | ⚠️ CodebaseIndexWorker is planned but not built; services layer exists but orchestrator untested |
| Tier 4 | Not started    | ✅ Correct                                                                                       |

### Known Stubs & Bugs (Verified from Code)

| Roadmap Item                 | Verified State                                                |
| ---------------------------- | ------------------------------------------------------------- |
| **A1: Approval loop**        | Has a known bug — "Accept for Session" doesn't persist        |
| **A2: Session status stuck** | Can get stuck in transient state                              |
| **A3: Brand rename test**    | Failing per ROWL_ROADMAP_V2.md                                |
| Context injection            | Never tested with live AI output                              |
| Overseer reactor             | Never tested with real AI output                              |
| PM multi-question            | Not implemented — AI can't ask follow-up questions in PM Chat |
| Skill creation               | `SkillCreatorSection` is stub UI (hint only)                  |
| Context/Memory/LiveMap tabs  | Right sidebar tabs may be hollow shells                       |
| Checkpoints projector        | Stubbed — diffs not persisted to DB                           |
| EvaluatorService.quickCheck  | No-op — always `compiles: true`                               |

### What's Actually Solid

- Event-sourcing core (command→event→projection)
- 6 of 7 provider adapters fully working
- React Query + Zustand frontend state
- WebSocket server (30+ RPC methods)
- Contracts + shared packages
- Git + terminal systems
- SQLite persistence (22/23 migrations functional)

---

## What's In Progress

Nothing yet — awaiting implementation decisions.

## Next Action

1. **Fix blockers first** (A1, A2, A3) — these are real bugs affecting users
2. **Then** Overseer — highest leverage for non-coder adoption
3. **Then** E2E tests + multi-agent

## Full Findings

See: `docs/codebase-analysis/MASTER_SYNTHESIS.md`
See: `docs/codebase-analysis/{01-10}-*.md` for domain detail

---

## Notes

- Overseer is the highest-leverage item for non-coder adoption — prioritize after blockers
- Multi-agent starts simple (2 agents, 2 worktrees, no task graph) — don't over-engineer
- Context compression (LLM-based) is separate from the sidebar context budget display
- Provider session reliability and checkpoint UX are Tier 0 gaps that affect all users
- **Codebase audit supersedes all previous self-reported roadmap state**
