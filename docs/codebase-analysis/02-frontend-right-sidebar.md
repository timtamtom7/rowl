# Frontend Right Sidebar Components - Codebase Analysis

## Overview

The Rowl frontend has a complex sidebar system split across multiple areas:
- **Left sidebar**: Main navigation with projects and threads (`Sidebar.tsx`, 2101 lines)
- **Right sidebar**: Contextual panels with tabs for various features
- **Branch toolbar**: Git branch management
- **Terminal drawer**: Embedded terminal view

This document focuses on the right sidebar components and related sidebar infrastructure.

---

## File Inventory

### Right Sidebar Core
| File | Lines | Purpose |
|------|-------|---------|
| `RightSidebar.tsx` | ~450 | Main right sidebar container with tab navigation |
| `RightSidebarContext.tsx` | ~150 | Context provider for right sidebar state |
| `sidebarPreferencesStore.ts` | 148 | Zustand store for sidebar preferences |

### Right Sidebar Tab Contents
| File | Lines | Purpose |
|------|-------|---------|
| `PMChatTabContent.tsx` | 709 | AI Product Manager chat interface |
| `GoalsTabContent.tsx` | ~350 | Goals CRUD with main/sub goals |
| `FeaturesTabContent.tsx` | ~500 | Kanban-style feature board |
| `ThreadsTabContent.tsx` | ~400 | Thread list with status indicators |
| `ContextTabContent.tsx` | ~300 | Context management tab |
| `MemoryTabContent.tsx` | ~250 | Memory/knowledge tab |
| `LiveMapTabContent.tsx` | ~200 | Live map visualization |

### Right Sidebar Sections (embedded in ThreadsTabContent)
| File | Lines | Purpose |
|------|-------|---------|
| `AgentOverviewSection.tsx` | ~200 | Agent status overview |
| `ProjectBrief.tsx` | ~150 | Project brief display |
| `SkillsSection.tsx` | ~200 | Skills management |
| `ProjectPromptsSection.tsx` | ~200 | Project prompts |
| `TaskListSection.tsx` | ~300 | Task list within thread |

### Sidebar Infrastructure
| File | Lines | Purpose |
|------|-------|---------|
| `Sidebar.tsx` | 2101 | Main left sidebar with DnD Kit |
| `Sidebar.logic.ts` | 268 | Sidebar helper functions |
| `PlanSidebar.tsx` | 267 | Plan display sidebar |
| `RightSidebarToggle.tsx` | 39 | Toggle button for right sidebar |
| `ThreadSidebarToggle.tsx` | 46 | Toggle button for left sidebar |

### Branch & Git Management
| File | Lines | Purpose |
|------|-------|---------|
| `BranchToolbar.tsx` | 193 | Branch selection and env mode |
| `BranchToolbarBranchSelector.tsx` | 476 | Branch combobox with virtual list |
| `BranchToolbar.logic.ts` | 124 | Branch logic helpers |
| `GitActionsControl.tsx` | 1118 | Git commit/push/PR actions |
| `GitActionsControl.logic.ts` | 478 | Git action helpers |

### Terminal
| File | Lines | Purpose |
|------|-------|---------|
| `ThreadTerminalDrawer.tsx` | 973 | Terminal viewport with xterm.js |

### Project Management
| File | Lines | Purpose |
|------|-------|---------|
| `ProjectIconDialog.tsx` | ~200 | Project icon picker dialog |
| `ProjectScriptsControl.tsx` | 574 | Project scripts CRUD |
| `ProjectScriptsControl.logic.ts` | 52 | Script validation logic |

---

## Component Analysis

### RightSidebarContext.tsx

**Purpose**: Provides React context for right sidebar state management.

**What it does**: 
- Manages right sidebar expanded/collapsed state
- Provides tab navigation with localStorage persistence (`rowl:sidebar:activeTab`)
- Exports `useRightSidebar()` hook for consuming components

