# Rowl Codebase Context — Status

## Last Updated
2026-04-13

## Overall Status
**Phase: ✅ ANALYSIS COMPLETE. Master synthesis written. Ready to plan.**

---

## What Is Done

- [x] Research synthesis written (4 agents, earlier session — findings partially recovered)
- [x] SPEC.md, RESEARCH.md, PLAN.md written
- [x] **10-agent parallel codebase audit COMPLETE** — 631 files, 164,081 lines read
- [x] Master synthesis written to `docs/codebase-analysis/MASTER_SYNTHESIS.md`
- [x] 10 domain analysis files written to `docs/codebase-analysis/{01-10}-*.md`

---

## Key Findings from Audit

### Architecture: Sound
- Event-sourced orchestration (command→event→projection) over SQLite
- Effect framework throughout, typed contracts package
- 7 AI provider adapters (CLI/stdio, REST, embedded SDK)
- Frontend: Next.js + Zustand + React Query + Lexical composer

### Critical Stubs Found
| Stub | Impact |
|------|--------|
| Checkpoints projector (`() => Effect.void`) | Checkpoint diffs not persisted to DB |
| `EvaluatorService.quickCheck()` | Always `compiles: true` |
| `respondToUserInput()` | Stubbed in ALL 7 adapters |
| Right sidebar: Context/Memory/LiveMap tabs | May be hollow shells |
| Skill creation UI | Stub — hint message only |

### Roadmap Self-Reported State is WRONG
ROWL_ROADMAP_V2.md over-reports Tier 2 progress by ~50%. The approval loop has a known bug. Session status can get stuck. The `rowl-outstanding` plan needs to be updated against actual code.

---

## What Needs to Happen Next

### Immediate: Update rowl-outstanding Plan
The outstanding plan's "done/not started" claims need verification against the actual codebase. Several items marked "done" in the roadmap have stubs or known bugs.

### Then: Decide Implementation Order
With full codebase understanding, the right sidebar vision (PM Chat + Features tabs as the "control room") can be planned against actual code reality.

---

## Decisions Made

1. **Hybrid pattern** — persistent background index + on-demand PM updates
2. **Challenge A before Challenge B** — analysis tools become runtime engine
3. **Chroma** (embedded) as vector DB for MVP
4. **CodeBERT** as base embedding model
5. **TreeSitter** for AST-level parsing

---

## Open Questions

1. Does the new index system require redesign of `.rowl/` workspace instruction system?
2. Should the codebase index tools be user-facing features or internal infrastructure only?
3. Should Tier 2 bugs (approval loop, session stuck) be fixed before or alongside new features?

---

## Related Initiatives

- `rowl-outstanding` — needs update against actual code state
- `rowl-right-sidebar` — Context/Memory/LiveMap tabs may need real implementation
- `index-system` — demonstrates the plans pattern (this plan)
