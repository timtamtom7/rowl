# Rowl Doc Calibration — SPEC

## Goal

Resolve all doc contradictions so Rowl's roadmap docs are a reliable source of truth. V2 is ground truth; V1 is archived.

## Contradictions to Fix

| #   | Contradiction                                              | Resolution                                             |
| --- | ---------------------------------------------------------- | ------------------------------------------------------ |
| 1   | V1 roadmap vs V2                                           | V1 marked as superseded                                |
| 2   | V2 "implemented" claims vs codebase audit                  | Downgrade to "wired/stubbed/needs testing"             |
| 3   | `rowl-codebase-context` index = done vs V2 = "not started" | Clarify: plan done, runtime worker verification needed |
| 4   | Review system "complete" vs plan index = future            | V2: "partial, needs E2E verification"                  |
| 5   | Dashboard "50%" vs plan index = future polish              | V2: "partial, live status indicators pending"          |
| 6   | Voice HIGH in V1 vs deprioritized in V2                    | V2 wins — keep deprioritized                           |

## Changes Made (2026-04-17)

### ✅ DONE: ROWL_ROADMAP.md

- Added "SUPERSEDED" header pointing to V2

### ✅ DONE: ROWL_ROADMAP_V2.md

- Feature status table: downgraded status language for Overseer, Review System, Project Dashboard
- Tier 2 section: added audit status notes per item
- Tier 3 section: added audit status notes per item

### TODO: plans/INDEX.md

- Verify `rowl-codebase-context` status accurately reflects what's done

### TODO: plans/rowl-codebase-context/

- Clarify SPEC.md: plan is done, runtime worker needs verification

## Success Criteria

1. V1 clearly marked as superseded — no one should plan from it
2. V2 status language reflects reality — "partial/scaffolded/needs testing" not "implemented/done"
3. Codebase audit findings integrated into V2 tier descriptions
4. External tool integration section added to V2

## Files Modified

- `docs/ROWL_ROADMAP.md` — SUPERSEDED header
- `docs/ROWL_ROADMAP_V2.md` — calibrated status language
- `plans/INDEX.md` — updated Active + External Tool Integration section
