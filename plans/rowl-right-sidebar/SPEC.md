# Rowl Right Sidebar — SPEC

## Vision

The right sidebar is the physical and metaphorical control room of Rowl. It is a unified project state system where all 6 tabs (PM Chat, Threads, Features, Goals, Context, Memory) react as one coherent system. When a user types in PM Chat, every tab reflects the change instantly. Clicking an agent in one tab navigates to its thread in another. Context budget updates in real-time. Memory auto-extracts decisions.

The control room metaphor: a pilot's cockpit where every dial, screen, and switch is connected to the same aircraft. You look at one and you understand the whole.

## Problem Statement

Three systemic problems prevent the current sidebar from feeling like a control room:

1. **Stale data between tabs** — PM Chat builds context once, not per-message. Mutations in one tab don't refresh others. No shared query layer.
2. **No cross-tab navigation** — Agents, threads, features, and goals are isolated. Can't click an agent to see its thread. Can't click a feature to see who's building it.
3. **Silent failures + missing polish** — Every tab swallows errors. No drag-drop on kanban. No search. No keyboard shortcuts. No expandable details.

## Design Approach

Two layers: **System layer** (shared data hooks, cross-tab invalidation, navigation) and **Tab layer** (per-tab functional improvements).

---

## SYSTEM LAYER

### S1: Shared Data Hooks

Replace the ad-hoc `useState + useEffect + readNativeApi()` pattern in every tab with shared React Query hooks.

**New hooks (`apps/web/src/hooks/useSidebarData.ts`):**

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

**Invalidation:** When any mutation succeeds, invalidate ALL sidebar queries for that project. Creating a goal in PM Chat instantly refreshes the Goals tab.

**Stale time:** 5 seconds for all sidebar data.

### S2: PM Chat Context Freshness

- Rebuild the system prompt on EVERY send (not just thread creation)
- Use hooks from S1 for goals/features/brief — always fresh
- Remove local `useState` for goals/features/brief from PMChatTabContent

### S3: Cross-Tab Navigation

Lightweight event bus in RightSidebarContext:
```typescript
navigateToTab(tab: RightSidebarTab, focus?: { type: string; id: string })
```

Usage:
- AgentOverviewSection: click agent → `navigateToTab("threads", { type: "thread", id: threadId })`
- Features tab: click linked thread → `navigateToTab("threads", { type: "thread", id: threadId })`
- PM Chat action buttons: after creating feature → `navigateToTab("features")`

### S4: Tab State Persistence

Move `activeTab` from RightSidebar local state into RightSidebarContext. Persist to localStorage so it survives page reloads and sidebar collapse/expand.

### S5: Error Boundary + Toast Pattern

Replace all silent `catch {}` blocks with shared `useSidebarMutation` hook:
```typescript
function useSidebarMutation(label: string) {
  return {
    mutate: async (fn: () => Promise<void>) => {
      try { await fn(); }
      catch (err) {
        toastManager.add({ type: "error", title: `Failed to ${label}`, description: err.message });
      }
    }
  };
}
```

---

## TAB LAYER

### T1: PM Chat Improvements

- Use shared hooks (S1) — always fresh context
- After executing action: inline confirmation "Created feature: Menu Page"
- Typing indicator stays until AI actually responds
- Context budget in header: "Context: 45K/200K"

### T2: Features Tab — Drag-Drop + Linking

- Drag-drop between kanban columns (native HTML5 drag API)
- Linked thread shown under each feature card
- Click feature → expand: description, linked thread, creation date
- ALL stages visible (currently limited to 2 via .slice)

### T3: Goals Tab — Thread Linking UI

- Linked threads shown as clickable chips under each goal
- "Link thread" button → dropdown of project threads
- Click chip → navigateToTab("threads", { thread })
- Main goal gets visual prominence (larger text, accent border)

### T4: Context Tab — Expandable Nodes + Budget Ring

- Click node → expand: full summary, thread name, created date, token count
- Budget breakdown always visible
- "Trim old context" button: bulk-compress nodes older than N turns
- Warning banner when budget > 80%

### T5: Memory Tab — Inline Editing + Sort

- Click memory → expand with full content view + edit capability
- Sort toggle: by importance, by recency, by type
- Memory importance adjustable (click stars)
- "Auto-extracted" badge on memories created by Overseer vs "manual" for user-created

### T6: Threads Tab — Search + Unread Indicators

- Search/filter input at top (filters by title, goal)
- Unread indicator (dot) for threads with new messages since last visit
- Click agent → scroll to and highlight that thread

### T7: Live Map — Click Interaction + Health Panel

- Click node → side panel: file path, line count, health score, issues list, connected files
- Click connected file in panel → zoom to that node
- Health legend in corner
- "Scan project" replaces "Refresh" button text

### T8: Skills Section — Preview + Edit

- Click skill → expand to show full SKILL.md content
- Edit button → opens skill content in textarea
- Show generation status (which thread is generating, link to open it)

---

## IMPLEMENTATION ORDER

1. **Phase 1** — System layer (S1-S5): shared hooks, navigation, persistence, errors
2. **Phase 2** — PM Chat (T1) + Features (T2): highest-impact tab improvements
3. **Phase 3** — Goals (T3) + Context (T4) + Memory (T5): complete the data tabs
4. **Phase 4** — Threads (T6) + Map (T7) + Skills (T8): polish remaining tabs

Phase 1 is a prerequisite for all others. Each phase is independently valuable.

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

---

## SUCCESS CRITERIA

A non-coder can:
1. Open PM Chat → say "I want a login page" → PM suggests creating a feature → one click creates it → Features tab instantly shows it → PM spawns an agent → Threads tab shows agent running → Map shows files lighting up as agent works
2. See context budget filling up → get warning → click "Start new thread" → handoff happens automatically
3. Search memories for "database schema" → find decision from 3 days ago → AI already knows about it because it was auto-injected
4. Click a red node on map → see "500 lines, highly coupled, changed 12 times" → understand codebase health without reading code
