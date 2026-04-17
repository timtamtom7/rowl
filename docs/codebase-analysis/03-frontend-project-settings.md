# Rowl Frontend: Project Features, Dashboard, Onboarding, Settings & UI Primitives

## Table of Contents
1. [Project Dashboard](#1-project-dashboard)
2. [Project Setup Wizard](#2-project-setup-wizard)
3. [Permission Policies Section](#3-permission-policies-section)
4. [Appearance Settings Section](#4-appearance-settings-section)
5. [Route Files](#5-route-files)
6. [Hooks: Thread & Project Creation](#6-hooks-thread--project-creation)
7. [React Query Libraries](#7-react-query-libraries)
8. [Project Scripts & Command Templates](#8-project-scripts--command-templates)
9. [App Settings & Session Logic](#9-app-settings--session-logic)
10. [Thread Forking & Export](#10-thread-forking--export)
11. [Notifications, Keybindings, Language & Branding](#11-notifications-keybindings-language--branding)
12. [UI Primitives Catalog](#12-ui-primitives-catalog)
13. [Cross-Cutting Patterns & Architecture](#13-cross-cutting-patterns--architecture)

---

## 1. Project Dashboard

### `apps/web/src/components/dashboard/ProjectDashboard.tsx`

**What it does:**
A full-featured dashboard view for a single Rowl project, showing project health, active goals, recent features/memories, context budget usage, agent status, and source file overview. It serves as the "home base" after opening a project.

**Data flow:**
- **In:** `useProject` hook (React Query) fetches project metadata; `useSidebarData` fetches goals, features, memories, context nodes, health, agents, source files
- **Out:** User actions dispatch via `useProjectActions` (start goal, add feature, run command, create worktree, fork thread, share, etc.)
- **Query invalidation:** On mutations, `projectQueryKeys.detail(id)` and `sidebarQueryKeys.all` are invalidated to refresh data

**Backend connection:**
- Reads from `projectQueryKeys.detail(id)` → `GET /projects/:id` (through `useProject`)
- Reads from multiple `sidebarQueryKeys.*` → various `/projects/:id/*` endpoints
- Writes via `useProjectActions` → `projectApi` endpoints (start goal, add feature, fork thread, share)
- Uses `useServerSync` for real-time sync status display

**Implementation status:**
| Feature | Status |
|---------|--------|
| Project header with health indicator | ✅ Fully implemented |
| Active goals panel | ✅ Fully implemented |
| Recent features & memories | ✅ Fully implemented |
| Context budget visualization | ✅ Fully implemented |
| Agent status cards | ✅ Fully implemented |
| Source file tree | ✅ Fully implemented |
| Quick actions toolbar | ✅ Fully implemented |
| Empty states | ✅ Fully implemented |

**Notable patterns/quirks:**
- Uses compound component pattern: `<ProjectDashboard><ProjectDashboard.Header>...</ProjectDashboard.Header>`
- Health display shows aggregate status (healthy/warning/critical) based on `healthQuery.data.status`
- Source files show worktree diffs with `dirty: boolean` indicator
- Agents show tool-call statistics via `agent.stats`
- Inline "Add Feature" flow uses optimistic updates

---

## 2. Project Setup Wizard

### `apps/web/src/components/chat/ProjectSetupWizard.tsx`

**What it does:**
A multi-step wizard that guides users through creating a new Rowl project: selecting a template, naming the project, choosing a worktree strategy, configuring agents, and setting initial goals. It replaces the need for manual project scaffolding.

**Data flow:**
- **In:** `useTemplates` hook fetches available project templates; `useProviders` fetches LLM provider options
- **Out:** `useProjectCreationActions` handles the actual creation mutation; results in `router.push("/chat/{projectId}")`
- **State:** Local `useState` for wizard step navigation and form field values

**Backend connection:**
- `GET /templates` via `useTemplates` React Query hook
- `GET /providers` via `useProviders` React Query hook
- `POST /projects` via `useProjectCreationActions().createProject` mutation
- `POST /projects/:id/share` via `useProjectCreationActions().createShareLink`

**Implementation status:**
| Step | Status |
|------|--------|
| Template selection | ✅ Fully implemented |
| Project naming & config | ✅ Fully implemented |
| Worktree strategy | ⚠️ Partially implemented (UI present, backend may be stubbed) |
| Agent configuration | ⚠️ Partially implemented (UI present, agent assignment may be stubbed) |
| Initial goals setup | ⚠️ Partially implemented (UI present, goal creation may be stubbed) |
| Wizard navigation (back/next) | ✅ Fully implemented |
| Progress indicator | ✅ Fully implemented |

**Notable patterns/quirks:**
- Multi-step form uses `currentStep` state variable
- Template cards show preview information and "Use Template" action
- Project name input has validation (likely length/slug constraints)
- Worktree strategy shows `createWorktree` mutation button but may not be fully wired
- Returns a `wizardResult` with `projectId` and `shareId` on completion
- Uses `Sheet` component for the modal overlay

---

## 3. Permission Policies Section

### `apps/web/src/components/settings/PermissionPoliciesSection.tsx`

**What it does:**
Settings UI for managing Rowl's permission policy system. Allows users to configure what operations require explicit user approval vs. auto-approve. Displays permission categories (execution, file system, network, etc.) with toggles for each.

**Data flow:**
- **In:** `usePermissionPolicies` hook fetches current policy configuration
- **Out:** `usePermissionPolicies` mutation (updatePolicy) sends updated config to backend
- **Query invalidation:** `permissionQueryKeys.policies()` invalidated on update

**Backend connection:**
- `GET /projects/:id/permission-policies` via `usePermissionPolicies`
- `PUT /projects/:id/permission-policies` via mutation

**Implementation status:**
| Feature | Status |
|---------|--------|
| Permission category display | ✅ Fully implemented |
| Toggle individual permissions | ✅ Fully implemented |
| Policy presets (strict/relaxed) | ⚠️ May be stubbed — preset buttons present but unclear if wired |
| Policy conflict resolution | ⚠️ May be stubbed — no visible conflict handling UI |
| Save/discard changes | ✅ Fully implemented |

**Notable patterns/quirks:**
- Uses `Toggle` component for individual permission toggles
- Groups permissions by category (execution, file system, network, system)
- Has `onToggle` callback pattern for individual toggles
- `PolicyId` type imported from `@t3tools/contracts`
- Shows "approved" vs "requires approval" state visually

---

## 4. Appearance Settings Section

### `apps/web/src/components/AppearanceSettingsSection.tsx`

**What it does:**
Settings UI for customizing the Rowl web app's visual appearance: theme (light/dark/system), font size, spacing, accent color, and sidebar density.

**Data flow:**
- **In:** Reads from `appSettings` (local storage + React state) via `useAppSettings()`
- **Out:** Writes to `appSettings` (local storage) — no backend calls
- **Persistence:** Settings stored in `localStorage` under `app-settings` key

**Backend connection:**
- None — purely client-side settings

**Implementation status:**
| Setting | Status |
|---------|--------|
| Theme selection | ✅ Fully implemented |
| Font size slider | ✅ Fully implemented |
| Spacing slider | ✅ Fully implemented |
| Accent color picker | ⚠️ May be stubbed — color picker UI present but may not persist |
| Sidebar density (compact/default) | ✅ Fully implemented |
| Reset to defaults | ✅ Fully implemented |

**Notable patterns/quirks:**
- Uses `RadioGroup` for theme selection (System/Light/Dark)
- Uses `Slider` component for font size and spacing
- Uses `Select` for density options
- Settings are persisted to `localStorage` immediately on change
- No API calls — purely client-side preference storage
- Uses `AppearanceSettingsSection` as a section component within a larger settings page

---

## 5. Route Files

### `apps/web/src/routes/_chat.tsx`

**What it does:**
Root layout for all chat-related routes. Provides the sidebar, chat area, and sheet overlay structure. Handles project-level route params and session management.

**Data flow:**
- **In:** Route params: `projectId` (required), `shareId` (optional), `threadId` (optional via child routes)
- **Out:** Renders child routes via `<Outlet />`
- **Context:** Provides `projectId` and `shareId` to child routes via TanStack Router's `useParams`

**Backend connection:**
- Uses `useProject` hook to prefetch project data
- Uses `useServerSync` for connection status

**Implementation status:**
| Feature | Status |
|---------|--------|
| Sidebar rendering | ✅ Fully implemented |
| Chat area container | ✅ Fully implemented |
| Sheet overlay support | ✅ Fully implemented |
| Project context provision | ✅ Fully implemented |
| Share mode indicator | ✅ Fully implemented |
| Session idle detection | ✅ Fully implemented |

**Notable patterns/quirks:**
- Uses `Sidebar` component for the project sidebar
- Sheet overlays rendered via `Sheet` component
- Child routes use `_chat.index.tsx`, `_chat.settings.tsx`, etc.
- Share mode changes the UI to read-only banner
- Idle detection triggers session timeout warning

---

### `apps/web/src/routes/_chat.index.tsx`

**What it does:**
Default landing page for a project chat. Shows the project dashboard if no thread is selected, or the last active thread. Handles new thread creation and displays the welcome/onboarding state.

**Data flow:**
- **In:** `projectId` from parent route params; `useLastActiveThread` for resuming previous thread
- **Out:** `useNewThread` hook for creating new threads; `router.push` to thread route on selection

**Backend connection:**
- `useLastActiveThread` → likely reads from `localStorage` or has a backend endpoint

**Implementation status:**
| Feature | Status |
|---------|--------|
| Project dashboard display | ✅ Fully implemented |
| Last active thread resume | ✅ Fully implemented |
| New thread creation | ✅ Fully implemented |
| Welcome/onboarding state | ✅ Fully implemented |
| Thread list display | ⚠️ May be stubbed — thread list shown but likely from local state |

**Notable patterns/quirks:**
- If `lastThreadId` exists, redirects to `/chat/{projectId}/{lastThreadId}`
- Otherwise renders `ProjectDashboard` as the landing view
- Uses `useNewThread` hook for the create action
- Welcome state uses `OnboardingCard` component for first-time users

---

### `apps/web/src/routes/_chat.settings.tsx`

**What it does:**
Settings page for a project. Renders various settings sections: Appearance, Permission Policies, Provider Config, Agent Config, etc.

**Data flow:**
- **In:** `projectId` from parent route params; settings hooks for each section
- **Out:** Settings mutations go to respective API endpoints

**Backend connection:**
- Uses `usePermissionPolicies` for permission settings
- Uses `useProject` for project-level settings
- Uses `useProviders` for provider settings
- Uses `useAgents` for agent settings

**Implementation status:**
| Section | Status |
|---------|--------|
| Appearance settings | ✅ Fully implemented |
| Permission policies | ✅ Fully implemented |
| Provider configuration | ⚠️ Partially implemented |
| Agent configuration | ⚠️ Partially implemented |
| Project metadata | ✅ Fully implemented |
| Danger zone (delete project) | ⚠️ May be stubbed |

**Notable patterns/quirks:**
- Settings sections rendered as cards with headers
- Uses `Separator` between major sections
- Settings page accessible via `/chat/{projectId}/settings`
- Breadcrumb or back navigation provided

---

### `apps/web/src/routes/__root.tsx`

**What it does:**
Root layout for the entire Rowl web application. Sets up global providers (Toast, Theme, QueryClient, Router), renders the main content area, and handles global error states.

**Data flow:**
- **In:** None — this is the top-level layout
- **Out:** Renders child routes via `<Outlet />`
- **Providers:** Initializes ToastProvider, QueryClient, ThemeProvider

**Backend connection:**
- None directly — global setup only

**Implementation status:**
| Feature | Status |
|---------|--------|
| Toast provider setup | ✅ Fully implemented |
| QueryClient setup | ✅ Fully implemented |
| Theme provider setup | ✅ Fully implemented |
| Global layout rendering | ✅ Fully implemented |
| Global error boundary | ✅ Fully implemented |
| Loading state | ✅ Fully implemented |

**Notable patterns/quirks:**
- Uses `ToastProvider` from UI components
- Uses `AnchoredToastProvider` for anchored toasts
- Sets up TanStack Router at the app root
- Loading state shows full-screen `Spinner`
- Error boundary catches and displays errors gracefully

---

### `apps/web/src/routes/shared.$shareId.tsx`

**What it does:**
Public read-only view for shared threads. Allows anyone with a share link to view a thread's conversation without needing to log in or have project access.

**Data flow:**
- **In:** `shareId` from route params
- **Out:** Read-only — no mutations
- **Data fetching:** `useSharedThread` hook fetches thread data by share ID

**Backend connection:**
- `GET /shared/{shareId}` via `useSharedThread`

**Implementation status:**
| Feature | Status |
|---------|--------|
| Share link resolution | ✅ Fully implemented |
| Read-only thread view | ✅ Fully implemented |
| Shared content display | ✅ Fully implemented |
| Login prompt for actions | ✅ Fully implemented |
| Share metadata display | ✅ Fully implemented |

**Notable patterns/quirks:**
- Read-only mode: input fields disabled, action buttons hidden
- Shows "Shared by {user}" attribution
- Banner indicates this is a shared view
- Comments/reactions may be hidden or stubbed
- No project sidebar shown — just the thread view

---

## 6. Hooks: Thread & Project Creation

### `apps/web/src/hooks/useNewThread.ts`

**What it does:**
Hook for creating a new thread within a project. Handles the thread creation mutation and returns the new thread ID.

**Data flow:**
- **In:** `projectId` (required), optional initial message or context
- **Out:** `createThread(projectId, options)` returns `Thread` object with `id`
- **Side effects:** Invalidates `threadQueryKeys.list(projectId)` on success

**Backend connection:**
- `POST /projects/{projectId}/threads` via `threadApi.createThread`

**Implementation status:**
| Feature | Status |
|---------|--------|
| Thread creation | ✅ Fully implemented |
| Thread ID return | ✅ Fully implemented |
| Query invalidation | ✅ Fully implemented |
| Error handling | ✅ Fully implemented |
| Optimistic updates | ⚠️ May be stubbed |

**Notable patterns/quirks:**
- Returns `threadId` directly for use in navigation
- Uses `threadApi` from `~/lib/threadApi`
- Clears `threadId` in local storage after use (prevents duplicate creation)

---

### `apps/web/src/hooks/useHandleNewThread.ts`

**What it does:**
Handler hook that orchestrates the full new thread flow: creates the thread, sets it as the active thread, and optionally sends an initial message.

**Data flow:**
- **In:** `projectId`, optional initial message content
- **Out:** Navigates to `/chat/{projectId}/{newThreadId}` on success
- **Side effects:** Sets new thread as "last active" in localStorage

**Backend connection:**
- Uses `useNewThread` internally → `POST /projects/{projectId}/threads`

**Implementation status:**
| Feature | Status |
|---------|--------|
| Thread creation | ✅ Fully implemented |
| Navigation to new thread | ✅ Fully implemented |
| Last active thread tracking | ✅ Fully implemented |
| Initial message sending | ⚠️ May be stubbed |
| Error handling | ✅ Fully implemented |

**Notable patterns/quirks:**
- Returns a `handleNewThread` function for use in click handlers
- Sets `lastThreadId` in localStorage for session resumption
- Navigates using `router.push()`
- May be called from keyboard shortcut (Ctrl+N) or UI button

---

### `apps/web/src/hooks/useProjectCreationActions.ts`

**What it does:**
Aggregated hook for all project-level write operations: create project, update project, delete project, create share link, etc.

**Data flow:**
- **In:** Various params depending on action
- **Out:** Mutation results with invalidation

**Backend connection:**
- `POST /projects` → create
- `PUT /projects/:id` → update
- `DELETE /projects/:id` → delete
- `POST /projects/:id/share` → create share link

**Implementation status:**
| Action | Status |
|--------|--------|
| Create project | ✅ Fully implemented |
| Update project metadata | ✅ Fully implemented |
| Delete project | ⚠️ May be stubbed — danger zone UI likely |
| Create share link | ✅ Fully implemented |
| Fork project | ⚠️ Partially implemented |

**Notable patterns/quirks:**
- Returns individual handlers: `createProject`, `updateProject`, `deleteProject`, `createShareLink`, `forkProject`
- Invalidates `projectQueryKeys.all` on mutations
- Uses `router.push` to navigate to new project after creation

---

## 7. React Query Libraries

### `apps/web/src/lib/projectReactQuery.ts`

**What it does:**
React Query hooks for project CRUD operations and metadata fetching.

**Key exports:**
- `useProjects` — list all projects for the current user
- `useProject(id)` — fetch single project details
- `useProjectHealth(id)` — fetch project health metrics
- `useProjectStats(id)` — fetch project statistics

**Data flow:**
- Reads from `projectApi` endpoints
- Uses `projectQueryKeys` for cache keys
- Configurable `staleTime` per query

**Backend connection:**
- `GET /projects`
- `GET /projects/:id`
- `GET /projects/:id/health`
- `GET /projects/:id/stats`

**Implementation status:** ✅ Fully implemented

---

### `apps/web/src/lib/threadReactQuery.ts`

**What it does:**
React Query hooks for thread management within a project.

**Key exports:**
- `useThreads(projectId)` — list all threads for a project
- `useThread(projectId, threadId)` — fetch single thread
- `useThreadMessages(projectId, threadId)` — fetch messages for a thread
- `useThreadStats(projectId, threadId)` — fetch thread statistics

**Data flow:**
- Thread list uses `threadQueryKeys.list(projectId)`
- Single thread uses `threadQueryKeys.detail(projectId, threadId)`
- Messages use `threadQueryKeys.messages(projectId, threadId)`

**Backend connection:**
- `GET /projects/{id}/threads`
- `GET /projects/{id}/threads/{threadId}`
- `GET /projects/{id}/threads/{threadId}/messages`
- `GET /projects/{id}/threads/{threadId}/stats`

**Implementation status:** ✅ Fully implemented

---

### `apps/web/src/lib/providerReactQuery.ts`

**What it does:**
React Query hooks for LLM provider configuration.

**Key exports:**
- `useProviders` — list available providers
- `useProvider(id)` — fetch provider details
- `useProviderModels(providerId)` — list models for a provider

**Data flow:**
- Provider selection stored in project settings
- Model list depends on selected provider

**Backend connection:**
- `GET /providers`
- `GET /providers/:id`
- `GET /providers/:id/models`

**Implementation status:** ⚠️ Partially implemented — provider list UI present, model selection may need work

---

### `apps/web/src/lib/serverReactQuery.ts`

**What it does:**
React Query hooks for server/machine management.

**Key exports:**
- `useServers` — list connected servers
- `useServer(id)` — fetch server details
- `useServerStatus(id)` — fetch real-time server status

**Data flow:**
- Server status polled at regular intervals
- Uses `serverQueryKeys` for cache management

**Backend connection:**
- `GET /servers`
- `GET /servers/:id`
- `GET /servers/:id/status`

**Implementation status:** ✅ Fully implemented

---

### `apps/web/src/lib/sidebarReactQuery.ts` (365 lines)

**What it does:**
Comprehensive React Query hooks for all sidebar-related data: goals, features, memories, context nodes, context budget, project health, agents, and source files.

**Key exports:**
- `useGoals(projectId)` — list and manage project goals
- `useFeatures(projectId)` — list project features
- `useMemories(projectId)` — list project memories
- `useContextNodes(projectId)` — list context nodes
- `useContextBudget(projectId)` — fetch context budget info
- `useProjectHealth(projectId)` — fetch health data
- `useAgents(projectId)` — list project agents
- `useSourceFiles(projectId)` — list source files with worktree info

**Mutations included:**
- `useAddFeature` — add a new feature
- `useUpdateFeature` — update feature details
- `useDeleteFeature` — remove a feature
- `useAddGoal` — create a new goal
- `useUpdateGoal` — update goal status/details
- `useDeleteGoal` — remove a goal
- `useAddMemory` — create a memory
- `useDeleteMemory` — remove a memory
- `useAddContextNode` — add a context node
- `useDeleteContextNode` — remove a context node
- `useSetGoalStatus` — set goal status (active, paused, completed)

**Data flow:**
- All queries use `sidebarQueryKeys.*` for consistent cache keys
- Bulk invalidation via `sidebarQueryKeys.all` on mutations
- `staleTime: SIDEBAR_STALE_TIME (5000ms)` for most queries
- Health query uses `staleTime: 30000ms`

**Backend connection:**
- `GET /projects/{id}/goals`
- `POST /projects/{id}/goals`
- `PUT /projects/{id}/goals/{goalId}`
- `DELETE /projects/{id}/goals/{goalId}`
- `GET /projects/{id}/features`
- `POST /projects/{id}/features`
- `PUT /projects/{id}/features/{featureId}`
- `DELETE /projects/{id}/features/{featureId}`
- `GET /projects/{id}/memories`
- `POST /projects/{id}/memories`
- `DELETE /projects/{id}/memories/{memoryId}`
- `GET /projects/{id}/context-nodes`
- `POST /projects/{id}/context-nodes`
- `DELETE /projects/{id}/context-nodes/{nodeId}`
- `GET /projects/{id}/context-budget`
- `GET /projects/{id}/health`
- `GET /projects/{id}/agents`
- `GET /projects/{id}/source-files`

**Implementation status:**
| Feature | Status |
|---------|--------|
| Goals CRUD | ✅ Fully implemented |
| Features CRUD | ✅ Fully implemented |
| Memories CRUD | ✅ Fully implemented |
| Context nodes CRUD | ✅ Fully implemented |
| Context budget display | ✅ Fully implemented |
| Health display | ✅ Fully implemented |
| Agent list | ✅ Fully implemented |
| Source files with worktree | ✅ Fully implemented |

**Notable patterns/quirks:**
- Most mutations use optimistic updates
- `SIDEBAR_STALE_TIME = 5000ms` as a named constant
- Health uses longer stale time (30000ms) since it changes less frequently
- Source files show `dirty` boolean for unsaved changes
- Worktree path shown for each source file
- Agents show tool call statistics

---

## 8. Project Scripts & Command Templates

### `apps/web/src/projectScripts.ts` (88 lines)

**What it does:**
Utility functions for managing Rowl project scripts: normalizing script IDs, parsing script commands, resolving script runtimes, and identifying primary vs. setup scripts.

**Key exports:**
- `normalizeScriptId(id)` — ensure script ID is valid (max 63 chars, lowercase alphanumeric + hyphens, slugified)
- `parseScriptCommand(command)` — extract script ID and action from command string
- `getScriptRuntime(script)` — get runtime environment for a script
- `getPrimaryScript(scripts)` — find the primary (main) script from a list
- `getSetupScript(scripts)` — find the setup/initialization script
- `getScriptEnv(script)` — get environment variables for a script

**Data flow:**
- Input: Script objects with `id`, `command`, `env`, `runtime`
- Output: Normalized strings, parsed objects, resolved runtime info

**Backend connection:**
- Uses `ensureNativeApi()` to call native APIs for script operations
- `MAX_SCRIPT_ID_LENGTH` imported from `@t3tools/contracts`
- `SCRIPT_RUN_COMMAND_PATTERN` imported from `@t3tools/contracts` (pattern: `script.<id>.run`)

**Implementation status:** ✅ Fully implemented

**Notable patterns/quirks:**
- Script ID normalization: truncates to 63 chars, lowercases, removes invalid chars, slugifies
- Deduplicates hyphens (multiple `---` becomes single `-`)
- Runtime env keys: `ROWL_PROJECT_ROOT`, `ROWL_WORKTREE_PATH`
- Primary script identified by having no `setup` label
- Setup script identified by `setup: true` in labels

---

### `apps/web/src/projectScripts.test.ts`

**What it does:**
Unit tests for projectScripts.ts covering ID normalization, command parsing, and script resolution.

**Implementation status:** ✅ Fully implemented — tests exist

---

### `apps/web/src/projectCommandTemplates.ts` (74 lines)

**What it does:**
Handles expansion of command templates with placeholders. Supports positional placeholders ($1-$9), named placeholders, and special $ARGUMENTS placeholder.

**Key exports:**
- `expandCommandTemplate(template, args)` — expand a command template with provided arguments
- `getPlaceholderNames(template)` — extract all placeholder names from a template
- `validateTemplate(template)` — check if a template is well-formed

**Data flow:**
- Input: Template string like `npm run build -- --flag $1` and args array
- Output: Expanded string with placeholders replaced

**Backend connection:**
- None — purely string manipulation

**Implementation status:** ✅ Fully implemented

**Notable patterns/quirks:**
- Positional placeholders: $1 through $9
- Special `$ARGUMENTS` placeholder for passing all remaining args
- `$0` refers to the script ID itself
- If a placeholder is missing, it's left as-is in the output
- Templates validated for matching brackets/braces

---

### `apps/web/src/projectCommandTemplates.test.ts`

**What it does:**
Unit tests for command template expansion covering positional args, named args, and $ARGUMENTS.

**Implementation status:** ✅ Fully implemented — tests exist

---

## 9. App Settings & Session Logic

### `apps/web/src/appSettings.ts`

**What it or it does:**
Manages Rowl web app settings persisted to localStorage: theme, font size, spacing, density, and other UI preferences.

**Key exports:**
- `getAppSettings()` — retrieve all settings from localStorage
- `setAppSetting(key, value)` — update a single setting
- `resetAppSettings()` — reset all settings to defaults
- `AppSettings` type with all setting fields

**Data flow:**
- Reads/writes to `localStorage` under `app-settings` key
- Provides defaults if localStorage is empty or corrupted
- Settings: `theme`, `fontSize`, `spacing`, `density`, `accentColor`, etc.

**Backend connection:**
- None — purely client-side localStorage persistence

**Implementation status:** ✅ Fully implemented

**Notable patterns/quirks:**
- Uses `try/catch` around localStorage access for SSR safety
- Provides TypeScript types for all settings
- Default values defined as constants
- Includes validation for numeric settings (fontSize, spacing)

---

### `apps/web/src/appSettings.test.ts`

**What it does:**
Unit tests for appSettings.ts covering get, set, reset, and edge cases (empty localStorage, invalid JSON).

**Implementation status:** ✅ Fully implemented — tests exist

---

### `apps/web/src/session-logic.ts`

**What it does:**
Manages Rowl user session state: session creation, session expiry, idle timeout detection, and session metadata.

**Key exports:**
- `createSession()` — create a new session
- `getSession()` — get current session info
- `refreshSession()` — extend session expiry
- `isSessionExpired()` — check if current session has expired
- `isSessionIdle()` — check if user has been idle too long
- `SessionConfig` type with timeout values

**Data flow:**
- Session stored in localStorage with expiry timestamp
- Idle detection based on `document.visibilityState` and user activity events
- Session expiry checked on route changes and periodically

**Backend connection:**
- `POST /auth/session` — create session (likely)
- `POST /auth/session/refresh` — refresh session (likely)

**Implementation status:** ⚠️ Partially implemented — core logic present, backend integration may be stubbed

**Notable patterns/quirks:**
- Session timeout configurable (default likely 30 minutes)
- Idle timeout likely 5 minutes
- Session refresh called on user activity
- Shows "Session expiring soon" warning before actual expiry
- Logout clears session from localStorage and redirects

---

### `apps/web/src/session-logic.test.ts`

**What it does:**
Unit tests for session-logic.ts covering session creation, expiry, idle detection.

**Implementation status:** ✅ Fully implemented — tests exist

---

## 10. Thread Forking & Export

### `apps/web/src/threadForking.ts`

**What it does:**
Handles forking (branching) a thread to create an independent copy. Allows diverging conversation history without affecting the original.

**Key exports:**
- `forkThread(projectId, threadId)` — create a forked copy of a thread
- `getForkSource(threadId)` — get the original thread if current is a fork
- `getForkDepth(threadId)` — get how many times a thread has been forked

**Data flow:**
- Input: `projectId` and `threadId` to fork
- Output: New thread object with reference to original
- Fork metadata stored in thread object

**Backend connection:**
- `POST /projects/{id}/threads/{threadId}/fork` via `threadApi.forkThread`

**Implementation status:** ⚠️ Partially implemented — fork functionality UI present in ProjectDashboard, may need backend work

**Notable patterns/quirks:**
- Fork creates a deep copy of all messages
- Fork metadata tracks lineage (`forkedFrom: threadId`)
- Forked threads don't sync with original after divergence
- UI shows "Forked from {original}" breadcrumb

---

### `apps/web/src/threadForking.test.ts`

**What it does:**
Unit tests for threadForking.ts covering fork creation and metadata tracking.

**Implementation status:** ✅ Fully implemented — tests exist

---

### `apps/web/src/threadExport.ts`

**What it does:**
Exports thread conversations to various formats: Markdown, JSON, HTML, PDF.

**Key exports:**
- `exportThread(projectId, threadId, format)` — export to specified format
- `exportThreadToMarkdown(thread)` — convert thread to Markdown
- `exportThreadToJSON(thread)` — convert thread to JSON
- `getExportFilename(thread, format)` — generate filename for export

**Data flow:**
- Input: Thread object and desired format
- Output: Blob/file to download
- Uses `URL.createObjectURL` for download

**Backend connection:**
- May use backend for PDF generation
- Markdown/JSON can be client-side

**Implementation status:** ⚠️ Partially implemented — Markdown/JSON likely work, PDF may be stubbed

**Notable patterns/quirks:**
- Markdown export includes message timestamps and author
- JSON export includes full message metadata
- Filename format: `rowl-thread-{threadId}-{date}.{format}`
- Uses `triggerDownload` utility

---

### `apps/web/src/threadExport.test.ts`

**What it does:**
Unit tests for threadExport.ts covering format generation and filename creation.

**Implementation status:** ✅ Fully implemented — tests exist

---

## 11. Notifications, Keybindings, Language & Branding

### `apps/web/src/notifications.ts`

**What it does:**
Manages in-app toast notifications and system notifications for async events.

**Key exports:**
- `toast(options)` — show a toast notification
- `toast.error(message)` — show error toast
- `toast.success(message)` — show success toast
- `toast.info(message)` — show info toast
- `toast.loading(message)` — show loading toast
- `toast.dismiss(id)` — dismiss a specific toast
- `toastProvider` — the toast manager instance

**Data flow:**
- Input: Message string and options (duration, action, etc.)
- Output: Toast rendered in UI via ToastProvider
- Supports `threadId` for thread-scoped notifications

**Backend connection:**
- Uses `ThreadId` from `@t3tools/contracts` for toast data
- Native notification API for system notifications (if permission granted)

**Implementation status:** ✅ Fully implemented

**Notable patterns/quirks:**
- Uses `toastManager` and `anchoredToastManager` from `@base-ui/react/toast`
- `anchoredToastManager` supports `dismissAfterVisibleMs` option
- `TOAST_ICONS` map: error=CircleAlertIcon, info=InfoIcon, loading=LoaderCircleIcon, success=CircleCheckIcon, warning=TriangleAlertIcon
- Toast data includes `threadId: string` from `@t3tools/contracts`
- Auto-dismiss configurable per toast

---

### `apps/web/src/keybindings.ts`

**What it does:**
Global keyboard shortcuts for power users: new thread (Ctrl+N), send message (Enter), newline in message (Shift+Enter), open command palette (Ctrl+K), etc.

**Key exports:**
- `keybindings` — map of action to key combo
- `handleKeydown(event)` — global keydown handler
- `isKeybindingPressed(keys)` — check if specific combo is active

**Data flow:**
- Listens on `document` for `keydown` events
- Dispatches actions based on current route/context
- Prevents default browser behavior for mapped shortcuts

**Backend connection:**
- None — purely client-side

**Implementation status:** ✅ Fully implemented

**Notable patterns/quirks:**
- Some shortcuts context-dependent (e.g., Ctrl+Enter in message input)
- Conflicts with native browser shortcuts handled
- Keybinding display in UI (e.g., command palette shows shortcuts)
- `keybindings.test.ts` tests exist

---

### `apps/web/src/appLanguage.ts`

**What it does:**
Handles internationalization (i18n) for the Rowl web app: language detection, locale switching, and translation string retrieval.

**Key exports:**
- `getLocale()` — get current locale
- `setLocale(locale)` — set locale and persist
- `t(key, params?)` — translate a string key
- `detectLocale()` — detect from browser/system

**Data flow:**
- Locale stored in localStorage and cookie
- Uses translation files loaded async
- Supports: en, es, fr, de, ja, zh (likely)

**Backend connection:**
- Locale preference synced to backend for personalization
- `GET /users/{id}/locale` for loading saved preference

**Implementation status:** ⚠️ Partially implemented — core logic present, translation strings may be incomplete

**Notable patterns/quirks:**
- Uses `Intl` API for number/date formatting per locale
- Lazy loads translation files (not all bundled)
- `appLanguage.test.ts` tests exist
- RTL support for applicable languages

---

### `apps/web/src/branding.ts`

**What it does:**
Centralized branding constants for Rowl: app name, tagline, URLs, version info, and asset paths.

**Key exports:**
- `BRAND_NAME` — "Rowl"
- `BRAND_TAGLINE` — "AI-powered development"
- `BRAND_URL` — primary website URL
- `BRAND_DOCS_URL` — documentation URL
- `BRAND_VERSION` — current app version
- `ASSET_PATHS` — paths to logos, icons, etc.

**Data flow:**
- Constants only — no runtime data flow

**Backend connection:**
- None

**Implementation status:** ✅ Fully implemented

**Notable patterns/quirks:**
- Single source of truth for all branding
- Version from `package.json` at build time
- Asset paths include CDN URLs for caching

---

## 12. UI Primitives Catalog

### Overview

All UI primitives are built on top of `@base-ui/react` components. They follow consistent patterns:
- `"use client"` directive on all components
- `data-slot` attributes for styling targeting
- `cn` utility from `~/lib/utils` for className composition
- Consistent prop patterns using Base UI primitives

### Button Components

**`apps/web/src/components/ui/button.tsx`**
- **Variants:** `default`, `destructive`, `ghost`, `outline`, `secondary`, `link`
- **Sizes:** `sm`, `md`, `lg`, `icon`
- **Compound pattern:** Includes `Button.RenamedIcon` export for icon-only buttons
- **Features:** `disabled` state, `onClick` handler, `render` prop support, loading state via `disabled` or spinner
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/icon-button.tsx`**
- Icon-only button variant with proper accessibility
- Uses `Tooltip` for accessibility label
- **Status:** ✅ Fully implemented

---

### Dialog & Sheet

**`apps/web/src/components/ui/dialog.tsx`**
- Modal dialog using `Dialog.Animated` from Base UI
- Props: `open`, `onOpenChange`, `children`
- Compound components: `Dialog.Trigger`, `Dialog.Content`, `Dialog.Header`, `Dialog.Title`, `Dialog.Description`, `Dialog.Footer`, `Dialog.Close`
- Backdrop dismiss supported
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/sheet.tsx`**
- Slide-out panel (side sheet) using `Dialog` primitive
- Positions: `top`, `bottom`, `left`, `right`
- Compound: `Sheet.Trigger`, `Sheet.Content`, `Sheet.Header`, `Sheet.Title`, `Sheet.Description`, `Sheet.Footer`, `Sheet.Close`
- Uses `Sheet.Animated` for smooth transitions
- **Status:** ✅ Fully implemented

---

### Form Inputs

**`apps/web/src/components/ui/input.tsx`**
- Text input using `FieldPrimitive` from Base UI
- Includes `Input.RenamedIcon` export for icon-prefixed inputs
- Supports: `disabled`, `readOnly`, `placeholder`, `type`
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/textarea.tsx`**
- Multi-line text input using `FieldPrimitive` from Base UI
- Includes `Textarea.RenamedIcon` export
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/select.tsx`**
- Custom select using Base UI primitives
- Compound: `Select.Trigger`, `Select.Value`, `Select.Content`, `Select.Item`, `Select.ItemText`, `Select.Separator`
- Supports `disabled`, `placeholder`
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/checkbox.tsx`**
- Checkbox using `FieldPrimitive`
- Includes `Checkbox.RenamedIcon` export
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/switch.tsx`**
- Toggle switch using Base UI `Switch` primitive
- Props: `checked`, `onCheckedChange`, `disabled`
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/toggle.tsx`**
- Toggle button (pressable button that stays pressed)
- Props: `pressed`, `onPressedChange`, `disabled`
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/toggle-group.tsx`**
- Group of toggle buttons for single/multi selection
- Compound: `ToggleGroup`, `ToggleGroup.Item`
- Props: `value`, `onValueChange`, `type` (single/multiple)
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/radio-group.tsx`**
- Radio button group
- Compound: `RadioGroup`, `Radio`, `Radio as RadioGroupItem`
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/fieldset.tsx`**
- Form fieldset grouping
- Compound: `Fieldset`, `FieldsetLegend`
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/label.tsx`**
- Form label using `useRender` and `mergeProps`
- Uses `LabelPrimitive` from Base UI
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/form.tsx`**
- Form wrapper using `FormPrimitive` from Base UI
- **Status:** ✅ Fully implemented

---

### Navigation & Overlay

**`apps/web/src/components/ui/menu.tsx`**
- Dropdown menu using `Menu.Animated` from Base UI
- Compound: `Menu.Root`, `Menu.Trigger`, `Menu.Content`, `Menu.Item`, `Menu.Separator`, `Menu.Group`, `Menu.Label`
- Supports keyboard navigation, submenus
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/command.tsx`**
- Command palette (Cmd+K style) using `CommandPrimitive` from Base UI
- Compound: `Command`, `Command.Dialog`, `Command.Input`, `Command.List`, `Command.Empty`, `Command.Group`, `Command.Item`, `Command.Separator`, `Command.RenamedIcon`
- Features: fuzzy search, keyboard navigation, grouped commands
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/sidebar.tsx`**
- Application sidebar using Base UI
- Compound: `Sidebar`, `Sidebar.Header`, `Sidebar.Body`, `Sidebar.Footer`
- Supports: collapsible, resize handle
- **Status:** ✅ Fully implemented

---

### Feedback & Status

**`apps/web/src/components/ui/alert.tsx`**
- Alert/notification component with variants
- **Variants:** `default`, `destructive` (error), `info`, `success`, `warning`
- Compound: `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction`
- Uses `AlertCircleIcon`, `InfoIcon`, `CheckCircleIcon`, `TriangleAlertIcon`
- Supports dismissible action
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/badge.tsx`**
- Status badge/label with variants
- **Variants:** `default`, `secondary`, `outline`, `destructive`
- **Sizes:** `sm`, `md`
- Uses `cva` for variant handling
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/spinner.tsx`**
- Loading spinner using `Loader2Icon` from Lucide
- Props: `size`, `className`
- Uses `animate-spin` CSS class
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/toast.tsx`** (411 lines)
- Comprehensive toast notification system
- Uses `toastManager` and `anchoredToastManager` from Base UI
- Compound: `ToastProvider`, `Toast`, `Toast.RenamedIcon`, `Toast.Title`, `Toast.Description`, `AnchoredToastProvider`
- **Features:**
  - `dismissAfterVisibleMs` for auto-dismiss timing
  - Multiple toast types: error, info, loading, success, warning
  - Anchored toasts (fixed position)
  - Toast queue management
- **Status:** ✅ Fully implemented

---

### Layout & Structure

**`apps/web/src/components/ui/card.tsx`** (196 lines)
- Card container with multiple variants
- **Variants:** `default` (with hover shadow), `shadow` (permanent shadow), `outline` (border only)
- Compound components:
  - `Card` — base card with `variant` prop
  - `CardFrame` — simpler frame variant
  - `CardFrameHeader`, `CardFrameTitle`, `CardFrameDescription`, `CardFrameFooter`
  - `CardHeader`, `CardTitle`, `CardDescription`, `CardPanel`, `CardFooter`
- Exports: `Card`, `CardFrame`, `CardHeader`, `CardTitle`, `CardDescription`, `CardPanel`, `CardFooter`, `CardFrameHeader`, `CardFrameTitle`, `CardFrameDescription`, `CardFrameFooter`
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/separator.tsx`**
- Divider/separator using `Separator` from Base UI
- Props: `orientation` (horizontal/vertical), `decorative`
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/scroll-area.tsx`** (68 lines)
- Scrollable container using `ScrollArea` from Base UI
- Compound: `ScrollArea`, `ScrollArea.Viewport`, `ScrollArea.Scrollbar`, `ScrollArea.Thumb`
- Features: custom scrollbar styling, smooth scrolling
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/collapsible.tsx`** (39 lines)
- Collapsible/expandable section using `Collapsible` from Base UI
- Compound: `Collapsible`, `CollapsibleTrigger`, `CollapsiblePanel`
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/kbd.tsx`**
- Keyboard key display component (e.g., for showing shortcuts)
- Renders keyboard key styling
- **Status:** ✅ Fully implemented

---

### Popover & Tooltip

**`apps/web/src/components/ui/popover.tsx`** (108 lines)
- Popover overlay using `Popover.Animated` from Base UI
- Compound: `Popover`, `Popover.Trigger`, `Popover.Content`, `Popover.Popup`, `Popover.Arrow`
- **Features:**
  - `tooltipStyle` prop for inline vs overlay behavior
  - Supports arrow pointing to trigger
  - Accessible via focus and hover
- **Status:** ✅ Fully implemented

---

**`apps/web/src/components/ui/tooltip.tsx`** (59 lines)
- Tooltip overlay using `Tooltip.Animated` from Base UI
- Compound: `Tooltip.Provider`, `Tooltip`, `Tooltip.Trigger`, `Tooltip.Popup`, `Tooltip.Arrow`
- **Features:**
  - `delayMs` for hover delay
  - Accessible via focus and hover
  - Arrow support
- **Status:** ✅ Fully implemented

---

### Unclassified / Additional

**`apps/web/src/components/ui/dropdown-menu.tsx`**
- Dropdown menu (likely a variant of menu or sheet)
- **Status:** Likely implemented

---

## 13. Cross-Cutting Patterns & Architecture

### Component Patterns

**Compound Component Pattern:**
Most components use the compound component pattern where sub-components are nested:
```tsx
<Card>
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Card.Description>Description</Card.Description>
  </Card.Header>
  <Card.Panel>Content</Card.Panel>
  <Card.Footer>Footer</Card.Footer>
</Card>
```

**Render Prop Pattern:**
Some components support a `render` prop for custom rendering:
```tsx
function Label({ className, render, ...props }) {
  return useRender({
    defaultTagName: "label",
    props: mergeProps<"label">(defaultProps, props),
    render,
  });
}
```

**Merge Props Pattern:**
Components use `mergeProps` from `@base-ui/react` to merge default props with user-provided props.

### React Query Patterns

**Query Key Factory:**
Consistent query key structure via `*QueryKeys` objects:
```typescript
export const sidebarQueryKeys = {
  all: () => ["sidebar"] as const,
  goals: (projectId: string) => ["sidebar", "goals", projectId] as const,
  // ...
};
```

**Bulk Invalidation:**
Mutations often invalidate the parent key to refresh all related queries:
```typescript
queryClient.invalidateQueries({ queryKey: sidebarQueryKeys.all() });
```

**Stale Time Configuration:**
- Sidebar queries: `SIDEBAR_STALE_TIME = 5000ms`
- Health queries: `30000ms`

### Native API Pattern

Scripts and native operations use `ensureNativeApi()`:
```typescript
import { ensureNativeApi } from "~/nativeApi";
const nativeApi = ensureNativeApi();
```

### Toast Pattern

Two toast managers for different use cases:
```typescript
// Default toast (rendered inline)
toastManager.add({ title: "Message", type: "info" });

// Anchored toast (fixed position)
anchoredToastManager.add({ title: "Message", type: "success", dismissAfterVisibleMs: 3000 });
```

### Constants

Key constants from `@t3tools/contracts`:
- `MAX_SCRIPT_ID_LENGTH` — max length for script IDs
- `SCRIPT_RUN_COMMAND_PATTERN` — pattern for script run commands (`script.<id>.run`)
- `ThreadId` — type for thread-scoped toast notifications

### Session & Idle Detection

Session managed via localStorage with periodic refresh:
- Idle detection based on `document.visibilityState` and activity events
- Session expiry checked on route changes

### Settings Persistence

Two types of settings:
1. **Client-only** (Appearance): Stored in localStorage via `appSettings.ts`
2. **Server-synced**: Stored in backend via respective React Query mutations

### Export Pattern

Thread export supports multiple formats:
- Markdown: Client-side conversion
- JSON: Client-side conversion  
- PDF: Likely uses backend for generation
