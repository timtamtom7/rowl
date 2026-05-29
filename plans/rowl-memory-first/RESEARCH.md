# RESEARCH — Rowl Memory-First Agent

Reference analysis of the four open-source projects evaluated for this initiative.
See SPEC.md for what we actually decided to build.

---

## 1. The four repos

Cloned to `/Users/mauriello/Dev/_reference/` for reference reading:

| Repo               | Role for this sub-project                                    | Takeaway                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `letta-code`       | **Primary source — the memory pattern we are porting**       | Git-backed `.mdx` memory blocks, reminder engine, memory tool, Palace viewer. ~3,500 LOC of core TS.                                                                                                                                                                                                                                    |
| `craft-agents-oss` | **UI / window aesthetic inspiration** (NOT our runtime base) | Different app (Claude-Code-like for "Craft documents"). Studied its clean `AgentBackend` interface as an example of runtime-swap seams. Its sidebar + skills/MCP surface and Mac-native desktop feel are the visual reference for Rowl's UI polish as the project matures — especially relevant to sub-project #4 (Research/Review UX). |
| `paperclip`        | For a future sub-project (#2 — organizing layer)             | Goal/Issue/Document/Feedback/Approval model. Not touched in sub-project #1.                                                                                                                                                                                                                                                             |
| `t3code`           | The base of current Rowl                                     | Rowl is already a fork of t3code via `yappologistic/t3code`. Confirmed by `package.json` name `@t3tools/monorepo` and git remotes.                                                                                                                                                                                                      |

## 2. The Letta integration decision (A / B / C)

Letta's memory system consists of: memory blocks (markdown with frontmatter), a reminder engine, a memory tool the agent calls to edit blocks, git-backed storage, and a Memory Palace HTML viewer. The core runtime also depends on a **Letta server** that handles archival/vector memory and hosts the bare git endpoint for block sync.

Three integration options evaluated:

- **A. Point Rowl at hosted Letta API (`letta.com`).** Every user needs a Letta account. All data leaves the user's machine. Rowl becomes dependent on Letta's availability, pricing, and roadmap. Archival memory is "free" (server-side). Rejected — incompatible with Rowl's privacy-first posture and creates a hard external dependency.

- **B. Self-host a Letta server locally (bundled in Electron app).** Data stays local. Full Letta feature set. But adds hundreds of MB to the Rowl install (Python runtime + vector DB + models). Adds operational complexity (start/stop, port conflicts, upgrades, crashes). Still locks Rowl into Letta's memory model. Rejected — operational overhead outweighs benefit.

- **C. Port the memory pattern into Rowl directly. No Letta dependency.** We re-implement memory blocks, reminder engine, memory tool, palace viewer in TypeScript inside Rowl's codebase (~1,500-2,500 LOC estimated, using Letta's ~3,500 LOC of TS as reference to translate from). Rowl stays self-contained. We own the model and can extend it (e.g., integrate with Paperclip-style goal ancestry in sub-project #2). Trade-off: no archival/vector search on day one; we would add that later as a pluggable module.

**Decision: C.** Captured in SPEC §3.

## 3. Letta-code surface we are drawing from

The following files in `/Users/mauriello/Dev/_reference/letta-code/` are the primary references:

| File / area                                  | Purpose                                                              | Notes                                                      |
| -------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/agent/memory.ts`                        | Memory block loading, parsing, scoping                               | ~136 lines. Model for Rowl's block module.                 |
| `src/agent/memoryGit.ts`                     | Git operations on memory repo (clone, pull, push, commit, hooks)     | ~762 lines. We need far less in phase 1a (no remote sync). |
| `src/agent/memoryFilesystem.ts`              | Directory structure, tree rendering                                  | ~300 lines.                                                |
| `src/tools/impl/Memory.ts`                   | Memory tool implementation (create/str_replace/insert/delete/rename) | ~400 lines. Model for Rowl's memory tool.                  |
| `src/reminders/engine.ts`                    | Assembles memory + skills + env into system reminders                | ~200 lines. Model for Rowl's reminder engine.              |
| `src/web/generate-memory-viewer.ts`          | Palace HTML generator                                                | Model for `/palace`.                                       |
| `src/cli/components/MemfsTreeViewer.tsx`     | In-TUI memory tree view                                              | Model for `/memory` in-app view.                           |
| `src/cli/commands/registry.ts`               | 59 slash commands enumerated                                         | Curated to ~10 for sub-project #1. See SPEC §9.            |
| `src/agent/create.ts` + `NewAgentDialog.tsx` | Agent creation flow                                                  | Model for Rowl's agent creation dialog (phase 1b).         |

## 4. What we are deliberately NOT porting from Letta

- **Remote git sync to a Letta server.** Memory lives locally only. No network operations in the memory module.
- **Archival memory.** Deferred. Phase 1e compaction partially substitutes.
- **Sleeptime reflection daemon.** Deferred; optional in phase 1e as a one-shot `/reflect`, not a background process.
- **The full 59-command slash registry.** We port ~10 memory-relevant commands; Rowl's existing slash command set covers the rest (`/model`, `/plan`, `/clear`, etc.).
- **Letta's `.af` agent export format.** Possible future interop, not needed now.
- **Memfs (filesystem-backed memory).** Ambiguous benefit; our approach already _is_ filesystem-backed.
- **Hooks system, statusline, reasoning-tab toggle, Ralph mode.** Outside sub-project scope.

## 5. What Rowl's existing base (t3code fork) gives us for free

From prior analysis of `/Users/mauriello/Dev/rowl/`:

- **Provider abstraction layer** — Claude, Codex, Copilot, KiloCode, Kimi, MiniMax, OpenCode, Pi. Memory preamble must be injected into whichever provider adapter is active; design must not assume a single provider.
- **Approval gate system** — command / file-read / file-change gates already exist, with scope choices (once / always-this-session / decline / cancel-turn). We add `memory-write` as a fourth type; no new UI framework needed.
- **Plan mode, permission policies** — existing, interacts with memory (plan proposals may reference memory, be stored as memory).
- **Workspace-local `.rowl/skills/` and `.rowl/commands/`** — sibling pattern to our new `.rowl/memory/` and `.rowl/agent.json`.
- **`AGENTS.md` at repo root** — workspace instructions. Separate from memory (instructions are authored manually; memory is accumulated by the agent). No collision.
- **Slash command system** — already present in composer (`ComposerCommandMenu.tsx`). Adding new commands is additive.
- **Persistence queue, session JSONL storage** — existing and unchanged. Memory is a sibling storage system.

## 6. Key t3code/Rowl features already present (not in scope here; noted for context)

So future-me does not re-plan these:

- Composer draft persistence (localStorage)
- Context window meter, traits picker
- Per-turn diff tree
- Git-native turn checkpoints
- Worktree automation (`t3code/{uuid}` branches)
- Stacked git actions (commit→push→PR)
- Remote pairing / device auth
- xterm.js terminal panes
- Auto-updater

These are candidates for polish or cherry-picking into a future sub-project (#3+), not relevant to memory-first.

## 7. Paperclip findings (deferred to sub-project #2)

Noted here so the memory sub-project is designed with the next one in mind:

- Paperclip's data model is Goal → Issue → Documents + Comments + Feedback + Approvals.
- Every piece of work traces to a strategic Goal (goal ancestry).
- Research organization emerges from issue-scoped versioned documents + feedback votes.
- When we integrate Paperclip-style organization in sub-project #2, **memory blocks and Paperclip documents are different things**. Blocks = agent's long-term understanding. Documents = research outputs tied to specific work.
- They may interact: an agent might reference a document when updating a block ("Per [decision-doc], we chose X"). Plan for this integration in sub-project #2 SPEC, not here.

## 8. References outside the 4 repos

The user's existing `~/.letta/plans/2026-04-17-rowl-external-tool-integration.md` synthesizes TurboQuant, WikiLLM, Paperclip, and Superpowers integration patterns. Not read in this research pass but noted as future reference material, particularly for the organizing layer (sub-project #2).

Existing Rowl vision: `docs/ROWL_VISION.md` — the "agentic engineering control room" framing. Memory-first is additive to (not replacing) that vision.
