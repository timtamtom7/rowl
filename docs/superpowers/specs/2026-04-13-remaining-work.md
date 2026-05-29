# Remaining Work — Updated 2026-04-13 End of Session

## What Was Done This Session (~32K+ lines, 150+ files)

### Infrastructure

- Context injection pipeline, deep memory (FTS5 + embeddings), surgical trimming, handoff system
- Codebase intelligence (health scoring), multi-agent coordinator, workflow engine
- Project prompts service, evaluator agent, embedding service
- 7 new migrations (017-023)
- 20+ new WS methods wired end-to-end

### Right Sidebar (all 6 tabs + subsections)

- Shared React Query hooks (sidebarReactQuery.ts) with cross-tab invalidation
- PM Chat: proactive suggestions, action buttons, model picker, harness indicator, conversation memory
- Threads: search, unread dots, task list, agent overview with click-to-navigate
- Features: drag-drop kanban, all stage moves, thread linking, empty state
- Goals: thread linking chips, progress bar, project prompts + harness picker
- Context: budget breakdown, expandable nodes, "AI sees" summary, bulk trim, warning banner
- Map: custom FileNode with glows, force layout with collision detection, nerve map toggle, health legend, edge animation

### Overseer (9 detection patterns + evaluator)

- Capability forgetfulness, technical delegation, dangerous commands, loop detection
- Premature completion, uncertainty highlighting, context budget warnings
- Auto memory extraction, file change tracking
- Evaluator agent (auto-runs on turn completion, checks 4 criteria)

### Quality Fixes

- FTS5 triggers → sql.unsafe() for multi-statement
- Memory search SQL → explicit columns (was fragile regex)
- File scanning → 80-line truncation per file
- PM prompt → shorter for follow-ups to prevent unbounded growth
- Map performance → activeFiles removed from loadGraph deps
- Evaluator timing → moved from streaming to turn.completed
- Skills polling → hard timeout replaces stale closure
- TurnReviewCard → hidden in Full Access mode (hooks ordering fixed)
- Provider routing → MiniMax + KiloCode added to all 4 check locations

## What STILL Remains

### Must-do Before User Testing

- [ ] Verify all 7 new migrations run against real SQLite database
- [ ] Verify PM thread creation + message sending works end-to-end
- [ ] Verify file scanning on a real project (not just typecheck)
- [ ] Verify memory auto-extraction creates entries in database
- [ ] Verify harness preset seeding runs on startup

### Design/UX Gaps

- [ ] Map doesn't look Obsidian-level — needs real data iteration
- [ ] No context ring visualization (Valo-style radial)
- [ ] No way to see AI streaming tokens in real-time
- [ ] PM model change doesn't persist across sessions (only in-memory)
- [ ] Custom harness saves as project rule, not harness preset
- [ ] Goal progress counts all project features, not goal-specific features

### From Plans (Not Started)

- [ ] Codebase Intelligence runtime worker (TreeSitter + Chroma) — rowl-codebase-context plan
- [ ] Real LLM-based context compression (not just tombstones)
- [ ] Process isolation for agents
- [ ] Agent type abstraction (Flora/Flashboards)
- [ ] Cross-medium context

### Test Coverage Gaps

- [ ] No tests for MemoryServiceLive, ProjectPromptsServiceLive, EvaluatorServiceLive
- [ ] No tests for context trimming logic
- [ ] No tests for workflow engine detection patterns
- [ ] No integration tests for the full PM → Feature → Thread flow

## Test Status

- Web: 72 files, 672 tests, all passing
- Server: 49/54 files passing (6 pre-existing failures, not from our changes)
- 0 actual TypeScript errors across all packages