**Data flow**:
- `activeTab`: persisted to localStorage
- `rightSidebarExpanded`: controlled state, defaults to `true` on desktop
- `toggleRightSidebar()`: toggles expanded state
- `navigateToTab()`: programmatic tab navigation

**Backend connection**: None directly - purely client state.

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- Uses adaptive breakpoint at 1280px to auto-collapse on smaller screens
- Tab state survives page reload via localStorage
- Provides `focusTarget` for keyboard navigation within sidebar

---

### RightSidebar.tsx

**Purpose**: Main right sidebar container rendering tab content.

**What it does**: 
- Renders the sidebar shell with tab bar
- Switches between tab contents based on active tab
- Handles responsive layout (collapses on narrow screens)

**Data flow**:
- Consumes `useRightSidebar()` context for `activeTab`, `rightSidebarExpanded`
- Uses `useSidebarPreferencesStore` for user preferences
- Renders different tab content components based on selection

**Backend connection**: None directly.

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- Tab icons from `lucide-react`
- Tab bar shows icon + label on wider screens, icon-only on narrow
- Transitions between tabs without unmounting (all tab content rendered, visibility toggled)

---

### PMChatTabContent.tsx (709 lines)

**Purpose**: AI Product Manager chat interface for natural language project management.

**What it does**: 
- Provides a chat interface for PM-style interactions
- Parses special `ACTION:` commands from AI responses
- Suggests actions when no input yet

**Data flow**:
- Input: `activeThreadId` (from parent), `sendMessage()` (from composer store)
- Uses `useStore` for thread state
- Parses responses via regex: `ACTION:(CREATE_FEATURE|CREATE_GOAL|CREATE_THREAD|SPAWN_AGENT|ACTIVATE_HARNESS)`
- Action parsing extracts key-value pairs: `key="value"` format

**Backend connection**:
- Reads from `useStore` (threads from server state)
- Dispatches actions via `api.orchestration.dispatchCommand()` for `thread.meta.update`
- PM actions parsed client-side from AI response text

**Implementation status**: Fully implemented with action parsing.

**Patterns/Quirks**:
- Uses `PM_THREAD_TITLE_PREFIX` constant for AI-created threads
- Suggestion system provides empty-state guidance
- Action parsing is fragile - relies on string matching of AI output
- Supports `ACTIVATE_HARNESS` action but harness system appears to be stubbed/partial

---

### GoalsTabContent.tsx (~350 lines)

**Purpose**: Goals management with hierarchical main/sub goals.

**What it does**: 
- CRUD operations for goals
- Shows main goal (starred) and sub-goals
- Displays feature progress (done/in_progress/total)

**Data flow**:
- Uses `useSidebarGoals()` hook (from `../sidebarHooks`)
- Uses `useSidebarFeatures()` hook
- Goal creation: `api.orchestration.dispatchCommand({ type: "goal.create", ... })`
- Feature linking via `api.featureThreadLinks.getLinks()`

**Backend connection**:
- `api.orchestration.dispatchCommand` for goal CRUD
- `api.featureThreadLinks.getLinks()` for feature-thread associations
- Goal updates via `thread.meta.update` command

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- Main goal identified by `isMainGoal: true` flag
- Sub-goals have `parentGoalId` reference
- Feature progress calculated from linked threads
- Uses `GoalCard` and `GoalForm` sub-components

---

### FeaturesTabContent.tsx (~500 lines)

**Purpose**: Kanban-style feature board with 4 stages.

**What it does**: 
- Displays features in 4 columns: backlog, in_progress, done, wishlist
- Drag-and-drop between stages (native HTML5 drag API, not DnD Kit)
- Links features to threads via feature-thread associations

**Data flow**:
- Uses `useSidebarFeatures()` hook
- Feature updates via `api.orchestration.dispatchCommand`
- Thread links via `api.featureThreadLinks.getLinks()`

**Backend connection**:
- `api.orchestration.dispatchCommand` for feature CRUD and stage updates
- `api.featureThreadLinks.getLinks()` for reading associations

