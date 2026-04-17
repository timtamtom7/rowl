# Frontend Chat & Composer Components — Codebase Analysis

**Project:** Rowl
**Date:** 2026-04-13
**Files Analyzed:** 47 files across `apps/web/src/components/chat/`, `apps/web/src/components/ChatView*.tsx`, `ComposerPromptEditor.tsx`, `DiffPanel.tsx`, `DiffPanelShell.tsx`, `DiffWorkerPoolProvider.tsx`, `composer-logic.ts`, `composer-logic.test.ts`, `proposedPlan.ts`, `proposedPlan.test.ts`, `store.ts`, `threadSendQueue.ts`, `threadSendQueue.test.ts`, and route files.

---

## Architecture Overview

Rowl is a Next.js web application with a React-based chat interface. The frontend communicates with a backend via:
- **WebSocket** (`WS_CHANNELS`, `WS_METHODS`, `ORCHESTRATION_WS_METHODS` from `@t3tools/contracts`)
- **Native API** (`readNativeApi()`) for Electron/desktop-specific operations
- **HTTP/REST** via `@tanstack/react-query` hooks (e.g., `serverConfigQueryOptions`, `threadCreateShareMutationOptions`)

The state management uses **Zustand** (`create` from `zustand`) for:
- Global app state (`store.ts`) — projects, threads, session info
- Composer draft state (`composerDraftStore`) — per-thread draft text, images, settings
- Thread send queue (`threadSendQueue`) — queued follow-up turns with "queue" vs "steer" modes
- Terminal state (`terminalStateStore`)
- Thread selection (`threadSelectionStore`)

---

## 1. Routes

### `_chat.tsx` (Layout Route)
**What it does:** Renders the main chat layout with left sidebar, right sidebar, diff panel wrapper, and command palette. Handles global keyboard shortcuts.

**Data flow:**
- Listens to window `keydown` for `chat.new`, `chat.newLocal`, `commandPalette.toggle`, `sidebar.toggle`
- Uses `useHandleNewThread()` hook for thread creation
- `DiffWorkerPoolProvider` wraps the main content area
- `RightSidebarProvider` wraps everything
- Command palette actions include: new chat, new local chat, toggle sidebar, toggle terminal, toggle diff panel, settings, compact thread, search

**Backend connection:** Uses `readNativeApi()` for `threads.compact()` call. Uses `serverConfigQueryOptions()` for keybindings.

**Implementation status:** Fully implemented.

---

### `_chat.$threadId.tsx` (Thread Route)
**What it does:** Renders a specific thread's view with optional diff panel. Handles diff panel mode (inline sidebar vs sheet) based on viewport width.

**Data flow:**
- Reads `threadId` from route params, `diff` from search params
- Checks `threadsHydrated` and thread existence before rendering
- Diff panel can be `inline` (default at >1180px), `sheet` (mobile), or `sidebar` (resizable)
- `DiffPanel` is lazy-loaded via `React.lazy()`
- Manages diff open/close state via URL search params (`diff=1`)
- Has complex resize logic that prevents the diff sidebar from overlapping the composer form

**Backend connection:** None directly (just route rendering).

**Implementation status:** Fully implemented. Has notable resize constraint logic to prevent composer overflow.

---

## 2. Main Chat Components

### `ChatView.tsx` (10,780 lines)
**What it does:** The primary chat view component. Orchestrates the entire thread UI including messages timeline, composer, header, modals, and all thread interactions.

**Data flow:**
- **Props:** `threadId: ThreadId`
- **Store subscriptions:** Multiple Zustand stores via `useStore()` selector — threads, projects, session state
- **Queries:** Uses `@tanstack/react-query` for server config, project agents, skills, templates, git branches, OpenCode state, thread share/undo/redo status
- **Mutations:** Thread compact, share create/revoke, undo, redo
- **Native API:** `readNativeApi()` for orchestration commands, review approve/reject, terminal operations, git operations

**Key sub-components rendered:**
- `ChatHeader` — thread title, project badge, scripts, git actions, diff toggle, right sidebar toggle
- `MessagesTimeline` — virtualized message list
- `ComposerPromptEditor` — the text input with mentions support
- `ThreadGoalStatement` — editable goal field
- `ThreadTasksPanel` — task activity display
- `ProviderHealthBanner` — provider status warnings
- `ThreadErrorBanner` — session error display
- `OverseerAlert` — AI oversight warnings
- `ThreadExportDialog`, `ThreadShareDialog` — modal dialogs
- `UsageDashboardDialog` — usage/cost display
- `ProviderModelPicker` — model selection
- `ComposerSkillPicker` — skill selection
- `FeaturePicker` — feature selection
- `CodexTraitsPicker` — reasoning effort and fast mode
- `PlanSidebar` — plan display
- `ThreadTerminalDrawer` — terminal panel
- `BranchToolbar` — git branch switching

