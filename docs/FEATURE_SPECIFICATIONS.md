# Rowl Feature Specifications

This document contains detailed specifications for all Rowl features. When a user proposes a simple idea, it should be expanded here into a detailed spec that the AI can reference and never forget.

---

## Feature Status Dashboard

**Rule: A feature is NOT done until it's fully wired to real data/APIs. Mock UI = 0%.**

| Feature | Backend | Frontend | Overall | Usable? |
|---------|---------|----------|---------|---------|
| Right Sidebar Shell | N/A | 15% | 15% | ❌ |
| PM Chat | 0% | 0% | 0% | ❌ |
| Threads Tab | 0% | 0% | 0% | ❌ |
| Features Board | 0% | 0% | 0% | ❌ |
| Goals Tab | 0% | 0% | 0% | ❌ |
| Context System | 0% | 0% | 0% | ❌ |
| Thread Goal Statement | 100% | 100% | 100% | ✅ |
| Project Brief | 0% | 0% | 0% | ❌ |
| Settings Reorganization | 0% | 0% | 0% | ❌ |
| Skills AI Creation | 0% | 0% | 0% | ❌ |
| Overseer | 0% | 0% | 0% | ❌ |

**Only 1 feature fully done.** Everything else is 0% or mock-only.

---

## Completion Percentage Guide

| % | Meaning |
|---|---------|
| 0% | Not started, nothing exists |
| 1-20% | Contracts/schemas exist, nothing works |
| 21-40% | Backend service interfaces exist, no implementation |
| 41-60% | Backend implementation done, frontend needs wiring |
| 61-80% | Frontend wired, needs testing/integration |
| 81-99% | Testing/fixing, almost there |
| 100% | Fully working, tested, merged to main |

---

## Feature: Right Sidebar Shell

**Overall: 15%** - Shell integrated into layout, empty content area

### Backend: N/A
Just a UI container, no backend needed.

### Frontend
- [x] RightSidebar.tsx shell with tab bar (136 lines)
  - Collapsible (~320px expanded, ~40px collapsed)
  - 5 tab slots defined (pm-chat, threads, features, goals, context)
  - Tab icons and labels working
  - Empty content area (waiting for tab implementations)
- [x] Integrated into `_chat.tsx` layout
  - Renders after Outlet (main chat content)
  - Border styling applied

- [ ] Tab content slots (0%) - Nothing rendering in main area

---

## Feature: PM Chat (in Right Sidebar)

**Overall: 0%** - Never started

### Summary
AI Product Manager chat integrated into right sidebar. Has full context of project (threads, features, goals, context) and coordinates all work.

### What Needs Building

#### Backend (0%)
- [ ] PMChatContextService implementation
  - Aggregates all project data for PM
  - Fetches threads, features, goals, context nodes for a project
  - No persistence needed - reads from existing projections

#### Frontend (0%)
- [ ] PMChat component (0%)
  - Chat interface for AI PM
  - WebSocket connection to backend
  - Context display (threads, features, goals visible to PM)
  - Actions: create thread, update feature, assign work

### Implementation Order
1. Backend: PMChatContextService (reads existing data)
2. Frontend: PMChat component wired to PMChatContextService

---

## Feature: Threads Tab (in Right Sidebar)

**Overall: 0%** - Never started

### Summary
List of all threads in the current project with their goal statements and status.

### What Needs Building

#### Backend (0%)
- [ ] Use existing thread projection data
- [ ] Filter threads by current project
- [ ] Fetch thread goals (already exists in schema)

#### Frontend (0%)
- [ ] ThreadsTab component (0%)
  - List threads from current project
  - Show thread goal statement
  - Show status indicator (working, connecting, etc.)
  - Click to switch threads
  - Uses existing thread data from orchestrator

### Implementation Order
1. Backend: Query existing thread projection by projectId
2. Frontend: ThreadsTab wired to thread data

---

## Feature: Features Board (in Right Sidebar)

**Overall: 0%** - Never started (mock UI was deleted)