**Implementation status**: Fully implemented with drag-drop.

**Patterns/Quirks**:
- Uses native HTML5 drag API, not @dnd-kit (inconsistent with Sidebar.tsx)
- Stage field is `stage: "backlog" | "in_progress" | "done" | "wishlist"`
- Feature-thread links are many-to-many
- Progress shown as "done/in_progress/total" badge

---

### ThreadsTabContent.tsx (~400 lines)

**Purpose**: Thread list for the active project.

**What it does**: 
- Lists threads sorted by recency
- Shows thread status (Working/Connecting/Error) with pulse animation
- Contains embedded sections: `TaskListSection`, `AgentOverviewSection`

**Data flow**:
- Uses `useStore` for threads and projects
- Uses `useSidebarPreferencesStore` for archived/pinned state
- Sorts via `compareThreadsByRecency()` from `Sidebar.logic.ts`

**Backend connection**: None directly - reads from `useStore`.

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- Thread status uses `resolveThreadStatusPill()` from `Sidebar.logic.ts`
- "Working" status pulses with CSS animation
- Contains nested sections that could be independent tabs
- `hasUnseenCompletion()` determines "Completed" pill visibility

---

### ContextTabContent.tsx (~300 lines)

**Purpose**: Context management for the active thread.

**What it does**: 
- Manages context entries (files, URLs, text snippets)
- Allows adding/removing context items
- Shows context usage statistics

**Data flow**:
- Uses `useStore` for thread context state
- Context updates via `api.orchestration.dispatchCommand`

**Backend connection**:
- `api.orchestration.dispatchCommand` for context CRUD

**Implementation status**: Appears stubbed/partial - requires verification.

**Patterns/Quirks**: Needs review for completeness.

---

### MemoryTabContent.tsx (~250 lines)

**Purpose**: Memory/knowledge management tab.

**What it does**: 
- Stores and retrieves persistent knowledge
- Shows memory entries grouped by category

**Data flow**:
- Uses `useStore` for memory state
- Persists via `api.orchestration.dispatchCommand`

**Backend connection**:
- `api.orchestration.dispatchCommand` for memory operations

**Implementation status**: Appears stubbed/partial - requires verification.

**Patterns/Quirks**: Needs review for completeness.

---

### LiveMapTabContent.tsx (~200 lines)

**Purpose**: Live map visualization of project/thread state.

**What it does**: 
- Visual representation of project structure
- Real-time updates of thread states on map

**Data flow**:
- Uses `useStore` for project/thread data
- Uses `useQuery` for live data polling

**Backend connection**:
- Reads via `useStore` (WebSocket-fed state)
- May use `api.orchestration.dispatchCommand` for interactions

**Implementation status**: Appears stubbed/partial - requires verification.

**Patterns/Quirks**: Needs review for completeness.

---

### AgentOverviewSection.tsx (~200 lines)

**Purpose**: Shows agent status within a thread.

**What it does**: 
- Displays active agent information
- Shows agent state and progress
- Provides agent controls

**Data flow**:
- Uses `useStore` for thread/agent state
- Props: `threadId`

**Backend connection**: Reads from `useStore` (WebSocket-fed).

**Implementation status**: Fully implemented.

**Patterns/Quirks**: Embedded in ThreadsTabContent, not a standalone tab.

---

### ProjectBrief.tsx (~150 lines)

**Purpose**: Displays project brief/goals summary.

**What it does**: 
- Shows project description and objectives
- Displays brief markdown content

**Data flow**:
- Uses `useStore` for project data
- Props: `projectId`

**Backend connection**: Reads from `useStore`.

**Implementation status**: Fully implemented.

**Patterns/Quirks**: Simple display component, markdown rendering.

---

### SkillsSection.tsx (~200 lines)

**Purpose**: Skills management for the project.

**What it does**: 
- Lists available skills
- Enables/disables skills
- Shows skill status

**Data flow**:
- Uses `useStore` for skills state
- Updates via `api.orchestration.dispatchCommand`