**Backend connections:**
- WS: `orchestration.sendTurn`, `orchestration.sendFollowUp`, `orchestration.interruptTurn`, `orchestration.dispatchCommand`, `orchestration.configureSession`
- WS channels: `orchestration.readModel` (snapshot updates), `orchestration.snapshot.diff` (checkpoint diffs)
- Native API: `api.review.approve/reject`, `api.orchestration.*`, `api.terminal.*`, `api.git.*`, `api.threads.*`, `api.features.*`, `api.scripts.*`
- REST queries: `serverConfigQueryOptions`, `projectSkillsQueryOptions`, `projectAgentsFileQueryOptions`, `gitBranchesQueryOptions`, `threadShareStatusQueryOptions`, `threadRedoStatusQueryOptions`, `serverCopilotReasoningProbeQueryOptions`, `serverOpenCodeStateQueryOptions`

**Implementation status:** Fully implemented. This is the largest and most complex component.

---

### `ChatView.browser.tsx` (2,324 lines)
**What it does:** Vitest browser test suite for `ChatView`. Tests rendering at multiple viewport sizes (desktop, tablet, mobile, narrow).

**Implementation status:** Test suite — not a production component. Tests message row height estimation, timeline virtualization, command menu interactions, approval banners, error banners, and various thread states.

---

### `MessagesTimeline.tsx` (~1,012 lines)
**What it does:** Virtualized timeline of messages, work entries, proposed plans, and working indicators. Uses `@tanstack/react-virtual` for performance.

**Data flow:**
- **Props:** `threadId`, `hasMessages`, `isWorking`, `activeTurnInProgress`, `activeTurnStartedAt`, `scrollContainer`, `timelineEntries` (from `deriveTimelineEntries`), `completionDividerBeforeEntryId`, `turnDiffSummaryByAssistantMessageId`, etc.
- **Timeline entries** come from `deriveTimelineEntries()` in `session-logic`
- **Virtualization:** Uses `useVirtualizer` with dynamic row height estimation
- **Row grouping:** Work entries are grouped together
- **Auto-scroll:** Watches `scrollContainer` for near-bottom detection
- **Image loading:** Re-measures rows when images load via `onTimelineImageLoad`

**Row types:**
- `message` — user or assistant message with markdown rendering
- `work` — grouped work/tool activity entries
- `proposed-plan` — plan card
- `working` — animated indicator when `isWorking && !hasWorkRows`

**Notable patterns:**
- `ALWAYS_UNVIRTUALIZED_TAIL_ROWS = 8` — keeps last 8 rows unvirtualized for stable scroll
- `ResizeObserver` on timeline root for responsive height estimation
- Animation frame debouncing for measure updates
- `shouldAdjustScrollPositionOnItemSizeChange` prevents scroll jump during streaming

**Implementation status:** Fully implemented.

---

### `MessagesTimeline.logic.ts` (84 lines)
**What it does:** Pure logic functions for timeline rendering.

**Exports:**
- `TimelineDurationMessage` — type for messages with duration tracking
- `TimelineWorkTone` — "tool" | "approval" | "info"
- `TimelineWorkEntryVisualState` — "active" | "recent" | "settled" | "error"
- `TimelineRowKindForAnimation` — "message" | "work" | "proposed-plan" | "working" | null
- `computeMessageDurationStart(messages)` — maps message IDs to start timestamps for duration bars
- `normalizeCompactToolLabel(label)` — strips "complete/completed" suffix from tool labels
- `formatWorkingTimer(duration)` — formats durations like "5m 30s", "2h 15m"
- `deriveTimelineWorkEntryVisualState(entry)` — determines if a work entry is active/recent/settled/error based on timestamps
- `shouldAnimateAssistantResponseAfterTool({messageRole, previousRowKind})` — decides if assistant message should animate after a tool

**Implementation status:** Fully implemented. Well-tested via ChatView.browser tests.

---

## 3. Composer Components

### `ComposerPromptEditor.tsx` (~945 lines)
**What it does:** Lexical-based rich text editor for the chat composer. Supports `@file` mentions that render as VS Code-style chips with file icons.

**Data flow:**
- **LexicalComposer** with custom `ComposerMentionNode` for file mentions
- **Props:** `text`, `onTextChange`, `onSend`, `onCancel`, `onExpandMention`, `onCloseMention`, `onCursorChange`, `placeholder`, etc.
- **State:** Internal Lexical editor state, collapsed/expanded cursor position tracking
- **Mention detection:** Uses `detectComposerTrigger()` from `composer-logic.ts`
- **Path resolution:** `projectSearchEntriesQueryOptions` for workspace file search

**Key features:**
- Custom `ComposerMentionNode` extends `TextNode` — stores file path, renders as chip with VS Code icon
- `getVscodeIconUrlForEntry()` for file type icons
- Cursor position tracking handles "collapsed" vs "expanded" state for mentions
- `expandCollapsedComposerCursor()` / `collapseExpandedComposerCursor()` for proper cursor mapping
- Keyboard handling: Enter sends (unless mention is open), Tab autocomplete, arrow keys navigation
- Slash commands: `/model`, `/mcp`, `/plan`, `/new`, `/compact`, `/share`, etc.
- Image attachment support via `ComposerImageAttachment` type

