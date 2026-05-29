# Right Sidebar Deep Improvements — Design Spec

## Problem Statement

The right sidebar has 6 tabs with 12 components totaling ~3,200 lines. All the plumbing exists (services, WS methods, UI shells) but three systemic problems prevent it from feeling like a control room:

1. **Stale data between tabs** — PM Chat builds context once, not per-message. Mutations in one tab don't refresh others. No shared query layer.
2. **No cross-tab navigation** — Agents, threads, features, and goals are isolated. Can't click an agent to see its thread. Can't click a feature to see who's building it.
3. **Silent failures + missing polish** — Every tab swallows errors. No drag-drop on kanban. No search. No keyboard shortcuts. No expandable details.

## Design Approach

Two layers: **System layer** (shared data hooks, cross-tab invalidation, navigation) and **Tab layer** (per-tab functional improvements).

---

## SYSTEM LAYER

### S1: Shared Data Hooks

Replace the ad-hoc `useState + useEffect + readNativeApi()` pattern in every tab with shared React Query hooks. The app already uses React Query for project/git data — extend it to sidebar data.

**New hooks (in `apps/web/src/hooks/`):**

```
useSidebarGoals(projectId)     → { goals, isLoading, refetch, createGoal, deleteGoal, ... }
useSidebarFeatures(projectId)  → { features, isLoading, refetch, createFeature, moveFeature, ... }
useSidebarMemories(projectId)  → { memories, isLoading, search, createMemory, deleteMemory }
useSidebarContextNodes(projectId) → { nodes, budget, breakdown, isLoading, compress, restore }
useSidebarHealth(projectId)    → { summary, isLoading }
useSidebarAgents(projectId)    → { overview, isLoading }
```

**Query keys pattern:**

```
sidebarQueryKeys = {
  goals: (projectId) => ["sidebar", "goals", projectId],
  features: (projectId) => ["sidebar", "features", projectId],
  memories: (projectId) => ["sidebar", "memories", projectId],
  contextNodes: (projectId) => ["sidebar", "context", projectId],
  health: (projectId) => ["sidebar", "health", projectId],
  agents: (projectId) => ["sidebar", "agents", projectId],
}
```

**Invalidation:** When any mutation succeeds, invalidate ALL sidebar queries for that project. This means creating a goal in PM Chat instantly refreshes the Goals tab. Domain events from `__root.tsx` also invalidate sidebar queries.

**Stale time:** 5 seconds for all sidebar data. Fast enough to feel fresh, slow enough to not hammer the server.

**File:** `apps/web/src/hooks/useSidebarData.ts`

### S2: PM Chat Context Freshness

The PM system prompt is currently built once and embedded in every user message. Fix:

1. Rebuild the system prompt on EVERY send (not just thread creation)
2. The hooks from S1 provide fresh goals/features/brief data
3. Remove the local `useState` for goals/features/brief from PMChatTabContent — use the shared hooks instead

### S3: Cross-Tab Navigation

Add a lightweight event bus for sidebar tab navigation:

```typescript
// In RightSidebarContext.tsx
navigateToTab(tab: RightSidebarTab, focus?: { type: string; id: string })
```

Usage examples:

- AgentOverviewSection: click agent → `navigateToTab("threads", { type: "thread", id: threadId })`
- Features tab: click linked thread → `navigateToTab("threads", { type: "thread", id: threadId })`
- PM Chat action buttons: after creating feature → `navigateToTab("features")`

The `focus` parameter scrolls to and highlights the target item.

### S4: Tab State Persistence

Move `activeTab` from RightSidebar local state into RightSidebarContext. Persist to localStorage so it survives page reloads and sidebar collapse/expand.

### S5: Error Boundary + Toast Pattern

Replace all silent `catch {}` blocks with a shared pattern:

```typescript
function useSidebarMutation(label: string) {
  return {
    mutate: async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (err) {
        // Show non-blocking toast: "Failed to create goal"
        toastManager.add({ type: "error", title: `Failed to ${label}`, description: err.message });
      }
    },
  };
}
```

This surfaces errors without blocking the UI. User knows something failed.

---

## TAB LAYER

### T1: PM Chat Improvements

**Current:** 528 lines. Chat works but context is stale and actions have no feedback.

**Changes:**

- Use shared hooks (S1) for goals/features/brief — always fresh
- After executing an action (create feature, spawn agent), show a brief inline confirmation: "Created feature: Menu Page"
- Add a typing indicator that stays until the AI actually responds (existing fix from previous session)
- Show context budget in PM chat header: "Context: 45K/200K" — so user knows how much room the PM has

### T2: Features Tab — Drag-Drop + Linking

**Current:** 204 lines. Kanban stages work but no drag-drop, no feature details.

**Changes:**