### Summary
Kanban-style board with columns: Backlog, In Progress, Done, Wishlist. Each feature has detailed spec.

### What Needs Building

#### Backend (0%)
- [ ] FeatureService implementation
  - CRUD for features
  - Stages: "backlog" | "in_progress" | "done" | "wishlist"
  - Fields: id, projectId, name, description, stage, threadId, createdAt, updatedAt, createdBy
  - Needs new projection: ProjectionFeatures

#### Frontend (0%)
- [ ] FeaturesBoard component (0%)
  - Kanban columns with drag-drop
  - Feature cards (name, description, thread)
  - Create/edit feature UI
  - Wire to FeatureService API

### Contracts (Exist, 100%)
- `packages/contracts/src/features.ts` - Schemas done
- `packages/contracts/src/ws.ts` - WebSocket methods defined

### Implementation Order
1. Backend: ProjectionFeatures + FeatureService
2. Frontend: FeaturesBoard component with drag-drop

---

## Feature: Goals Tab (in Right Sidebar)

**Overall: 0%** - Never started

### Summary
Project-level goals display with main goal prominent and sub-goals linked to threads.

### What Needs Building

#### Backend (0%)
- [ ] GoalsService implementation
  - CRUD for goals
  - Fields: id, projectId, text, isMain, linkedThreadIds, createdAt
  - Set/unset main goal
  - Link/unlink threads to goals
  - Needs new projection: ProjectionGoals

#### Frontend (0%)
- [ ] GoalsTab component (0%)
  - Main goal prominently displayed
  - Sub-goals list
  - Visual progress indicators
  - Wire to GoalsService API

### Contracts (Exist, 100%)
- `packages/contracts/src/goals.ts` - Schemas done
- `packages/contracts/src/ws.ts` - WebSocket methods defined

### Implementation Order
1. Backend: ProjectionGoals + GoalsService
2. Frontend: GoalsTab component

---

## Feature: Context System (in Right Sidebar)

**Overall: 0%** - Never started

### Summary
Visual representation of context chunks as nodes that can be managed to achieve context reduction. Called "Context" not "Tombstone".

### What Needs Building

#### Backend (0%)
- [ ] ContextService implementation
  - CRUD for context nodes
  - Fields: id, projectId, threadId, type, summary, size, compressed, createdAt
  - Types: "messages" | "file" | "artifact" | "memory"
  - Compress/restore context nodes
  - Calculate context budget
  - Needs new projection: ProjectionContextNodes

#### Frontend (0%)
- [ ] ContextTab component (0%)
  - Node-based visualizer
  - Show context chunks as nodes
  - Compression status (active vs compressed)
  - Compress/restore buttons
  - Context budget display
  - Wire to ContextService API

### Contracts (Exist, 100%)
- `packages/contracts/src/context.ts` - Schemas done
- `packages/contracts/src/ws.ts` - WebSocket methods defined

### Implementation Order
1. Backend: ProjectionContextNodes + ContextService
2. Frontend: ContextTab component with visualizer

---

## Feature: Thread Goal Statement

**Overall: 100%** ✅ DONE

### Backend: 100%
- [x] `goal` field added to `OrchestrationThread` schema
- [x] `goal` field added to `ThreadMetaUpdateCommand`
- [x] Uses existing `thread.meta.update` command

### Frontend: 100%
- [x] `ThreadGoalStatement` component (`apps/web/src/components/chat/ThreadGoalStatement.tsx`)
- [x] Displayed above MessagesTimeline in ChatView
- [x] Click to edit, auto-saves on blur/Enter
- [x] "Saved" indicator after save
- [x] All tests updated with `goal: null`

### Implementation Location
- `packages/contracts/src/orchestration.ts` (lines ~275, ~387)
- `apps/web/src/components/chat/ThreadGoalStatement.tsx` (new file)
- `apps/web/src/types.ts` (Thread interface)
- `apps/web/src/store.ts` (syncServerReadModel)
- `apps/web/src/components/ChatView.tsx`