**Backend connection:**
- `projectSearchEntriesQueryOptions` for mention path autocomplete
- `readNativeApi()` for sending (间接 through ChatView)

**Implementation status:** Fully implemented. Complex but complete.

---

### `ComposerCommandMenu.tsx` (120 lines)
**What it does:** Autocomplete dropdown for slash commands, file mentions, and model selection in the composer.

**Data flow:**
- **Props:** `items: ComposerCommandItem[]`, `triggerKind`, `activeItemId`, `onHighlightedItemChange`, `onSelect`
- **Item types:**
  - `path` — file/folder mention with VS Code icon
  - `slash-command` — built-in commands (model, mcp, plan, etc.)
  - `model` — model selection with provider badge

**Implementation status:** Fully implemented. Renders via `Command`/`CommandList` UI primitives.

---

### `CompactComposerControlsMenu.tsx` (136 lines)
**What it does:** Collapsed "more controls" menu for the composer toolbar.

**Data flow:**
- **Props:** `activePlan`, `interactionMode`, `planSidebarOpen`, `runtimeMode`, `selectedEffort`, `selectedProvider`, `selectedCodexFastModeEnabled`, `reasoningOptions`
- **Sections:**
  - Reasoning effort (low/medium/high/xhigh) — only shown for Codex provider
  - Fast Mode toggle — only for Codex
  - Mode: Chat vs Plan
  - Access: Supervised (approval-required) vs Full access
  - Plan sidebar toggle (if active plan)

**Implementation status:** Fully implemented.

---

### `ComposerPendingApprovalPanel.tsx` (31 lines)
**What it does:** Displays a "PENDING APPROVAL" banner when the AI requests approval for a command/file operation.

**Data flow:**
- **Props:** `approval: PendingApproval`, `pendingCount`
- **Approval kinds:** `command`, `file-read`, `file-change`
- Shows "1/N" counter when multiple approvals pending

**Implementation status:** Fully implemented. Panel only — actual approve/decline actions in `ComposerPendingApprovalActions`.

---

### `ComposerPendingApprovalActions.tsx` (77 lines)
**What it does:** Approve/decline buttons for a pending approval request.

**Data flow:**
- **Props:** `requestId`, `isResponding`, `submittingLabel`, `onRespondToApproval`
- **Actions:** Cancel, Decline, Accept for Session, Approve once
- Calls `onRespondToApproval(requestId, decision)` where decision is `ProviderApprovalDecision`

**Implementation status:** Fully implemented.

---

### `ComposerPendingUserInputPanel.tsx` (182 lines)
**What it does:** Displays interactive prompts when the AI asks the user questions (multi-step question flow).

**Data flow:**
- **Props:** `pendingUserInputs`, `respondingRequestIds`, `answers`, `questionIndex`, `onSelectOption`, `onAdvance`
- Uses `derivePendingUserInputProgress()` to track which question is active
- Auto-advances 200ms after selecting an option
- **Keyboard shortcuts:** Number keys 1-9 select options (works even when composer has focus)
- Shows progress indicator when multiple questions

**Notable quirk:** Digit key handling bypasses the composer's contenteditable — if the user has started typing custom text, digit keys pass through to the editor instead.

**Implementation status:** Fully implemented.

---

### `ComposerPlanFollowUpBanner.tsx` (21 lines)
**What it does:** Shows "Plan ready" banner when a proposed plan exists and the user can follow up.

**Data flow:**
- **Props:** `planTitle: string | null`
- **Current state:** Just displays the title with an uppercase label
- Has a commented-out "Review the plan" hint section

**Implementation status:** Fully implemented but minimal. Plan review UI is elsewhere.

---

### `ComposerSkillPicker.tsx` (137 lines)
**What it does:** Popover for selecting repository skills (reusable instructions from `.rowl/skills`).