- Implement drag-drop between kanban columns using native HTML5 drag API (no library needed for simple lists)
- Show linked thread under each feature card (if a thread's goal matches the feature name or is explicitly linked)
- Click feature → expand to show description, linked thread, creation date
- Move stage selector: show ALL stages (currently limited to 2 via .slice)

### T3: Goals Tab — Thread Linking UI

**Current:** 253 lines. CRUD works but can't link/unlink threads.

**Changes:**

- Under each goal, show linked threads as clickable chips
- Add "Link thread" button → dropdown of project threads
- Click linked thread chip → navigateToTab("threads", { thread })
- Main goal gets visual prominence (larger text, accent border)

### T4: Context Tab — Expandable Nodes + Budget Ring

**Current:** 320 lines. Budget gauge exists but nodes are one-line summaries.

**Changes:**

- Click node → expand to show full summary and metadata (thread name, created date, token count)
- Budget breakdown always visible (not just for active thread)
- Add "Trim old context" button that bulk-compresses nodes older than N turns
- Show warning banner when budget > 80%: "Context is filling up. Consider starting a new thread."

### T5: Memory Tab — Inline Editing + Sort

**Current:** 288 lines. Search and create work.

**Changes:**

- Click memory → expand to full content view with edit capability
- Sort toggle: by importance, by recency, by type
- Memory importance adjustable (click stars)
- Show "auto-extracted" badge on memories created by the Overseer vs "manual" for user-created

### T6: Threads Tab — Search + Unread Indicators

**Current:** 132 lines. List works.

**Changes:**

- Search/filter input at top (filters by title, goal)
- Unread indicator (dot) for threads with new messages since last visit
- Click agent in AgentOverviewSection → scroll to and highlight that thread

### T7: Live Map — Click Interaction + Health Panel

**Current:** 534 lines. Visualization works.

**Changes:**

- Click node → show side panel with: file path, line count, health score, issues list, connected files
- Click connected file in panel → zoom to that node
- Health legend in corner showing color meanings
- "Scan project" replaces "Refresh" button text (clearer for non-coders)

### T8: Skills Section — Preview + Edit

**Current:** 329 lines. AI generation works.

**Changes:**

- Click skill → expand to show full SKILL.md content (read from file)
- Edit button → opens skill content in a textarea for manual editing
- Show generation status more clearly (which thread is generating, link to open it)

---

## IMPLEMENTATION ORDER

Phase 1 — System layer (S1-S5): shared hooks, navigation, persistence, errors
Phase 2 — PM Chat (T1) + Features (T2): highest-impact tab improvements
Phase 3 — Goals (T3) + Context (T4) + Memory (T5): complete the data tabs
Phase 4 — Threads (T6) + Map (T7) + Skills (T8): polish remaining tabs

Each phase is independently valuable. Phase 1 is a prerequisite for all others.

---

## FILES TO CREATE/MODIFY

**New files:**

- `apps/web/src/hooks/useSidebarData.ts` — all shared data hooks

**Modified files:**

- `apps/web/src/components/right-sidebar/RightSidebarContext.tsx` — add tab persistence + navigateToTab
- `apps/web/src/components/right-sidebar/RightSidebar.tsx` — use persisted tab state
- `apps/web/src/components/right-sidebar/PMChatTabContent.tsx` — use shared hooks, fresh context per message
- `apps/web/src/components/right-sidebar/FeaturesTabContent.tsx` — drag-drop, thread links, expanded cards
- `apps/web/src/components/right-sidebar/GoalsTabContent.tsx` — thread linking UI
- `apps/web/src/components/right-sidebar/ContextTabContent.tsx` — expandable nodes, bulk trim
- `apps/web/src/components/right-sidebar/MemoryTabContent.tsx` — inline edit, sort, auto-extract badge
- `apps/web/src/components/right-sidebar/ThreadsTabContent.tsx` — search, unread dots
- `apps/web/src/components/right-sidebar/LiveMapTabContent.tsx` — click panel, health legend
- `apps/web/src/components/right-sidebar/SkillsSection.tsx` — preview, edit
- `apps/web/src/components/right-sidebar/AgentOverviewSection.tsx` — click to navigate
- `apps/web/src/routes/__root.tsx` — invalidate sidebar queries on domain events

## SUCCESS CRITERIA

A non-coder can:

1. Open PM Chat, say "I want a login page" → PM suggests creating a feature → one click creates it → Features tab instantly shows it → PM spawns an agent → Threads tab shows the agent running → Map shows files lighting up as the agent works
2. See context budget filling up → get a warning → click "Start new thread" → handoff happens automatically
3. Search their memories for "database schema" → find a decision from 3 days ago → the AI already knows about it because it was auto-injected
4. Click a red node on the map → see "500 lines, highly coupled, changed 12 times" → understand their codebase health without reading code