**Backend connection**:
- `api.orchestration.dispatchCommand` for skill toggles

**Implementation status**: Fully implemented.

**Patterns/Quirks**: Skill definitions likely from `@t3tools/contracts`.

---

### ProjectPromptsSection.tsx (~200 lines)

**Purpose**: Project-level prompt templates.

**What it does**: 
- Displays project-specific prompt templates
- Allows applying prompts to composer

**Data flow**:
- Uses `useStore` for project prompts
- Props: `projectId`

**Backend connection**: Reads from `useStore`.

**Implementation status**: Fully implemented.

**Patterns/Quirks**: Templates likely stored in project config.

---

### TaskListSection.tsx (~300 lines)

**Purpose**: Task list within a thread.

**What it does**: 
- Shows tasks for current thread
- Allows checking/completing tasks
- Links tasks to goals

**Data flow**:
- Uses `useStore` for thread tasks
- Updates via `api.orchestration.dispatchCommand`

**Backend connection**:
- `api.orchestration.dispatchCommand` for task updates

**Implementation status**: Fully implemented.

**Patterns/Quirks**: Task states: `pending`, `in_progress`, `completed`.

---

## Sidebar Infrastructure

### Sidebar.tsx (2101 lines)

**Purpose**: Main left sidebar with project/thread navigation.

**What it does**: 
- Project list with collapse/expand
- Thread list per project
- Search and archive filters
- Drag-and-drop reordering (DnD Kit)
- Thread context menus
- Multi-select with Shift+click, Cmd+click

**Data flow**:
- Uses `useStore` for projects and threads
- Uses `useSidebarPreferencesStore` for pinned/archived/sort mode
- Uses `useThreadSelectionStore` for multi-select
- Uses `useQuery` for git status queries
- Uses `useMutation` for worktree removal

**Backend connection**:
- `api.orchestration.dispatchCommand` for thread rename, delete, meta updates
- `api.terminal.close()` for terminal cleanup
- `api.contextMenu.show()` for native context menus
- `api.dialogs.confirm()` for confirmations
- `api.git.*` via React Query hooks for git operations

**Implementation status**: Fully implemented with complex interactions.

**Patterns/Quirks**:
- Uses `@dnd-kit/core` and `@dnd-kit/sortable` for project and thread reordering
- Multi-select: Shift+click for range, Cmd+click for toggle
- Thread deletion cleans up: session stop, terminal close, drafts, orphan worktree detection
- Archive filter mode: "active" | "archived" | "all"
- Project sort modes: "recent" | "manual" | "alphabetical"
- Search with `matchesSidebarSearch()` filters both projects and threads
- `pruneMissingSidebarPreferences()` cleans up stale pinned/archived IDs
- Desktop update notification state management

---

### Sidebar.logic.ts (268 lines)

**Purpose**: Pure helper functions for sidebar logic.

**Key exports**:
- `hasUnseenCompletion(thread)` - determines if thread has new completions
- `resolveThreadRowClassName({ isActive, isSelected })` - CSS class names
- `resolveThreadStatusPill({ thread, hasPendingApprovals, hasPendingUserInput })` - status badge
- `buildSidebarProjectEntries(...)` - constructs sidebar data structure
- `resolveSidebarNewThreadEnvMode(...)` - determines local/worktree mode
- `shouldClearThreadSelectionOnMouseDown(target)` - selection helper

**ThreadStatusPill types**:
- "Working" (sky-500, pulsing) - session running
- "Connecting" (sky-500, pulsing) - session connecting
- "Pending Approval" (amber-500) - awaiting approval
- "Awaiting Input" (indigo-500) - needs user input
- "Plan Ready" (violet-500) - plan ready in plan mode
- "Completed" (emerald-500) - has unseen completion

**Implementation status**: Pure functions, fully implemented, well-tested.

---

### PlanSidebar.tsx (267 lines)

**Purpose**: Displays active plan and proposed plan with step status.

