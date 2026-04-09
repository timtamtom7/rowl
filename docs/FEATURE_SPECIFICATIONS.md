# Rowl Feature Specifications

This document contains detailed specifications for all Rowl features. When a user proposes a simple idea, it should be expanded here into a detailed spec that the AI can reference and never forget.

---

## Feature Status

| Feature | Status | What Exists | What Needs Doing |
|---------|--------|-------------|------------------|
| Right Sidebar Shell | ✅ Done | Collapsible sidebar with 5 tabs | None - shell works |
| PM Chat | ❌ Not Done | Mock UI with simulated responses | Real WebSocket integration, service backend |
| Threads Tab | ❌ Not Done | Mock thread list | Wire to real thread data from server |
| Features Board | ❌ Not Done | Mock Kanban UI | Wire to FeatureService, persistence |
| Goals Tab | ❌ Not Done | Mock goals display | Wire to GoalsService, persistence |
| Context System | ❌ Not Done | Mock node visualizer | Wire to ContextService, compression logic |
| Thread Goal Statement | ✅ Fully Done | Works, tested, merged | None |
| Project Brief | 🔲 Not started | Nothing | Full implementation |
| Settings Reorganization | 🔲 Not started | Nothing | Full implementation |
| Skills AI Creation | 🔲 Not started | Nothing | Full implementation |
| Overseer | 🔲 Not started | Nothing | Full implementation |

---

## Architecture Notes

### What's Actually Working

**Thread Goal Statement** - Fully implemented, uses existing `thread.meta.update` command, saves to orchestration.

### What's Stubbed/Mock

All Right Sidebar tabs (1-5) have UI but use hardcoded mock data:
- `PMChat.tsx` - Simulated responses with `setTimeout`
- `ThreadsTab.tsx` - `MOCK_THREADS` constant
- `FeaturesBoard.tsx` - `MOCK_FEATURES` constant
- `GoalsTab.tsx` - `MOCK_GOALS` constant
- `ContextTab.tsx` - `MOCK_NODES` and `MOCK_BUDGET` constants

### Server Services (Stubs Only)

These interfaces exist but have no implementation:
- `FeatureService.ts` - Interface defined, no concrete class
- `GoalsService.ts` - Interface defined, no concrete class
- `ContextService.ts` - Interface defined, no concrete class
- `PMChatContextService.ts` - Interface defined, no concrete class

### Contracts (Real)

Schemas exist and are wired to WebSocket RPC:
- `features.ts` - Feature schemas (used in ws.ts)
- `goals.ts` - Goal schemas (used in ws.ts)
- `context.ts` - Context schemas (used in ws.ts)

### What's Needed to Complete Right Sidebar

1. **Implement service classes** - Concrete implementations for FeatureService, GoalsService, ContextService, PMChatContextService
2. **Add persistence** - Database layer (likely Projection patterns like existing codebase)
3. **Wire WebSocket handlers** - Connect RPC methods to service implementations
4. **Frontend API integration** - Replace mock data with real WebSocket calls
5. **State management** - React Query or Zustand for caching

---

## Feature: Right Sidebar with Project Context

### Summary

Collapsible right sidebar showing project context with 5 tabs: PM Chat, Threads, Features, Goals, and Context. This is the central coordination hub for the project.

### Status: ❌ NOT DONE - UI shells with mock data

**What exists:**
- `apps/web/src/components/right-sidebar/RightSidebar.tsx` - Shell with tab bar
- `apps/web/src/components/right-sidebar/PMChat.tsx` - Mock chat UI
- `apps/web/src/components/right-sidebar/ThreadsTab.tsx` - Mock thread list
- `apps/web/src/components/right-sidebar/FeaturesBoard.tsx` - Mock Kanban
- `apps/web/src/components/right-sidebar/GoalsTab.tsx` - Mock goals
- `apps/web/src/components/right-sidebar/ContextTab.tsx` - Mock visualizer

**What needs building:**
- Service implementations in `apps/server/src/orchestration/Services/`
- Persistence layer (Projections)
- WebSocket route handlers
- Frontend API integration to replace mock data

### Detailed Specification

**What it does:**

- Right sidebar with tabs: PM Chat, Threads, Features, Goals, Context
- Each tab shows project-relevant information
- Sidebar collapses to small (~40px) icon-only sliver when collapsed
- Clicking sliver or toggle expands sidebar

**Sidebar Dimensions:**

- Expanded width: ~320px
- Collapsed width: ~40px (icon only, not fully hidden)

**Implementation Location:**

