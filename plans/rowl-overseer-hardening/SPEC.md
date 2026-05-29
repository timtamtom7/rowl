# Rowl Overseer Hardening — SPEC

## Goal

Make the Overseer a reliable safety net for non-coders. Currently scaffolded only — needs real AI output testing, confidence scoring, and a learning loop.

## External Reference

**Superpowers `requesting-code-review` skill** — structured pre-review checklist with severity levels:

- Critical issues block progress
- Warnings are informational
- Feedback loop for dismissals

**Paperclip governance pattern** — overseer is Rowl's "board" watching the agents.

## What the Overseer Does

Monitors AI output for failure modes non-coders can't detect:

1. **Stuck detection** — AI saying it can't do something it actually can
2. **Loop detection** — repeating the same approach after failure
3. **Bad code patterns** — obvious errors, security issues, or anti-patterns
4. **Technical friction** — AI asking user to do something technical
5. **Confidence misalignment** — AI expressing uncertainty it shouldn't

## Status Per Codebase Audit (2026-04-13)

**Scaffolded only** — patterns exist in `OverseerReactor.ts`, **no real AI output testing performed yet**.

## Requirements

### R1: Real AI Output Testing

- Test OverseerReactor with actual provider output (not mocked)
- Cover all 5 failure mode patterns
- Verify alerts fire when they should

### R2: False-Positive Tuning

- Measure false positive rate
- Tune thresholds so clean output doesn't trigger alerts
- Target: <5% false positive rate

### R3: Confidence Scoring

- Severity levels: CRITICAL, WARNING, INFO
- CRITICAL: blocks progress, requires user action
- WARNING: informational, can dismiss
- INFO: low priority, auto-dismiss after N turns

### R4: Learning Loop

- User dismissals stored and respected
- Same pattern → no re-alert within session
- Aggregate dismissal data for pattern improvement

### R5: Non-Coder-Friendly UI

- Plain language for alerts (no jargon)
- Clear "what happened" + "what you can do" format
- Examples: "The AI is stuck in a loop — want me to restart it?"

## E2E Test Plan

```
Test 1: Stuck detection
  → Send AI output "I can't fix this CSS issue"
  → Verify alert fires with "The AI might be stuck — here are some things to try"

Test 2: Loop detection
  → Send AI output with same failed approach repeated 3x
  → Verify alert fires after 3rd iteration

Test 3: False positive
  → Send clean AI output (no failure modes)
  → Verify NO alert fires

Test 4: Dismiss learning
  → Dismiss alert for specific pattern
  → Send same pattern again
  → Verify NO re-alert within session

Test 5: Critical vs Warning
  → Send output with CRITICAL issue (security vulnerability)
  → Verify blocks progress
  → Send output with WARNING only
  → Verify allows continue with dismiss option
```

## Implementation Notes

- Patterns defined in `OverseerReactor.ts` — regex + semantic checks
- Dismissals stored in session state (not persisted across sessions yet)
- Alert UI in `TurnReviewCard.tsx` or new `OverseerAlert` component

## Dependencies

- Blockers (A1-A3) fixed first
- PM Chat working (for alert context)

## Files to Create/Modify

- `apps/server/src/orchestration/Layers/OverseerReactor.ts` — patterns + confidence scoring
- `apps/web/src/components/overseer/` — new components for alerts
- `packages/contracts/src/` — new OverseerEvent types

## Success Criteria

1. Non-coder sees alert in plain language before AI causes real damage
2. False positive rate < 5%
3. Dismissed patterns don't re-alert within same session
4. CRITICAL alerts actually block progress until resolved
5. "What you can do" buttons are actionable for non-coders

---

_Last Updated: 2026-04-17_