**What it does**: 
- Shows current plan steps with status icons
- Displays proposed plan from AI
- Copy/download/save actions

**Data flow**:
- Props: `activePlan`, `activeProposedPlan`, `markdownCwd`, `workspaceRoot`, `timestampFormat`, `onClose`
- Uses `readNativeApi` for file system operations
- Uses `useCopyToClipboard` hook

**Backend connection**:
- `readNativeApi().fs.*` for file operations (save to workspace)
- Copy to clipboard uses native API

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- Step status icons: completed (emerald-500), inProgress (blue-400 + spinner), pending (gray dot)
- Copy to clipboard with toast feedback
- Download as .md file using Blob + URL.createObjectURL
- Save to workspace writes to `markdownCwd`

---

### RightSidebarToggle.tsx (39 lines)

**Purpose**: Toggle button for right sidebar visibility.

**What it does**: 
- Simple button with icon
- Calls `toggleRightSidebar()` from context

**Data flow**: Uses `useRightSidebar()` context.

**Backend connection**: None.

**Implementation status**: Fully implemented.

**Patterns/Quirks**: Just a button wrapper, minimal component.

---

### ThreadSidebarToggle.tsx (46 lines)

**Purpose**: Toggle button for left sidebar (uses Shadcn UI SidebarTrigger).

**What it does**: 
- Uses Shadcn `SidebarTrigger`
- Shows keyboard shortcut in tooltip

**Data flow**: Uses `serverConfigQueryOptions()` for keybindings.

**Backend connection**: None (keybindings from server config).

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- Reads keybindings from server config
- Shortcut label displayed in Persian (Farsi) or English based on app language

---

## Branch & Git Components

### BranchToolbar.tsx (193 lines)

**Purpose**: Branch selector and environment mode control.

**What it does**: 
- Shows current branch
- Allows env mode switch: Local vs Worktree
- Delegates to `BranchToolbarBranchSelector` for branch selection

**Data flow**:
- Props: `threadId`, `onEnvModeChange`, `envLocked`
- Uses `useStore` for threads/projects
- Uses `useComposerDraftStore` for draft thread context

**Backend connection**:
- `api.orchestration.dispatchCommand` for `thread.meta.update` (branch, worktreePath)
- `thread.session.stop` when switching worktree with running session

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- `envLocked` prop prevents env mode changes in certain contexts
- Worktree mode shows GitForkIcon, Local shows FolderIcon
- Draft thread changes don't persist until message sent

---

### BranchToolbarBranchSelector.tsx (476 lines)

**Purpose**: Combobox for branch selection with virtual scrolling.

**What it does**: 
- Branch search/filter
- Create new branch inline
- Checkout PR by reference
- Worktree-aware branch switching

**Data flow**:
- Uses `useQuery` for git branches and status
- Uses `useDeferredValue` for search debouncing
- Uses `useVirtualizer` for large branch lists (>40 items)
- Uses `useOptimistic` for optimistic branch name updates

**Backend connection**:
- `api.git.checkout()` for branch checkout
- `api.git.createBranch()` for new branches
- `api.git.status()` for current branch detection
- React Query: `gitBranchesQueryOptions`, `gitStatusQueryOptions`

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- Virtual list for 40+ branches (uses `@tanstack/react-virtual`)
- Special values: `__create_new_branch__:name`, `__checkout_pull_request__:ref`
- Branch badges: "current", "worktree", "remote", "default"
- `dedupeRemoteBranchesWithLocalMatches()` filters redundant remote branches
- `deriveLocalBranchNameFromRemoteRef()` extracts local name from `origin/feature` pattern

---

### BranchToolbar.logic.ts (124 lines)

**Purpose**: Pure functions for branch resolution logic.

**Key exports**:
- `resolveEffectiveEnvMode({ activeWorktreePath, hasServerThread, draftThreadEnvMode })`
- `resolveDraftEnvModeAfterBranchChange(...)`
- `resolveBranchToolbarValue(...)`
- `dedupeRemoteBranchesWithLocalMatches(branches)`
- `resolveBranchSelectionTarget(...)`

