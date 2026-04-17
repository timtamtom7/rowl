# Rowl Overseer Hardening — Status

## Last Updated
2026-04-17

## Current Phase
**Testing & Pattern Validation** — unit tests written, patterns fixed, backend solid

## What's Done

### Pattern Fixes (2026-04-17)
- Fixed malformed regex: `be (?:correct|right|the best)` → `be correct|be right|be the best`
- Added `be wrong` to uncertainty patterns
- Added `Done[!.]? X is/are...ready` done-announcement pattern

### Test Coverage (2026-04-17)
- **31 tests, 0 failures** — `apps/server/src/orchestration/Layers/OverseerReactor.test.ts`

## What's In Progress

### Severity Levels (TODO)
Map alert kinds to CRITICAL/WARNING/INFO:

| Alert Kind | Severity | Blocking? |
|-----------|----------|-----------|
| `overseer.dangerous-command` | CRITICAL | YES |
| `overseer.loop-detected` | CRITICAL | YES |
| `overseer.context-exhaustion` | CRITICAL | YES |
| `overseer.session-error` | CRITICAL | YES |
| `overseer.capability-forgetfulness` | WARNING | No |
| `overseer.technical-delegation` | WARNING | No |
| `overseer.premature-completion` | WARNING | No |
| `overseer.context-budget-high` | WARNING | No |
| `overseer.evaluation-result` | WARNING | No |
| `overseer.certainty-warning` | INFO | No (auto-dismiss) |

### Dismissal Tracking (TODO)
- Store dismissed pattern signatures in session state
- Same pattern → no re-alert within session
- Key: `${threadId}:${alertKind}:${patternHash}`

## Next Actions
1. Add `severity` field to alert activities in OverseerReactor
2. Implement dismissal tracking
3. Enforce CRITICAL blocking in orchestrator
4. E2E test with real provider output
