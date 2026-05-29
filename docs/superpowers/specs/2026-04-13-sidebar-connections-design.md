# How Everything Connects — Sidebar Architecture Design

## The 9 Questions (from user feedback 2026-04-13)

### 1. "Threads — how does that all work together?"

**Current:** Threads are listed, filterable, with status indicators and unread dots. Task list shows active work from threads.

**How it connects:** Every thread belongs to a project. Threads can be linked to goals and features. The PM can spawn threads for features. The Map shows which files threads have modified. Context nodes track what each thread has consumed.

**What's missing:** Thread → Feature linking is implicit (name matching). Should be explicit: when you create a thread, you can assign it to a feature. Feature stage auto-updates based on thread status.

### 2. "Features — how does that all work together?"

**Current:** Kanban board with 4 stages, drag-drop, CRUD.

**How it connects:** Features are what the user cares about. Goals decompose into features. Threads build features. The PM creates features from user descriptions. Features show in the AI's context so it knows what the project needs.

**What's missing:** Feature → Thread link visible on the card. Feature progress based on actual AI work (not just manual stage moves). Feature completion criteria.

### 3. "Goals — how does that all work together?"

**Current:** Main goal + sub-goals, inline editing, linked thread chips.

**How it connects:** Goals are the "why." Features are the "what." Threads are the "how." Goals get injected into every AI turn so the AI stays focused. The PM references goals when suggesting what to build next.

**What's missing:** Goal progress tracking (how many linked features are done). Goal → Feature decomposition in the PM.

### 4. "Context — how does that all work together?"

**Current:** Context nodes, budget gauge, breakdown, memory, skills.

**How it connects:** Context is the AI's working memory. Every turn adds to context. Old context gets trimmed (surgical trimming). Memories persist across sessions. Skills add domain knowledge. The budget tells the user when context is running out.

**What's missing:** Visual indicator of what the AI ACTUALLY sees in each turn. "The AI is seeing: your brief, 3 goals, 5 features, 2 memories, 1 skill." This should be a clear, readable summary, not just a bar chart.

### 5. "Skills — why is it in the right side?"

**Answer:** Skills are in the Context tab because they're about what the AI knows — context + memory + skills are all "AI knowledge." But skills could arguably be their own thing or part of Goals (since they're about how the AI should work).

**Decision:** Keep skills in Context tab but make them more prominent. Add a "Skills" sub-header so they're not lost at the bottom.

### 6. "Is everything connected?"

**Current state:** Partially. PM Chat creates goals/features → they show in Goals/Features tabs. Context injects goals/features into AI turns. Memories auto-extract and inject. Map shows file activity.

**What's NOT connected:**

- Features don't show which thread is building them
- Goals don't show progress toward completion
- Map doesn't show feature boundaries ("these files belong to Feature X")
- PM doesn't see memory contents
- Harnesses aren't activated from PM conversation

### 7. "Can the product manager understand everything?"

**Current:** PM system prompt includes: brief, goals, features (with stages), active threads (titles + goals), and the action command set.

**What PM DOESN'T see:** Memories, context budget, codebase health, active harness, project rules, skill contents.

**Fix:** Add memory summaries, health summary, and active harness to PM system prompt.

### 8. "Does it have a good context system?"

**Current:** Yes architecturally. Budget calculator, surgical trimming, tombstones, auto-trimming of resume summaries, memory injection, verification reminder, project rules + harness injection.

**What's missing:** User-facing visibility. The user should see: "The AI received: 1,200 tokens of project context, 400 tokens of memories, 500 tokens of harness instructions." Not just a percentage bar.

### 9. "Does the nodes also show what the PM sees and interacts with?"

**Current:** No. The Map shows file dependencies and health. It doesn't show anything about the PM's view.

**Future:** The Map could overlay project management data. Feature boundaries (colored regions around files that belong to a feature). Goal connections (which goals connect to which file clusters). PM activity trail (which files the PM has discussed or assigned work on).

## Implementation Priority

1. **PM context enrichment** — add memories, health summary, active harness to PM system prompt
2. **Feature → Thread linking** — explicit, bidirectional, visible on both sides
3. **Goal progress** — calculated from linked feature stages
4. **Context visibility** — "AI is seeing" summary in Context tab
5. **Map overlays** — feature boundaries, goal connections (Phase D/E)
