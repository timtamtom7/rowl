# Rowl Outstanding — Plan

## Goal

Organize all remaining Rowl work into independently executable initiatives. Each can be started, tested, and shipped separately. The right sidebar (rowl-right-sidebar) is the UI layer for many of these — complete that first.

## Recommended Order

### Immediate: Fix Blockers (Comprehensive Build Plan Phase A)

These are bugs blocking valid work:

1. **A1: Approval loop in Full Access mode**
   - Bug: TurnReviewCard shows Approve/Reject even in Full Access
   - Root cause: React hooks ordering violation (useState after conditional return)
   - Fix: hooks moved before conditional, needs restart to verify

2. **A2: Session status stuck in "error"**
   - Bug: ProviderCommandReactor test shows session staying "error" when new turn starts
   - Fix: Investigate test at ProviderCommandReactor.test.ts:1219

3. **A3: Brand rename test failure**
   - Bug: kimiAcpManager.test.ts expects "CUT3" but code says "Rowl"
   - Fix: Update test string

### Next: Overseer Hardening (Tier 2, Highest Leverage)

The Overseer is the non-coder safety net. If it fails, non-coders are exposed to all AI failure modes.

**Items:**

- Test OverseerReactor patterns with real AI output
- False-positive tuning
- Confidence scoring
- Learning loop for dismissals

**E2E test:**

- Send AI output that triggers each pattern → verify alert fires
- Send clean output → verify no false alerts
- Dismiss an alert → verify it doesn't reappear for same pattern

### Then: Real-World Integration Testing (Tier 2, Next Priority)

All 90%-done features need E2E verification:

1. **Context injection** — Check the assembled context string includes brief/goals/features
2. **Auto context nodes** — OverseerReactor creates on turn.completed → verify node appears
3. **Feature-turn linking** — Select feature in composer → verify it's in context
4. **Smart thread titles** — Create thread → verify title derived from feature/goal

### After: PM Multi-Question Clarification (Tier 2)

PM should emit structured `user-input.requested` events before coding. Infrastructure exists in `ComposerPendingUserInputPanel`. Need behavioral integration.

### Then: Context Compression Real (Tier 2)

Current compression is a toggle (compressed/active). Need LLM-based summarization that actually reduces token count.

### Tier 3: Multi-Agent Coordination

**Start simple:**

- Two independent agents in separate worktrees
- Each on a different thread/task
- No task graph yet

**Later:**

- Task graph defines dependencies
- Agent A must complete before Agent B starts

### Tier 3: Process Isolation

- Each agent session in isolated subprocess
- Crash one → others continue
- Auto-restart with state restoration

### Tier 3: Apply/Review System Complete

- Turn review cards exist
- Need end-to-end: approve → changes applied, reject → changes discarded, rollback → previous checkpoint

### Tier 3: Visual Dashboard Polish

- Live agent status (pulsing indicators)
- Health score summary per project
- Recent memory count per project
- Overall system status bar

### Tier 3: Provider Session Reliability

- Every failure state → non-technical error message
- Auto-retry for transient failures
- Non-coder-friendly diagnostics

### Tier 3: Checkpoint UX Hardening

- Non-technical language for git checkpoints
- Clear rollback UI

### Tier 4: Agent Type Abstraction

Refactor so "agent" is not synonymous with "coding agent." Agents declare capabilities: can_code, can_generate_images, can_generate_video, can_write_documents.

### Tier 4: Flora + Flashboards

First-class image and video generation agents. Cross-medium context: image mockups become coding agent input.

---

## Dependencies

```
Blockers (A1-A3)
    ↓
Overseer Hardening ←→ Real-World E2E Testing
    ↓
PM Multi-Question ← Context Compression Real
    ↓
Multi-Agent (simple) ← Process Isolation
    ↓
Apply/Review Complete ← Dashboard Polish
    ↓
Provider Reliability ← Checkpoint UX
    ↓
Agent Type Abstraction
    ↓
Flora + Flashboards
```

---

## Verification Per Initiative

Each initiative should have:

1. Unit tests for new behavior
2. E2E manual test script
3. "Done" criteria stated upfront