**Data flow:**
- **Props:** `skills: ProjectSkill[]`, `selectedSkillNames`, `issuesCount`, `disabled`, `compact`, `projectCwd`, `onToggleSkill`, `onSkillCreated`
- **Skill creation:** `SkillCreatorSection` is stubbed — just shows "Use the Context tab" hint
- Skills are defined in `.rowl/skills` directory
- Skill name pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` (kebab-case, 64 char max)
- `toSkillName()` normalizes user input to valid skill names

**Backend connection:** `readNativeApi()` for skill-related calls (creation calls `onSkillCreated` callback but section is stubbed).

**Implementation status:** Skill picker UI is complete, but skill creation is stubbed.

---

## 4. Chat Header & Toolbar

### `ChatHeader.tsx` (128 lines)
**What it does:** Top header bar showing thread title, project badge, scripts, git actions, diff toggle, and right sidebar toggle.

**Data flow:**
- **Props:** `activeThreadId`, `activeThreadTitle`, `activeProjectName`, `isGitRepo`, `openInCwd`, `activeProjectScripts`, `preferredScriptId`, `keybindings`, `availableEditors`, `diffToggleShortcutLabel`, `gitCwd`, `diffOpen`, and various callbacks
- **Sub-components:** `ProjectScriptsControl`, `OpenInPicker`, `GitActionsControl`, diff toggle `Toggle`, `RightSidebarToggle`

**Implementation status:** Fully implemented.

---

### `OpenInPicker.tsx` (142 lines)
**What it does:** Dropdown for opening files in various editors.

**Data flow:**
- **Props:** `keybindings`, `availableEditors`, `openInCwd`
- **Supported editors:** Cursor, VS Code, VS Code Insiders, Zed, Antigravity, File Manager
- Uses keyboard shortcut to detect favorite editor
- Calls `openInPreferredEditor()` from `editorPreferences`

**Backend connection:** `readNativeApi()` for editor launching.

**Implementation status:** Fully implemented.

---

### `VscodeEntryIcon.tsx` (37 lines)
**What it does:** Memoized VS Code-style file/folder icon component.

**Data flow:**
- **Props:** `pathValue`, `kind: "file" | "directory"`, `theme: "light" | "dark"`
- Uses `getVscodeIconUrlForEntry()` from `vscode-icons.ts`
- Falls back to `FolderIcon`/`FileIcon` from lucide-react

**Implementation status:** Fully implemented.

---

## 5. Thread Panels & Dialogs

### `ThreadGoalStatement.tsx` (137 lines)
**What it does:** Editable goal field for a thread. Click to edit, blur or Enter to save.

**Data flow:**
- **Props:** `threadId`, `goal`, `className`
- Uses `api.orchestration.dispatchCommand({ type: "thread.meta.update", threadId, goal })`
- Auto-trims whitespace, null if empty
- Max length: 500 characters
- Debounced save on blur with "Saved" confirmation toast

**Backend connection:** `readNativeApi().orchestration.dispatchCommand()` with `thread.meta.update` command.

**Implementation status:** Fully implemented.

---

### `ThreadTasksPanel.tsx` (149 lines)
**What it does:** Displays task activity (from checkpoint tracking) with status badges, durations, and progress updates.

**Data flow:**
- **Props:** `tasks: ThreadTask[]`, `timestampFormat`, `checkpointTurnCountByTurnId`
- Tasks grouped by checkpoint turn
- Shows: title, task type badge, turn count badge, status (completed/failed/stopped/running), duration, summary, recent progress updates
- Uses `formatTaskActivitySummary()` from `ThreadTasksPanel.logic`

**Implementation status:** Fully implemented.

---

### `ThreadExportDialog.tsx` (132 lines)
**What it does:** Modal for exporting thread as Markdown or JSON.

**Data flow:**
- **Props:** `open`, `onOpenChange`, `threadTitle`, `workspaceRoot`, `format`, `onFormatChange`, `savePath`, `onSavePathChange`, `defaultFilename`, `onDownload`, `onSaveToWorkspace`, `isSavingToWorkspace`
- **Formats:** Markdown, JSON
- **Actions:** Download file, Save to workspace
- Validates workspace path before enabling "Save to workspace"

**Implementation status:** Fully implemented.

---

### `ThreadShareDialog.tsx` (111 lines)
**What it does:** Modal for creating and managing shareable read-only thread links.

**Data flow:**
- **Props:** `open`, `onOpenChange`, `threadTitle`, `share: ThreadShareSummary | null`, `shareUrl`, `isCreatingShare`, `isRevokingShare`, `onCreateShare`, `onCopyLink`, `onOpenSharedView`, `onRevokeShare`
- Shows share link (read-only input), creation timestamp
- Actions: Create share link, Copy link, Open shared view, Revoke share

**Implementation status:** Fully implemented.

---

### `TurnReviewCard.tsx` (127 lines)
**What it does:** Card for reviewing AI-suggested changes before they're applied (approval-gated workflow).

**Data flow:**
- **Props:** `threadId`, `turnId`, `turnCount`, `files`, `disabled`, `onReviewed`
- Uses `summarizeTurnDiffInPlainLanguage()` for summary text
- **Decision states:** `null` → shows review card, `"approved"` → green confirmation, `"rejected"` → red "reverting" message
- **Backend:** `api.review.approve({ threadId, turnId })`, `api.review.reject({ threadId, turnId, turnCount })`
- **Hidden in Full Access mode:** Returns `null` if `thread.runtimeMode === "full-access"`

**Implementation status:** Fully implemented.

---

### `UsageDashboardDialog.tsx` (~579 lines)
**What it does:** Displays usage statistics and billing information for the current thread.

**Data flow:**
- **Props:** `open`, `onOpenChange`, `provider`, `model`, `language`, `threadId`, etc.
- Uses `serverCopilotUsageQueryOptions()` for Copilot billing data
- Shows: spend state cards, context window usage, Copilot-specific billing (for `copilot` provider)
- **Persian (fa) localization:** Full i18n for all labels
- **Spend categories:** `builds`, `searches`, `transcriptions`, `speech`, `images`

**Backend connection:** `serverCopilotUsageQueryOptions` via React Query.

**Implementation status:** Fully implemented.

---

## 6. Alerts & Banners

### `ThreadErrorBanner.tsx` (35 lines)
**What it does:** Red alert banner showing thread session errors.

**Data flow:**
- **Props:** `error: string | null`, `onDismiss?: () => void`
- Returns `null` if no error
- Uses `Alert` component with error variant
- Dismiss button optional

**Implementation status:** Fully implemented.

---

### `ProviderHealthBanner.tsx` (30 lines)
**What it does:** Alert banner for provider connection/status issues.

**Data flow:**
- **Props:** `status: ServerProviderStatus | null`
- Returns `null` if status is "ready" or null
- Shows warning (yellow) or error (red) based on status
- Uses `getProviderStatusTitle()` and `getDefaultProviderStatusMessage()` from `providerStatus.ts`

**Implementation status:** Fully implemented.

---

### `OverseerAlerts.tsx` (173 lines)
**What it does:** Renders AI oversight warnings in the chat timeline.

**Data flow:**
- **Activity type:** `OverseerActivity { id, kind, summary, createdAt, payload }`
- **Alert kinds:**
  - `overseer.premature-completion` — "Verify Before Moving On"
  - `overseer.certainty-warning` — "AI Uncertainty"
  - `overseer.capability-forgetfulness` — "AI Forgot Its Capabilities"
  - `overseer.technical-delegation` — "AI Asking You To Do Tech Work"
  - `overseer.dangerous-command` — "Dangerous Operation"
  - `overseer.loop-detected` — "AI Stuck In Loop"
  - `overseer.context-budget-high` — "Context Getting Full"
  - `overseer.context-exhaustion` — "Context Nearly Exhausted"
  - `overseer.session-error` — "Session Error"
  - `overseer.evaluation-result` — "Evaluator Check"
- `getOverseerAlerts(activities)` — filters activities for `overseer.*` kinds, sorts by `createdAt`

**Implementation status:** Fully implemented.

---

### `EmptyChatOnboarding.tsx` (221 lines)
**What it does:** Onboarding UI when no projects exist or no thread is selected.

**Data flow:**
- Has Persian (fa) and English (en) i18n
- Handles project creation flow
- Shows different messages for: no projects at all, vs. no thread selected

**Implementation status:** Fully implemented.

---

### `ExpandedImagePreview.tsx` (32 lines)
**What it does:** Interface/types for expanded image preview items.

**Data flow:**
- `ExpandedImagePreview` interface: `id`, `previewUrl`, `mimeType`
- `buildExpandedImagePreview()` function

**Implementation status:** Fully implemented.

---

### `MessageCopyButton.tsx` (26 lines)
**What it does:** Simple memoized copy-to-clipboard button.

**Data flow:**
- **Props:** `text: string`
- Uses `useCopyToClipboard` hook
- Shows "Copied!" state temporarily after click

**Implementation status:** Fully implemented.

---

## 7. Diff Components

### `DiffPanel.tsx` (~800 lines)
**What it does:** Full diff viewer for checkpoint/turn changes. Shows file tree, patch view, turn selector.

**Data flow:**
- **Props:** `mode?: DiffPanelMode` — "inline" | "sheet" | "sidebar"
- Uses `@pierre/diffs` library for patch parsing and rendering (`parsePatchFiles`, `FileDiff`, `Virtualizer`)
- **Turn selection:** Horizontal scrolling turn tabs
- **View modes:** Stacked vs split diff
- **Theme:** Syncs with app theme via `resolveDiffThemeName()`
- **Patch caching:** `buildPatchCacheKey()` for worker pool cache
- **Turn diff summaries:** Via `useTurnDiffSummaries()` hook
- **Fork handling:** `buildForkedThreadTitle()`, `resolveCheckpointForkSource()`
- **Error handling:** `getCheckpointDiffErrorDetail()` for graceful error display
- **File actions:** `openInPreferredEditor()`, terminal link resolution
- **Lazy loading:** Entire panel is lazy-loaded in route

**Backend connection:**
- `checkpointDiffQueryOptions` for fetching diff data
- `gitBranchesQueryOptions` for branch info
- Native API for `openInPreferredEditor`

**Implementation status:** Fully implemented. Large and complex.

---

### `DiffPanelShell.tsx` (92 lines)
**What it does:** Shell/wrapper for diff panel with drag region for Electron.

**Data flow:**
- **Props:** `mode: DiffPanelMode`, `header`, `children`
- `DiffPanelMode = "inline" | "sheet" | "sidebar"`
- Inline mode has a draggable resize handle (Electron only)

**Implementation status:** Fully implemented.

---

### `DiffWorkerPoolProvider.tsx` (82 lines)
**What it does:** Provides a worker pool for diff rendering operations.

**Data flow:**
- **Pool size:** `max(2, min(6, floor(navigator.hardwareConcurrency / 2)))`
- Wraps `DiffWorkerPoolProvider` from `@pierre/diffs`
- Catches init errors to prevent unhandled promise rejections

**Implementation status:** Fully implemented.

---

### `DiffStatLabel.tsx` (22 lines)
**What it does:** Displays `+additions / -deletions` with color coding.

**Data flow:**
- **Props:** `additions`, `deletions`, `showParentheses?: boolean`
- Green for additions, red for deletions

**Implementation status:** Fully implemented.

---

### `ChangedFilesTree.tsx` (145 lines)
**What it does:** Tree view of changed files from a turn diff.

**Data flow:**
- **Props:** `files: TurnDiffFileChange[]`, theme, callbacks
- Uses `buildTurnDiffTree()` from `turnDiffTree.ts`
- Directory expansion state managed locally
- File icons via `VscodeEntryIcon`

**Implementation status:** Fully implemented.

---

## 8. Feature & Model Pickers

### `ProviderModelPicker.tsx` (~1,011 lines)
**What it does:** Comprehensive model and provider selection dropdown.

**Data flow:**
- **Props:** `activeThread`, `provider`, `providerPickerKind`, `language`, `model`, `lockedProvider`, `allModelOptionsByProvider`, `visibleModelOptionsByProvider`, `openRouterModelOptions`, `opencodeModelOptions`, context lengths maps, service tier, hidden models/providers, favorite/recent models, and various callbacks
- **Features:**
  - Model search
  - Provider sections (available, unavailable, coming soon)
  - Favorite/recent/default badges
  - Context window display
  - Reasoning effort badge (brain icon)
  - Image input badge (eye icon)
  - Set as default action
  - Fast tier badge for Codex
  - Copilot usage summary
- **i18n:** Full Persian (fa) localization
- **Data sources:** `serverCopilotUsageQueryOptions`, `openRouterFreeModelsQueryOptions`

**Backend connection:** React Query hooks for Copilot usage and OpenRouter free models.

**Implementation status:** Fully implemented.

---

### `FeaturePicker.tsx` (106 lines)
**What it does:** Dropdown for selecting which feature (from project management) the thread is working on.

**Data flow:**
- **Props:** `projectId`, `activeFeatureId`, `disabled`, `compact`, `onSelectFeature`
- Fetches features via `api.features.listByProject({ projectId })`
- Only shows actionable features (backlog or in_progress stage)
- Shows stage badge (Active/Backlog)

**Backend connection:** `readNativeApi().features.listByProject()`.

**Implementation status:** Fully implemented.

---

### `CodexTraitsPicker.tsx` (93 lines)
**What it does:** Dropdown for selecting reasoning effort (low/medium/high/xhigh) and fast mode toggle for Codex.

**Data flow:**
- **Props:** `selectedEffort`, `onEffortChange`, `selectedCodexFastModeEnabled`, `onCodexFastModeChange`
- Uses `Menu` components from UI library
- Reasoning effort options from `getReasoningEffortOptions("codex")`

**Implementation status:** Fully implemented.

---

## 9. State Management & Logic Files

### `store.ts` (623 lines)
**What it does:** Global Zustand store for app state — projects, threads, session info.

**State shape:**
```typescript
interface AppState {
  projects: Project[];
  threads: Thread[];
  threadsHydrated: boolean;
}
```

**Key functions:**
- `syncServerReadModel(state, readModel)` — main sync function, maps `OrchestrationReadModel` to app state
- `markThreadVisited(state, threadId, visitedAt)` — updates `lastVisitedAt`
- `updateThread()` — pure helper for immutable thread updates
- `mapProjectsFromReadModel()` — handles project ordering (uses localStorage persisted order)
- `inferProviderForThreadModel()` — infers provider from session config or model slug
- `resolveThreadModelForSync()` — normalizes model slugs, handles custom models
- `toAttachmentPreviewUrl()` — converts attachment IDs to HTTP URLs

**Persistence:**
- localStorage key: `rowl:renderer-state:v8`
- Legacy key cleanup for v1-v7 and codething keys
- Debounced persist (500ms) via `@tanstack/react-pacer`
- Persists: expanded projects, project order (by cwd)

**Notable quirks:**
- Project deduplication by `workspaceRoot` (keeps most recently updated)
- Provider inference is complex — tries session config first, then activity history, then model slug pattern matching
- Thread `lastVisitedAt` only updates if new time is strictly later

**Implementation status:** Fully implemented.

---

### `threadSendQueue.ts` (154 lines)
**What it does:** Queue management for follow-up turns. Supports "queue" (end of queue) and "steer" (front of queue) modes.

**State shape:**
```typescript
interface QueuedThreadTurn {
  id: string;
  threadId: ThreadId;
  text: string;
  attachments: ComposerImageAttachment[];
  provider: ProviderKind;
  model: string;
  serviceTier: ProviderServiceTier | null;
  modelOptions?: ProviderModelOptions;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
  skillNames: ProjectSkillName[];
  createdAt: string;
  mode: ThreadFollowUpMode; // "queue" | "steer"
  status: ThreadSendQueueStatus; // "pending" | "sending" | "failed"
  error: string | null;
}
```

**Store actions:** `enqueue` (with `{ front?: boolean }` option), `remove`, `move` (reorder), `markSending`, `markFailed`, `markPending`, `clearThreadQueue`

**Implementation status:** Fully implemented.

---

### `composer-logic.ts` (316 lines)
**What it does:** Pure functions for composer slash commands, trigger detection, and text manipulation.

**Types:**
- `ComposerTriggerKind`: `"path" | "slash-command" | "slash-model" | "slash-mcp"`
- `ComposerTrigger`: `{ kind, query, rangeStart, rangeEnd }`
- `ComposerSlashCommand`: `"path" | "model" | "mcp" | "plan" | "default" | "init" | "new" | "compact" | "share" | "unshare" | "undo" | "redo" | "export" | "details"`

**Key functions:**
- `detectComposerTrigger(text, cursorPos)` — detects `@path`, `/slash`, `/model`, `/mcp` triggers
- `parseStandaloneComposerSlashCommand(text)` — parses `/plan`, `/default`, `/init`, `/new` (alias: `/clear`), `/compact` (alias: `/summarize`), `/share`, `/unshare`, `/undo`, `/redo`, `/export`, `/details`
- `parseStandaloneComposerSlashInvocation(text)` — parses custom commands like `/fix-tests src/web`
- `replaceTextRange(text, start, end, replacement)` — replaces text and returns new cursor position
- `expandCollapsedComposerCursor(text, collapsedCursor)` — maps collapsed mention cursor to expanded
- `collapseExpandedComposerCursor(text, expandedCursor)` — reverse mapping
- `clampCollapsedComposerCursor(text, cursor)` — clamps cursor to end of collapsed content
- `isCollapsedCursorAdjacentToMention(text, cursor, side)` — checks if cursor is next to a mention

**Notable patterns:**
- Uses `MENTION_TOKEN_REGEX` for path detection
- Special handling for collapsed mention cursors (mention renders as `@filename` but text length is 1)
- Built-in aliases: `/clear` → `new`, `/summarize` → `compact`

**Implementation status:** Fully implemented. Well-tested in `composer-logic.test.ts`.

---

### `proposedPlan.ts` (122 lines)
**What it does:** Utilities for plan title extraction, markdown manipulation, and plan implementation prompts.

**Key functions:**
- `proposedPlanTitle(markdown)` — extracts first `# heading` as title, returns null if none
- `stripDisplayedPlanMarkdown(markdown)` — drops the leading `# Title` heading
- `buildCollapsedProposedPlanPreviewMarkdown(markdown, { maxLines })` — creates truncated preview, appends `...` if truncated
- `buildPlanImplementationPrompt(markdown)` — wraps in `PLEASE IMPLEMENT THIS PLAN:` header
- `resolvePlanFollowUpSubmission({ draftText, planMarkdown })` — determines if user wants to implement (" " only) or follow-up (has text), returns `{ text, interactionMode }`
- `buildPlanImplementationThreadTitle(markdown)` — "Implement {title}" or "Implement plan"
- `buildProposedPlanMarkdownFilename(markdown)` — slugified filename like `integrate-effect-rpc-into-server-app.md`