---

## Feature: Project Brief

**Overall: 0%** - Never started

### Summary
A detailed description of the project's purpose, goals, and context. Stored in `.rowl/project-brief.md`.

### What Needs Building

#### Backend (0%)
- [ ] ProjectBriefService implementation
  - Read/write `.rowl/project-brief.md`
  - Fields: projectId, brief (markdown), filePath, lastEditedAt, lastEditedByThreadId
  - File system operations

#### Frontend (0%)
- [ ] ProjectBrief component (0%)
  - Markdown editor with preview
  - Accessible from project settings or PM chat
  - Auto-save to file

### Implementation Order
1. Backend: ProjectBriefService (file read/write)
2. Frontend: ProjectBrief editor component

---

## Feature: Settings Reorganization

**Overall: 0%** - Never started

### Summary
Replace long-scrolling settings page with tabbed interface. Unified model management.

### What Needs Building

#### Backend (0%)
- [ ] Lazy provider health checks
  - Don't run on startup
  - Run when user opens Models tab
  - `serverRefreshProviderHealth` method (already defined in ws.ts)

#### Frontend (0%)
- [ ] Tabbed settings interface
  - General, Models, Providers, Keybindings, Safety tabs
  - Unified Models tab (replaces ManageModelsDialog)
  - Provider errors shown lazily (not on startup)

### Implementation Order
1. Backend: Ensure lazy health checks work
2. Frontend: Tabbed settings UI

---

## Feature: Skills AI Creation

**Overall: 0%** - Never started

### Summary
AI-assisted creation of SKILL.md files for project-specific instructions.

### What Needs Building

#### Backend (0%)
- [ ] SkillService implementation
  - Analyze project structure
  - Generate skill suggestions
  - Read/write `.rowl/skills/SKILL-name.md`

#### Frontend (0%)
- [ ] Skill creation UI (0%)
  - Accessible from PM chat or project settings
  - AI analyzes project, suggests skills
  - User edits in preview, saves

### Implementation Order
1. Backend: SkillService
2. Frontend: Skill creation UI

---

## Feature: Overseer (Guardian System)

**Overall: 0%** - Never started

### Summary
Background AI monitoring system that watches provider output for capability forgetfulness patterns.

### What Needs Building

#### Backend (0%)
- [ ] GuardianService implementation
  - Monitor AI outputs for patterns:
    - "I can't do that" when AI actually can
    - "You need to run this yourself"
    - Loop detection
    - Stuck task detection
  - GuardianSuggestion schema exists in specs

#### Frontend (0%)
- [ ] Guardian panel (0%)
  - Collapsible panel in ChatView
  - Show suggestions when capability forgetfulness detected
  - User can acknowledge/dismiss

### Implementation Order
1. Backend: GuardianService with pattern matching
2. Frontend: Guardian panel UI

---

## Process Rules

1. **Feature is NOT done until:**
   - Backend implementation complete and tested
   - Frontend wired to real APIs (not mock data)
   - Merged to main branch
   - Typecheck and lint pass

2. **Before starting a feature:**
   - Read this document
   - Understand current % completion
   - Start with backend, then frontend

3. **When feature reaches 100%:**
   - Update status table at top
   - Update implementation location notes
   - Commit with message: "feat: complete [feature name]"

---

## Development Order (Recommended)

Based on dependencies:

1. **Thread Goal Statement** ✅ Already done
2. **PM Chat** - Depends on: threads data, features, goals, context (needs all of below)
3. **Threads Tab** - Uses existing thread data (easy)
4. **Goals Tab** - Needs GoalsService (medium)
5. **Features Board** - Needs FeatureService (medium)
6. **Context System** - Needs ContextService (complex)
7. **Project Brief** - Independent
8. **Settings Reorganization** - Independent
9. **Skills AI Creation** - Independent
10. **Overseer** - Independent

**Recommended next:** Threads Tab (easiest, uses existing data) or Goals Tab (medium, needs new service)

---

_Last updated: 2026-04-08_