**Implementation status**: Fully implemented, pure functions.

---

### GitActionsControl.tsx (1118 lines)

**Purpose**: Git commit, push, and PR creation interface.

**What it does**: 
- Shows git status (files changed)
- Commit dialog with file selection
- Quick actions based on git state
- PR creation and viewing

**Data flow**:
- Props: `gitCwd`, `activeThreadId`
- Uses `useQuery` for git status and branches
- Uses `useMutation` for commit, push, pull, init
- Uses `useState` for dialogs and form state

**Backend connection**:
- `api.git.status()`, `api.git.checkout()`, `api.git.createBranch()`
- `api.shell.openExternal()` for PR URLs
- `api.terminal.write()` for running git commands (via mutations)
- React Query: `gitStatusQueryOptions`, `gitBranchesQueryOptions`, `gitRunStackedActionMutationOptions`

**Implementation status**: Fully implemented with i18n (English + Farsi).

**Patterns/Quirks**:
- Commit dialog allows excluding files
- `buildGitActionProgressStages()` for multi-step action toasts
- `resolveQuickAction()` determines best action based on git state
- Default branch detection: checks `isDefault` flag or name "main"/"master"
- `requiresDefaultBranchConfirmation()` prompts before acting on default branch
- Stale status detection: compares `gitStatus.branch` vs `currentBranch`

---

### GitActionsControl.logic.ts (478 lines)

**Purpose**: Pure functions for git action logic and i18n.

**Key exports**:
- `buildGitActionProgressStages(...)` - toast progress messages
- `summarizeGitResult(...)` - result message formatting
- `buildMenuItems(...)` - action menu items with disabled states
- `resolveQuickAction(...)` - best action based on git state
- `requiresDefaultBranchConfirmation(...)`
- `resolveDefaultBranchActionDialogCopy(...)`
- `getGitActionLogicCopy(language)` - i18n strings (English + Farsi)

**Implementation status**: Fully implemented, well-structured.

**Patterns/Quirks**:
- All UI copy parameterized for i18n
- Farsi (fa) translations included
- `PREFERRED_REMOTE_NAME = "Rowl"` constant
- `GitStackedAction` = "commit" | "commit_push" | "commit_push_pr"

---

## Terminal Component

### ThreadTerminalDrawer.tsx (973 lines)

**Purpose**: Embedded terminal using xterm.js.

**What it does**: 
- Renders xterm.js terminal
- Handles terminal input/output
- Terminal link detection and activation
- Multi-terminal support per thread
- Resizable drawer

**Data flow**:
- Props: `threadId`, `cwd`, `runtimeEnv`, `height`, `terminalIds`, `activeTerminalId`, etc.
- Uses `readNativeApi()` for terminal API
- Uses `useState` and `useRef` for terminal instances

**Backend connection**:
- `api.terminal.open()` - open terminal session
- `api.terminal.write()` - send input
- `api.terminal.resize()` - resize terminal
- `api.terminal.close()` - close terminal
- `api.terminal.onEvent()` - subscribe to terminal events

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- Uses `@xterm/addon-fit` for terminal fitting
- Theme observer for light/dark mode changes
- MutationObserver on `document.documentElement` for class changes
- Link provider extracts file paths and URLs
- `extractTerminalLinks()` from `../terminal-links`
- `resolvePathLinkTarget()` for file path handling
- Session exit handling with delayed callback
- Fit timing: 30ms debounce for resize

---

## Project Management

### ProjectIconDialog.tsx (~200 lines)

**Purpose**: Dialog for changing project icon.

**What it does**: 
- Shows icon picker grid
- Updates project icon

**Data flow**:
- Props: `projectId`, `projectName`, `projectCwd`, `onClose`
- Uses `api.orchestration.dispatchCommand`

**Backend connection**:
- `api.orchestration.dispatchCommand` for project icon update

**Implementation status**: Fully implemented.

---

### ProjectScriptsControl.tsx (574 lines)