**Implementation status:** Fully implemented. Well-tested in `proposedPlan.test.ts`.

---

## 10. Missing / Not Found Files

### `ThreadNewButton.browser.tsx` — NOT FOUND
Listed in the analysis task but does not exist in the codebase.

### `ThreadNewButton.tsx` — NOT FOUND
Listed in the analysis task but does not exist in the codebase.

---

## Summary Table

| Component | Status | Notes |
|-----------|--------|-------|
| `_chat.tsx` | ✅ Full | Layout route, global shortcuts, command palette |
| `_chat.$threadId.tsx` | ✅ Full | Thread route, diff panel orchestration |
| `ChatView.tsx` | ✅ Full | 10k+ line monolith, all thread interactions |
| `ChatView.browser.tsx` | ✅ Test | Vitest browser tests |
| `MessagesTimeline.tsx` | ✅ Full | Virtualized timeline with grouping |
| `MessagesTimeline.logic.ts` | ✅ Full | Pure timeline math functions |
| `ComposerPromptEditor.tsx` | ✅ Full | Lexical editor with mention chips |
| `ComposerCommandMenu.tsx` | ✅ Full | Autocomplete dropdown |
| `CompactComposerControlsMenu.tsx` | ✅ Full | More controls menu |
| `ComposerPendingApprovalPanel.tsx` | ✅ Full | Approval banner (display only) |
| `ComposerPendingApprovalActions.tsx` | ✅ Full | Approve/decline buttons |
| `ComposerPendingUserInputPanel.tsx` | ✅ Full | Multi-step question UI |
| `ComposerPlanFollowUpBanner.tsx` | ✅ Full | Plan ready banner |
| `ComposerSkillPicker.tsx` | ⚠️ Partial | UI complete, creation stubbed |
| `ChatHeader.tsx` | ✅ Full | Thread header with controls |
| `OpenInPicker.tsx` | ✅ Full | Editor picker |
| `VscodeEntryIcon.tsx` | ✅ Full | File/folder icon component |
| `ThreadGoalStatement.tsx` | ✅ Full | Editable goal field |
| `ThreadTasksPanel.tsx` | ✅ Full | Task activity display |
| `ThreadExportDialog.tsx` | ✅ Full | Export as MD/JSON |
| `ThreadShareDialog.tsx` | ✅ Full | Share link management |
| `TurnReviewCard.tsx` | ✅ Full | Approve/reject changes card |
| `UsageDashboardDialog.tsx` | ✅ Full | Usage/billing dashboard |
| `ThreadErrorBanner.tsx` | ✅ Full | Error display |
| `ProviderHealthBanner.tsx` | ✅ Full | Provider status warning |
| `OverseerAlerts.tsx` | ✅ Full | 10 overseer alert types |
| `EmptyChatOnboarding.tsx` | ✅ Full | Onboarding UI with i18n |
| `ExpandedImagePreview.tsx` | ✅ Full | Image preview interface |
| `MessageCopyButton.tsx` | ✅ Full | Copy to clipboard |
| `DiffPanel.tsx` | ✅ Full | Full diff viewer, lazy loaded |
| `DiffPanelShell.tsx` | ✅ Full | Diff panel wrapper |
| `DiffWorkerPoolProvider.tsx` | ✅ Full | Worker pool for diff rendering |
| `DiffStatLabel.tsx` | ✅ Full | +additions/-deletions display |
| `ChangedFilesTree.tsx` | ✅ Full | Changed file tree |
| `ProviderModelPicker.tsx` | ✅ Full | Model/provider selection |
| `FeaturePicker.tsx` | ✅ Full | Feature selection |
| `CodexTraitsPicker.tsx` | ✅ Full | Reasoning effort + fast mode |
| `store.ts` | ✅ Full | Zustand app state |
| `threadSendQueue.ts` | ✅ Full | Queue management for turns |
| `composer-logic.ts` | ✅ Full | Composer slash commands + triggers |
| `proposedPlan.ts` | ✅ Full | Plan markdown utilities |
| `ThreadNewButton*.tsx` | ❌ Missing | Files don't exist |