- `apps/web/src/components/right-sidebar/RightSidebar.tsx` (new)
- `apps/web/src/components/right-sidebar/PMChat.tsx` (new)
- `apps/web/src/components/right-sidebar/ThreadsTab.tsx` (new)
- `apps/web/src/components/right-sidebar/FeaturesBoard.tsx` (new)
- `apps/web/src/components/right-sidebar/GoalsTab.tsx` (new)
- `apps/web/src/components/right-sidebar/ContextTab.tsx` (new)

---

## Feature: PM Chat (in Right Sidebar)

### Summary

AI Product Manager chat integrated into right sidebar. Has full context of project (threads, features, goals, context) and coordinates all work.

### Detailed Specification

**What it does:**

- AI chat with PM role/persona
- Sees all project context: threads, features, goals, context nodes
- Can coordinate work across threads
- Can spin off new agents to threads
- Ensures nothing gets messy or duplicated
- Views git branches and can coordinate which thread works on what

**PM Responsibilities:**

- Knows all threads and their goals
- Tracks all features and stages
- Coordinates parallel development streams (max 2)
- Reviews before merge
- Prevents branch chaos like before

**UI Behavior:**

- Chat interface in right sidebar
- Access to project context via tabs
- Can create new threads from PM chat
- Can update feature stages
- Thread-safe coordination

**Connection to other features:**

- Can see all Thread Goal Statements
- Can see all Features and their stages
- Can see project Goals
- Can see Context nodes

**Implementation Location:**

- `apps/web/src/components/right-sidebar/PMChat.tsx`
- `apps/server/src/orchestration/Services/PMChatService.ts` (new)

---

## Feature: Threads Tab (in Right Sidebar)

### Summary

List of all threads in the current project with their goal statements and status.

### Detailed Specification

**What it does:**

- Shows all threads in active project
- Each thread shows: title, goal statement, status
- Click to switch to that thread
- Thread status indicators (Working, Connecting, Completed, Pending Approval, Awaiting Input, Plan Ready)

**UI Behavior:**

- Scrollable thread list
- Search/filter threads
- Visual status indicators
- Click to navigate
- Shows thread goal statement inline

**Implementation Location:**

- `apps/web/src/components/right-sidebar/ThreadsTab.tsx`

---

## Feature: Features Board (in Right Sidebar)

### Summary

Kanban-style board with columns: Backlog, In Progress, Done, Wishlist. Each feature has detailed spec.

### Detailed Specification

**What it does:**

- Kanban board with 4 columns:
  - **Backlog** - proposed features
  - **In Progress** - currently being worked on
  - **Done** - completed
  - **Wishlist** - nice to have
- Each feature card shows:
  - Feature name
  - Description summary (from detailed spec)
  - Assigned thread (if any)
  - Last activity timestamp
- Drag and drop between columns
- Click to expand full feature spec

**Feature Spec Process (Important):**

1. User proposes simple idea in PM chat or features tab
2. PM (AI) writes detailed spec in `docs/FEATURE_SPECIFICATIONS.md` format
3. User reviews spec, can edit/request changes
4. Once approved, feature moves from "Backlog" to appropriate stage
5. Feature spec is stored and never forgotten

**Data Model:**

```typescript
interface Feature {
  id: string;
  projectId: string;
  name: string;
  description: string; // Full detailed spec
  stage: "backlog" | "in_progress" | "done" | "wishlist";
  threadId?: string; // Thread working on this
  createdAt: Date;
  updatedAt: Date;
  createdBy: "user" | "pm";
}
```

**Implementation Location:**

- `apps/web/src/components/right-sidebar/FeaturesBoard.tsx`
- `apps/server/src/orchestration/Services/FeatureService.ts` (new)
- `packages/contracts/src/features.ts` (new)

---

## Feature: Goals Tab (in Right Sidebar)

### Summary

Project-level goals display with main goal prominent and sub-goals linked to threads.

### Detailed Specification

**What it does:**

- Shows main project goal prominently at top
- Lists sub-goals below
- Shows which thread is working on which goal
- Visual progress indicators

**Data Model:**

```typescript
interface ProjectGoal {
  id: string;
  projectId: string;
  text: string;
  isMain: boolean;
  linkedThreadIds: string[];
  createdAt: Date;
}
```

**Implementation Location:**

- `apps/web/src/components/right-sidebar/GoalsTab.tsx`

---

## Feature: Context System (in Right Sidebar)

### Summary

Visual representation of context chunks as nodes that can be managed to achieve context reduction. No longer called "Tombstones" - just "Context".

### User Description (Original)

"Visual representation of context chunks as nodes that can be tombstoned (compressed/archived) to achieve 70-90% context reduction"

### Detailed Specification

**What it does:**

- Visual graph/nodes showing conversation context chunks
- Each node represents a chunk of context (message group, file, etc.)
- Nodes can be "compressed" (not deleted, just optimized/reduced)
- Shows which context is active vs compressed
- 70-90% context reduction achieved through smart compression