**Purpose**: CRUD interface for project scripts (runnable commands).

**What it does**: 
- List project scripts
- Create/edit/delete scripts
- Keybinding capture for shortcuts
- Icon selection per script

**Data flow**:
- Uses `useStore` for projects
- Uses `useMutation` for script updates
- Local state for dialog form

**Backend connection**:
- `api.orchestration.dispatchCommand` for script CRUD

**Implementation status**: Fully implemented.

**Patterns/Quirks**:
- Keybinding capture via `useEffect` on `keydown`/`keyup`
- Icon selection grid (Lucide icons)
- Validation via `ProjectScriptsControl.logic.ts`

---

### ProjectScriptsControl.logic.ts (52 lines)

**Purpose**: Validation helpers for project scripts.

**Key exports**:
- `validateProjectScriptInput({ name, command })`
- `clearProjectScriptValidationFields(...)`
- `getFirstInvalidProjectScriptField(...)`

**Implementation status**: Fully implemented.

---

## State Management Summary

### Zustand Stores Used

| Store | Purpose | File |
|-------|---------|------|
| `useSidebarPreferencesStore` | Pinned/archived projects and threads, sort mode | `sidebarPreferencesStore.ts` |
| `useStore` | Main app state: projects, threads, sessions | `store.ts` |
| `useThreadSelectionStore` | Multi-select state for threads | (in `Sidebar.tsx` imports) |
| `useTerminalStateStore` | Terminal drawer height, terminal groups | (in `Sidebar.tsx` imports) |
| `useComposerDraftStore` | Unsent composer drafts | `composerDraftStore.ts` |

### React Query Usage

| Query | Purpose | File |
|-------|---------|------|
| `serverConfigQueryOptions()` | Server config + keybindings | `lib/serverReactQuery.ts` |
| `gitStatusQueryOptions(cwd)` | Git working tree status | `lib/gitReactQuery.ts` |
| `gitBranchesQueryOptions(cwd)` | Git branch list | `lib/gitReactQuery.ts` |
| `featureThreadLinks.getLinks()` | Feature-thread associations | (direct API) |

### Mutations

| Mutation | Purpose | File |
|----------|---------|------|
| `gitRemoveWorktreeMutationOptions` | Remove orphaned worktree | `lib/gitReactQuery.ts` |
| `gitRunStackedActionMutationOptions` | Commit/push/PR | `lib/gitReactQuery.ts` |
| `gitPullMutationOptions` | Git pull | `lib/gitReactQuery.ts` |
| `gitInitMutationOptions` | Initialize git repo | `lib/gitReactQuery.ts` |

---

## Backend Communication Pattern

### Native API (`readNativeApi()`)

Most backend communication goes through `readNativeApi()`:

```typescript
const api = readNativeApi();
if (!api) return; // Electron only

// Orchestration commands
api.orchestration.dispatchCommand({
  type: "thread.meta.update" | "thread.delete" | "thread.session.stop" | "project.delete" | "goal.create" | "feature.create" | etc,
  commandId: newCommandId(),
  threadId?: ThreadId,
  projectId?: ProjectId,
  // ... type-specific fields
});

// Terminal
api.terminal.open({ threadId, terminalId, cwd, cols, rows });
api.terminal.write({ threadId, terminalId, data });
api.terminal.close({ threadId, terminalId, deleteHistory });
api.terminal.onEvent(callback); // Subscribe to output

// Git
api.git.checkout({ cwd, branch });
api.git.createBranch({ cwd, branch });
api.git.status({ cwd });

// Dialogs
api.dialogs.confirm(message);
api.contextMenu.show(items, position);
api.shell.openExternal(url);
```

### WebSocket (via `useStore`)

Thread/project data arrives via WebSocket and is stored in `useStore`. Components subscribe with selectors:

```typescript
const threads = useStore((store) => store.threads);
const projects = useStore((store) => store.projects);
```

---

