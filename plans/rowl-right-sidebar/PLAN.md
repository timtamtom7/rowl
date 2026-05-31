# Rowl Right Sidebar — Plan

## Goal

Make all 6 sidebar tabs function as one unified project state system — a real-time control room where changes in one tab instantly propagate to all others, and every entity (goal, feature, thread, agent) is navigable from every other.

## Before We Start Coding

Need to confirm with user:

1. Phase 1 (system layer) first, or start with highest-impact tab (PM Chat + Features)?
2. Should the shared hooks go in `apps/web/src/hooks/useSidebarData.ts` as the spec suggests, or follow existing patterns?
3. Should the index update be verbalized during chat sessions automatically, or on-demand only?

## Implementation Steps

### Phase 1: System Layer (S1-S5)

**Step 1: Audit current data fetching in each tab**

- PMChatTabContent: how does it currently fetch goals/features/brief?
- FeaturesTabContent: how does it fetch/mutate features?
- GoalsTabContent: same for goals
- ContextTabContent: same for context nodes
- MemoryTabContent: same for memories
- ThreadsTabContent: same for threads

**Step 2: Create `useSidebarData.ts`**

- Implement all 6 hooks with React Query
- Define query keys constants
- Export invalidation helpers

**Step 3: Migrate PMChatTabContent to shared hooks**

- Remove local useState for goals/features/brief
- Use useSidebarGoals, useSidebarFeatures instead
- Rebuild system prompt on every send (not just creation)

**Step 4: Add navigateToTab to RightSidebarContext**

- Add tab persistence to localStorage
- Implement cross-tab focus/scroll-to

**Step 5: Add useSidebarMutation error pattern**

- Replace all silent catch blocks
- Add toast notifications

### Phase 2: PM Chat (T1) + Features (T2)

**Step 6: PM Chat context budget in header**

- Add "Context: XXK/200K" display
- Use ContextBudgetCalculator via shared hook

**Step 7: PM Chat inline action confirmations**

- After create feature/goal/spawn agent: show brief inline confirmation

**Step 8: Features drag-drop**

- Implement HTML5 drag API between columns
- Update feature stage on drop

**Step 9: Features linked thread display**

- Query thread links per feature
- Show thread chip under feature card
- Click navigates to tab

### Phase 3: Goals (T3) + Context (T4) + Memory (T5)

**Step 10: Goals thread linking UI**

- Add "Link thread" dropdown
- Show linked threads as chips
- Click navigates to tab

**Step 11: Context expandable nodes**

- Click node → expand with full summary
- Add bulk trim button
- Add >80% warning banner

**Step 12: Memory inline editing + sort**

- Expand memory to edit view
- Add sort toggles
- Auto-extracted badge

### Phase 4: Threads (T6) + Map (T7) + Skills (T8)

**Step 13: Threads search + unread dots**

- Add search input
- Track unread state
- Agent click → scroll to thread

**Step 14: Map click panel**

- Node click → side panel with details
- Click connected file → zoom

**Step 15: Skills preview/edit**

- Read SKILL.md on click
- Edit textarea

## Verification

After each phase:

1. Run existing tests: `pnpm test --filter=web`
2. Manual E2E: verify tab data freshness, cross-tab navigation, persistence

## Dependencies

- React Query already in project (confirmed)
- RightSidebarContext already exists
- All 6 tab content components exist
- No new dependencies needed for Phase 1 (native HTML5 drag API)
