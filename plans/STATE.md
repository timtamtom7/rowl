# Rowl — Current State (Plans Front Door)

**Last updated:** 2026-05-31
**Current focus:** Sub-project #4 — UI polish layer (craft-agents-oss aesthetic)

> **If you are a new session resuming Rowl work, read this file FIRST.**
> It orients you in ~60 seconds and tells you what to read next.

---

## Overall Goal (immutable)

Rowl's memory-first evolution is a deliberate synthesis of four open-source reference projects. Each contributes a specific layer. Do NOT forget this — it is the whole reason for the multi-sub-project arc. If any future session proposes narrowing or replacing this vision, check with the user first.

| Source repo                                                      | License    | Contributes                                                                                                                                                                                                     | Sub-project      |
| ---------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| [letta-code](https://github.com/letta-ai/letta-code)             | MIT        | **Memory-first agent architecture** — git-backed memory blocks, reminder engine, self-editing memory tool, Palace viewer, slash-command surface, agent creation flow                                            | #1 (done)        |
| [paperclip](https://github.com/paperclipai/paperclip)            | Apache-2.0 | **Organizing layer** — Goal → Issue → Document/Feedback/Approval model, goal ancestry, versioned research docs as first-class artifacts                                                                         | #2 (done)        |
| [t3code](https://github.com/pingdotgg/t3code)                    | MIT        | **Runtime base** (current Rowl already a fork) + **cherry-pick features** — git-native turn checkpoints, worktrees, stacked PRs, composer draft persistence, context meter, per-turn diff trees, approval gates | base + #3 (done) |
| [craft-agents-oss](https://github.com/lukilabs/craft-agents-oss) | Apache-2.0 | **UI / window aesthetic inspiration** — sidebar + skills/MCP surface, Mac-native desktop feel, information architecture. Reference for visual polish as Rowl matures.                                           | #4 (in progress) |

All four are license-compatible (MIT / Apache-2.0). The cloned reference repos live at `/Users/mauriello/Dev/_reference/`.

**The goal in one sentence:** memory-first agents (Letta pattern) inside a t3code-derived runtime base, organized by Paperclip-style goal/issue/document structure, with Craft Agents-grade UI polish.

---

## Where we are right now

- **Sub-project:** #4 — UI polish layer (craft-agents-oss aesthetic)
- **Phase:** planning / initial implementation
- **Branch:** `phase-1a/core-memory-substrate`
- **Blocker:** root `bun run typecheck` still exits non-zero on pre-existing server Effect diagnostics; root `bun run test` is blocked in this sandbox by loopback `listen EPERM` in `packages/shared/src/Net.test.ts`.

## Sub-project completion status

| #   | Name                        | Status  | Commits                                                              |
| --- | --------------------------- | ------- | -------------------------------------------------------------------- |
| 1   | Memory-first agent arch     | ✅ Done | Phase 1a-1e commits                                                  |
| 2   | Organizing layer            | ✅ Done | aa9175fe, 04683c92, 7cc9ac93                                         |
| 3   | Worktree isolation + cherry | ✅ Done | f025595f, 9d413784, a0a09d4e, ca970a57, b1e7f0c8, 840d436b, 6f5c5358 |
| 4   | UI polish layer             | 🚧 WIP  | —                                                                    |

## Features implemented this session (2026-05-31)

- **Organizing Layer**: Goals hierarchy, GoalDocuments, ApprovalGates — full CRUD with services, WS routes, React hooks, sidebar panels
- **Worktree Isolation**: WorktreeService with lock files, auto-cleanup, per-worktree git operations
- **Worktree Checkpoints**: WorktreeCheckpointService — cherry-pick, merge, stacked branches. UI with expand/collapse panels
- **Slash Commands**: /goals, /goals create, /goals update, /doc, /doc create, /doc read, /approve, /approve create, /approve approve, /approve reject
- **Per-turn Diff Tree**: DiffTreeService from git diff --stat/--numstat, rename detection, visual tree UI
- **Context Window Meter**: 70%/90% thresholds, per-thread tracking, WS API
- **Thread Approval Gates**: In-chat approve/reject cards with diff preview, 2s auto-refresh
- **Composer Draft Persistence**: Thread-keyed localStorage, 500ms debounce, 50KB cap, legacy migration

## Test status

- Contracts: 98/98 passing
- Web: 693 tests across 81 files passing
- Server: ThreadApproval (3/3), Worktree (5/5) passing
- Root typecheck: blocked by pre-existing WorktreeService Effect diagnostics + branded ID test fixtures
- Root test: blocked by sandbox loopback EPERM in Net.test.ts (pre-existing)

## Research files this session

- `~/wiki/knowledge/research/muslim-golden-age/` — 3 files (~1,200 lines)
- `~/wiki/knowledge/research/deep-dives/` — 7 files (~1,400 lines)
- `~/wiki/knowledge/research/leader-of-light-projects/PROJECTS.md` — 50 projects, 426 lines
- `~/wiki/knowledge/research/DEEP-DIVE-TOPICS.md` — 20 additional topics

## Last session handoff

- 2026-05-31: Full session — 12 commits, ~14,000 lines across 108 files. Sub-projects #2 and #3 complete. All 4 deep dives from user list (#2, #4, #6, #11, #14, #18) done. 20 new deep dive topics generated. Leader of Light expanded to 50 projects.
- 2026-05-29: Phases 1b-1e implemented (core agents, memory palace, editable memory, slash commands)
- 2026-05-29: Phase 1a shipped (15 tasks, branch ready for merge)

## Next session resumes by

1. **Sub-project #4**: Read `/Users/mauriello/Dev/_reference/craft-agents-oss/` for UI patterns. Focus: sidebar refinement, skills/MCP surface, Mac-native feel, glass morphism, information architecture.
2. **Git housekeeping**: merge branch to main + `v-phase-1a` tag
3. **Research**: Continue deep dives from DEEP-DIVE-TOPICS.md, more Leader of Light depth