---

## Notable Patterns & Quirks

1. **Collapsed Mention Cursor:** File mentions (`@filename`) store only 1 character in the Lexical tree but display as full filename. Cursor position mapping functions (`expandCollapsedComposerCursor`, `collapseExpandedComposerCursor`) handle this duality.

2. **Timeline Virtualization Strategy:** Last 8 rows are always unvirtualized to prevent scroll jumps during streaming. `firstUnvirtualizedRowIndex` calculation is complex.

3. **Provider Inference Priority:** When inferring which provider a thread uses: (1) session config, (2) activity history (session.configured events), (3) model slug pattern matching.

4. **Diff Panel Mode Switching:** At >1180px uses inline sidebar, below uses sheet modal. The sidebar resize has complex constraints preventing composer overflow.

5. **Overseer Alert Filtering:** Alerts are filtered from thread activities by `kind.startsWith("overseer.")` — no explicit allowlist, catches all.

6. **Skill Name Normalization:** `toSkillName()` converts any input to kebab-case, strips non-alphanumeric chars, truncates at 64 chars.

7. **Persian (fa) Localization:** Multiple components have full fa translations, not just labels but date formatting and copy.

8. **Thread Send Queue Modes:** `queue` mode appends to end, `steer` mode prepends to front. Used for follow-up turns vs. priority interventions.

9. **Slash Command Aliases:** `/clear` → `new`, `/summarize` → `compact`. OpenCode-inspired session actions.

10. **Review Card Hidden in Full Access:** `TurnReviewCard` returns `null` when `runtimeMode === "full-access"` — users opted out of approval gating.

11. **Auto-Advance in User Input Panel:** 200ms timer after option selection auto-advances to next question.

12. **Turn Review vs. Approval:** Two separate systems — `TurnReviewCard` for checkpoint review (approve/reject changes), `ComposerPendingApprovalActions` for real-time approval requests (command/file operations).