## Implementation Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| RightSidebarContext | ✅ Complete | Fully functional |
| RightSidebar | ✅ Complete | Fully functional |
| PMChatTabContent | ✅ Complete | Action parsing implemented |
| GoalsTabContent | ✅ Complete | CRUD functional |
| FeaturesTabContent | ✅ Complete | Kanban with drag-drop |
| ThreadsTabContent | ✅ Complete | Status pills working |
| ContextTabContent | ⚠️ Unclear | Needs verification |
| MemoryTabContent | ⚠️ Unclear | Needs verification |
| LiveMapTabContent | ⚠️ Unclear | Needs verification |
| AgentOverviewSection | ✅ Complete | Embedded section |
| ProjectBrief | ✅ Complete | Display component |
| SkillsSection | ✅ Complete | CRUD functional |
| ProjectPromptsSection | ✅ Complete | Functional |
| TaskListSection | ✅ Complete | CRUD functional |
| Sidebar | ✅ Complete | Complex, 2101 lines |
| Sidebar.logic | ✅ Complete | Pure functions, tested |
| PlanSidebar | ✅ Complete | Copy/download/save work |
| BranchToolbar | ✅ Complete | Functional |
| BranchToolbarBranchSelector | ✅ Complete | Virtual list, PR checkout |
| GitActionsControl | ✅ Complete | Full i18n (EN/FA) |
| ThreadTerminalDrawer | ✅ Complete | xterm.js terminal |
| ProjectIconDialog | ✅ Complete | Functional |
| ProjectScriptsControl | ✅ Complete | CRUD with validation |

---

## Known Issues and Quirks

1. **Inconsistent drag-drop libraries**: `Sidebar.tsx` uses `@dnd-kit` while `FeaturesTabContent.tsx` uses native HTML5 drag API.

2. **PM action parsing is fragile**: Relies on string matching of AI output with `ACTION:` prefix and `key="value"` format.

3. **Three tabs appear stubbed**: `ContextTabContent`, `MemoryTabContent`, `LiveMapTabContent` need verification of implementation completeness.

4. **Stale status detection**: `GitActionsControl` has logic to detect when git status is out of sync with branch list, triggering re-fetch.

5. **Orphaned worktree handling**: `Sidebar.tsx` `deleteThread()` has sophisticated logic to detect and optionally remove orphaned worktrees.

6. **Feature-thread links**: Many-to-many relationship managed via `api.featureThreadLinks.getLinks()`, separate from main thread state.

7. **Terminal link detection**: Uses `extractTerminalLinks()` which handles both URLs and file paths, with `resolvePathLinkTarget()` for path resolution.

8. **i18n coverage**: `GitActionsControl` and `PlanSidebar` have Farsi translations; most other components have English-only strings with `language === "fa"` checks scattered.

9. **Worktree mode complexity**: `resolveEffectiveEnvMode()`, `resolveDraftEnvModeAfterBranchChange()` handle complex state transitions between local and worktree environments.

10. **Default branch detection**: Uses both `branch.isDefault` flag AND hardcoded check for "main"/"master" names.

---

## Testing Coverage

- `Sidebar.logic.test.ts` - Tests for sidebar helper functions
- `ProjectScriptsControl.logic.test.ts` - Validation logic tests
- `BranchToolbar.logic.test.ts` - Branch resolution logic tests
- `GitActionsControl.logic.test.ts` - Git action logic tests (if present)

---

## Dependencies Summary

### Key NPM Packages
- `@tanstack/react-query` - Server state
- `@tanstack/react-virtual` - Virtual list for branches
- `@dnd-kit/core`, `@dnd-kit/sortable` - Drag and drop
- `@xterm/xterm`, `@xterm/addon-fit` - Terminal emulator
- `zustand` - Client state
- `lucide-react` - Icons
- `react-router` - Navigation

### Internal Packages
- `@t3tools/contracts` - Shared types (ThreadId, ProjectId, GitBranch, etc.)
- `@t3tools/shared` - Shared utilities (`@t3tools/shared/git`)