**UI Behavior:**

- Node-based visualizer (like a graph)
- Click node to see context details
- Right-click or button to compress context
- Compressed context shown differently (greyed, collapsed)
- Can restore/resurrect compressed context if needed

**Key Concepts:**

- **Active Context** - currently loaded, takes up context window
- **Compressed Context** - optimized but can be restored
- **Context Budget** - shows how much context is being used
- **Compression suggestions** - AI suggests what can be compressed

**Why This Matters:**

- 70-90% context reduction means more room for actual work
- Visual representation makes it easy to understand what's happening
- User has control over what gets compressed

**Data Model:**

```typescript
interface ContextNode {
  id: string;
  projectId: string;
  threadId: string;
  type: "messages" | "file" | "artifact" | "memory";
  summary: string;
  size: number; // tokens
  compressed: boolean;
  createdAt: Date;
}

interface ContextBudget {
  total: number;
  used: number;
  available: number;
  compressionRatio: number;
}
```

**Implementation Location:**

- `apps/web/src/components/right-sidebar/ContextTab.tsx`
- `apps/server/src/orchestration/Services/ContextService.ts` (new)
- `packages/contracts/src/context.ts` (new)

---

## Feature: Thread Goal Statement

### Summary

A short, explicit statement at the top of every thread describing what that thread is trying to accomplish.

### Status: ✅ DONE (merged to main)

**Implemented:**
- `apps/web/src/components/chat/ThreadGoalStatement.tsx` - React component
- `packages/contracts/src/orchestration.ts` - Added `goal` field to `OrchestrationThread` and `ThreadMetaUpdateCommand`
- `apps/web/src/types.ts` - Added `goal: string | null` to Thread interface
- `apps/web/src/store.ts` - Sync goal from server read model
- `apps/web/src/components/ChatView.tsx` - Renders above MessagesTimeline

**What it does:**
- Displays at the top of each thread's chat view
- Editable text field (click to edit)
- Persisted via existing `thread.meta.update` command
- Used as context for AI to stay on track

**UI Behavior:**
- Shows below thread title/header
- Placeholder text when empty: "What is this thread trying to accomplish?"
- Auto-saves on blur or Enter key
- Subtle "Saved" indicator briefly shows after save

**Data Model:**
- `goal: string | null` added to `OrchestrationThread` schema
- Uses existing `ThreadMetaUpdateCommand` with new `goal` field

---

## Feature: Project Brief

### Summary

A detailed description of the project's purpose, goals, and context. Stored in `.rowl/project-brief.md`.

### Detailed Specification

**What it does:**

- Markdown file stored at `.rowl/project-brief.md`
- Created automatically when project is created
- Can be edited from project settings or PM chat
- All threads in project have access to project brief context

**UI Behavior:**

- Accessible from project settings
- Editable markdown editor
- Preview mode available
- Changes persist to `.rowl/project-brief.md`

**Data Model:**

```typescript
interface ProjectBrief {
  projectId: string;
  brief: string; // Markdown content
  filePath: ".rowl/project-brief.md";
  lastEditedAt: Date;
  lastEditedByThreadId: string;
}
```

**Implementation Location:**

- `apps/server/src/orchestration/Services/ProjectBriefService.ts` (new)
- File read/write via existing file system APIs

---

## Feature: Settings Page Reorganization with Tabs

### Summary

Replace long-scrolling settings page with tabbed interface. Unified model management.

### Detailed Specification

**What it does:**

- Tabbed settings interface with 5 tabs:
  1. **General** - Language, theme, background
  2. **Models** - All model/provider settings in one place
  3. **Providers** - Provider-specific overrides (binary paths, API keys)
  4. **Keybindings** - Keyboard shortcuts
  5. **Safety** - Confirmation dialogs, destructive actions

**Models Tab includes:**

- OpenRouter free models (with live catalog)
- Custom model slugs per provider
- Provider visibility toggles
- Provider health status (lazy-loaded - only checked when you open this tab)
- Provider errors shown only when relevant (not on startup)

**Lazy Provider Health:**

- Provider status checks run when:
  1. User opens the Models tab in settings
  2. User selects that provider in the picker
  3. User sends a message with that provider
- NOT on every app startup
- Status cached, refresh button available

**Unified Model Management:**

- "Manage Models" from dropdown goes to same page as Settings > Models
- No more separate dialogs for same functionality

**Implementation Location:**

- `apps/web/src/routes/_chat.settings.tsx` - Refactor to tabs
- `apps/web/src/components/settings/GeneralSection.tsx` (new)
- `apps/web/src/components/settings/ModelsSection.tsx` (new - includes ManageModelsDialog content)
- `apps/web/src/components/settings/ProvidersSection.tsx` (new)
- `apps/web/src/components/settings/KeybindingsSection.tsx` (new)
- `apps/web/src/components/settings/SafetySection.tsx` (new)
- `apps/server/src/provider/Layers/ProviderHealth.ts` - Add lazy mode

