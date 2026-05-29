# Comprehensive Build Plan — Everything Remaining

## Current State (2026-04-13)

~4,600 lines of new infrastructure code across 19 files. 661 web tests pass, 603/608 server tests pass (5 pre-existing). Zero actual TypeScript errors. Nothing user-verified.

## PHASE A: Fix Blockers (must do first)

### A1: Approval loop in Full Access mode

**Bug:** TurnReviewCard shows Approve/Reject even in Full Access.
**Root cause:** React hooks ordering violation — useState after conditional return.
**Fix:** Already fixed (hooks moved before conditional). Needs restart to verify.

### A2: Session status stuck in "error"

**Bug:** ProviderCommandReactor test shows session staying "error" when new turn starts.
**Impact:** May prevent provider sessions from recovering after transient failures.
**Fix:** Investigate the test at ProviderCommandReactor.test.ts:1219, trace the session transition logic.

### A3: Brand rename test failure

**Bug:** kimiAcpManager.test.ts expects "CUT3" but code says "Rowl".
**Fix:** Update test string.

## PHASE B: Project Prompts + Harness System

### B1: ProjectPromptsService

- CRUD for project_prompts table (create, list, update, delete, toggle enable)
- Query by scope (global, project, thread)
- Service interface + Layer implementation + WS methods + client API

### B2: Harness Presets Seeding

- On first startup, seed BUILTIN_HARNESSES from WorkflowEngine.ts into harness_presets table
- 5 presets: Careful Builder, Fast Prototyper, Systematic Debugger, Code Reviewer, Refactorer

### B3: Project Prompts Injection

- In ProviderCommandReactor, query project_prompts for the current project + any global prompts
- Query active harness preset for the thread
- Build `<project_rules>` + `<harness>` XML blocks and inject into context
- Replace the TODO comment at ProviderCommandReactor.ts:695

### B4: Project Prompts UI

- New section in right sidebar Goals tab (or Settings)
- List active rules with enable/disable toggle
- Create new rule: name + content textarea + scope selector (global/project/thread)
- Harness picker: browse presets, activate for current thread
- PM should suggest harnesses: "Looks like you're building something. Want to use the Careful Builder harness?"

### B5: PM Harness Suggestion

- When PM detects a workflow type from user message, include suggestion in response
- "I notice you're building something new. I recommend the Careful Builder harness — it'll make sure we plan before coding. Want me to activate it?"
- ACTION:ACTIVATE_HARNESS preset="careful-builder"

## PHASE C: Make Existing Features Bulletproof

### C1: Live Map End-to-End

- Verify projects.listSourceFiles returns real file data
- Verify dependency graph parses imports correctly for the current project
- Verify force layout produces reasonable positions (not overlapping, not off-screen)
- Verify health scores calculate and color nodes appropriately
- Verify Nerve Map toggle renders function nodes
- Verify minimap, zoom, and controls work
- Verify file detail panel on node click shows correct data

### C2: Memory System End-to-End

- Verify FTS5 migration runs without errors
- Verify memory creation via UI works
- Verify FTS5 search returns results
- Verify auto-extraction in Overseer creates memories from completed turns
- Verify relevant memories get injected into AI turns (check the assembled context string)
- Verify EmbeddingServiceLive loads the model and generates embeddings (or gracefully falls back)

### C3: Context Budget End-to-End

- Verify ContextBudgetCalculator returns per-section breakdowns
- Verify the breakdown renders in Context tab UI
- Verify auto-trimming activates for resume summaries >6000 chars
- Verify MiniMax conversation trimming works (old messages get tombstoned)

### C4: PM Chat End-to-End

- Verify PM thread creation works
- Verify PM system prompt includes current goals/features/brief (from shared hooks)
- Verify action buttons parse correctly from AI response
- Verify clicking action buttons creates goals/features/threads
- Verify SPAWN_AGENT creates a feature + thread and starts AI working

### C5: Overseer Alerts End-to-End

- Verify OverseerAlerts render above composer in ChatView
- Verify each detection pattern fires correctly (capability forgetfulness, technical delegation, dangerous commands, premature completion, uncertainty, loops)
- Verify context budget warnings appear at 80% and 90%

### C6: Right Sidebar Cross-Tab Integration

- Verify creating a goal in PM Chat shows in Goals tab instantly
- Verify creating a feature in PM Chat shows in Features tab instantly
- Verify clicking a linked thread chip in Goals tab navigates to Threads tab
- Verify clicking an agent in AgentOverview navigates to the thread
- Verify tab selection persists across sidebar close/open and page reload

## PHASE D: Polish to Valo-Level

### D1: Live Map Visual Quality

- Proper d3-force with collision detection (replace homebrew)
- Animated connection trails when Claude is working
- Smooth zoom-to-fit on initial scan
- Directory grouping with subtle visual boundaries
- Node tooltip with rich content (not just text)
- Edge glow on hover with file path label
- "Scan project" button text instead of refresh icon

### D2: Context Ring Visualization

- Replace the flat stacked bar with a radial/ring chart
- Animated segments showing context consumption in real-time
- Click segment to see what's in that category
- Valo-style context ring around the map or as standalone widget

### D3: Memory UX

- "The AI used this memory" indicator when a memory was injected
- Auto-extraction feedback: "3 decisions saved from this conversation"
- Memory importance stars adjustable inline
- Memory editing (not just create/delete)
- "Remember when we..." natural language search

### D4: Dashboard as Control Room

- Project cards with live agent status (pulsing indicators)
- Health score summary per project
- Recent memory count per project
- Quick actions: "Open PM Chat", "View Map", "Start Building"
- Overall system status bar (total agents, total context used)

### D5: Onboarding Polish

- First-time user tutorial flow (progressive disclosure)
- PM introduces itself and guides the user
- Animated transitions between wizard steps
- Suggest first harness after setup ("Since you're starting fresh, I recommend the Careful Builder harness")

## PHASE E: Advanced Features

### E1: Cross-Thread Context Sharing

- Thread selector in Context tab: see context for any thread, not just active
- "Share context" button: copy key context from one thread to another
- PM knows about all thread contexts and can suggest when to share

### E2: Evaluator Agent Pattern

- After builder agent claims "done," spawn a lightweight evaluator
- Evaluator runs: build check, test check, spec compliance check
- Results surfaced in OverseerAlerts
- User sees "Builder says done. Evaluator says: build passes, 2 tests fail"

### E3: Custom Harness Creation

- User creates their own harness from the UI
- Can fork a built-in harness and modify
- PM can suggest creating a harness based on recurring patterns

### E4: Codebase Intelligence Dashboard

- File health trends over time (improving/degrading)
- "Hot files" that change frequently
- Coupling analysis: "Changing X will affect Y, Z"
- Unused export detection

## Build Order

A (blockers) → B (harnesses) → C (bulletproof existing) → D (polish) → E (advanced)

Each phase is independently valuable. A is prerequisite for everything. B enables the harness vision. C makes what exists reliable. D makes it beautiful. E pushes toward the full vision.