---

## Feature: Command Palette Search

### Summary

Fix the search action in command palette to actually search projects and threads.

### Detailed Specification

**Current Behavior:**

- Search action in command palette just calls `toggleSidebar()`

**Expected Behavior:**

- Opens/focuses sidebar search
- Searches across:
  - Project names
  - Thread titles
  - Thread goal statements
  - Message content (recent)
- Results grouped by type
- Selecting result navigates to that item

**UI Behavior:**

- Type to search (debounced 200ms)
- Results appear in sidebar search
- Keyboard navigation
- Enter to select
- Escape to close

**Implementation Location:**

- `apps/web/src/routes/_chat.tsx` - Update search action
- Already exists: `sidebarSearchQuery` state in Sidebar.tsx

---

## Feature: Overseer (Guardian System)

### Summary

Background AI monitoring system that watches provider output for capability forgetfulness patterns.

### Detailed Specification

**What it does:**

- Background process monitoring AI outputs
- Detects patterns like:
  - "I can't do that" when AI actually can
  - "You need to run this yourself"
  - "I don't have access to file system"
  - Loop detection (same output repeated)
  - Command timeout indicators
  - Stuck task patterns

**GuardianSuggestion Schema:**

```typescript
interface GuardianSuggestion {
  id: string;
  sessionId: string;
  patternMatched: string;
  suggestion: string;
  capability: string;
  confidence: number;
  createdAt: Date;
  acknowledged: boolean;
}
```

**Patterns:**

```typescript
const GUARDIAN_PATTERNS = [
  {
    pattern: /I can't (?:do|run|execute|use)/i,
    capability: "tool_use",
    suggestion: "You have access to shell, read, write, and edit tools",
  },
  {
    pattern: /you(?:'ll| will) need to run this yourself/i,
    capability: "automation",
    suggestion: "You can execute commands directly",
  },
  {
    pattern: /I don't have access to.*file system/i,
    capability: "file_access",
    suggestion: "You have full file system access via tools",
  },
];
```

**Implementation Location:**

- `apps/server/src/guardian/Services/GuardianService.ts` (new)
- `apps/server/src/guardian/Layers/OutputWatcher.ts` (new)
- `packages/contracts/src/guardian.ts` (new)
- UI: Guardian panel in ChatView (collapsible)

---

## Feature: Skills AI Creation

### Summary

AI-assisted creation of SKILL.md files for project-specific instructions.

### Detailed Specification

**What it does:**

- PM can help create SKILL.md files for projects
- Analyzes project structure and suggests skills
- User reviews and approves suggestions
- Skills appear in AI context for relevant threads

**UI Behavior:**

- Accessible from PM chat or project settings
- Shows existing skills
- "Suggest new skill" button
- AI analyzes project, suggests skill content
- User edits/refines in preview
- Save creates/updates .rowl/skills/SKILL-name.md

**Implementation Location:**

- `apps/server/src/orchestration/Services/SkillService.ts` (new)
- `apps/web/src/components/right-sidebar/PMChat.tsx` - Skill suggestions

---

## Feature: Project Scripts Integration

### Summary

Integration between Project Scripts and the right sidebar for managing automation.

### Detailed Specification

**What it does:**

- Project scripts visible in right sidebar
- PM can trigger/execute scripts
- Scripts can be assigned to features/threads
- Execution status tracked

---

## Process: Feature Specification Template

When user proposes a feature, expand using this template:

```markdown
## Feature: [Name]

### Summary

1-2 sentence description

### User Description (Original)

Original user quote or description

### Detailed Specification

**What it does:**
Detailed description of functionality

**UI Behavior:**
How it appears and behaves in UI

**Data Model:**
TypeScript interfaces for data structures

**Implementation Location:**
File paths where code will live

**Connection to PM:**
How PM uses or coordinates this feature

### Status

- [ ] Not started
- [ ] In progress
- [ ] Done
```

---

## Development Process (Important!)

1. **User proposes simple idea** in PM chat or anywhere
2. **AI writes detailed spec** using template above, saves to this file
3. **User reviews spec** and requests changes if needed
4. **Feature approved** - moves to backlog or in progress
5. **PM coordinates** - assigns to thread, ensures no conflicts
6. **Implementation** - one feature at a time, proper branches
7. **Commit at every step**, lint/typecheck pass before merge
8. **PM reviews** before merge to main

**No more 8 parallel branches!** Max 2 parallel streams:

- Stream A (Backend): Server, contracts
- Stream B (Frontend): Web, iOS, UI

---

_Last updated: 2026-04-08_
