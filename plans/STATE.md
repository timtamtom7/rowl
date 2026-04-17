# Rowl — Current State (Plans Front Door)

**Last updated:** 2026-04-17 (brainstorming session end)
**Current focus:** Sub-project #1 — Memory-First Agent (spec-draft, awaiting review)

> **If you are a new session resuming Rowl work, read this file FIRST.**
> It orients you in ~60 seconds and tells you what to read next.

---

## Overall Goal (immutable)

Rowl's memory-first evolution is a deliberate synthesis of four open-source reference projects. Each contributes a specific layer. Do NOT forget this — it is the whole reason for the multi-sub-project arc. If any future session proposes narrowing or replacing this vision, check with the user first.

| Source repo | License | Contributes | Sub-project |
|---|---|---|---|
| [letta-code](https://github.com/letta-ai/letta-code) | MIT | **Memory-first agent architecture** — git-backed memory blocks, reminder engine, self-editing memory tool, Palace viewer, slash-command surface, agent creation flow | #1 |
| [paperclip](https://github.com/paperclipai/paperclip) | Apache-2.0 | **Organizing layer** — Goal → Issue → Document/Feedback/Approval model, goal ancestry, versioned research docs as first-class artifacts | #2 |
| [t3code](https://github.com/pingdotgg/t3code) | MIT | **Runtime base** (current Rowl already a fork) + **cherry-pick features** — git-native turn checkpoints, worktrees, stacked PRs, composer draft persistence, context meter, per-turn diff trees, approval gates | base + #3 |
| [craft-agents-oss](https://github.com/lukilabs/craft-agents-oss) | Apache-2.0 | **UI / window aesthetic inspiration** — sidebar + skills/MCP surface, Mac-native desktop feel, information architecture. Reference for visual polish as Rowl matures. | ongoing (visual reference across all sub-projects, esp. #4) |

All four are license-compatible (MIT / Apache-2.0). The cloned reference repos live at `/Users/mauriello/Dev/_reference/`.

**The goal in one sentence:** memory-first agents (Letta pattern) inside a t3code-derived runtime base, organized by Paperclip-style goal/issue/document structure, with Craft Agents-grade UI polish.

---

## Where we are right now

- **Sub-project:** #1 — [rowl-memory-first](./rowl-memory-first/)
- **Phase:** pre-1a (spec under review; no code written yet)
- **Branch:** none yet
- **Blocker:** user review of SPEC.md and RESEARCH.md

## Last session handoff

Brainstormed the memory-first evolution of Rowl. Decided:
- Base = current Rowl (a t3code fork, confirmed via git remotes + package.json)
- Letta integration = **Option C** — port the memory pattern, no Letta dependency
- Memory = two-tier: global (`~/.rowl/agents/{id}/`) + project (`{repo}/.rowl/memory/`, gitignored)
- Agent model: one agent per project; threads inherit project's agent
- Self-editing memory: yes, from phase 1a, gated by existing approval system

Wrote SPEC.md, RESEARCH.md, STATUS.md for sub-project #1.

Next session resumes by: user approves spec → invoke `superpowers:writing-plans` to produce `PHASE-1A-PLAN.md` → hand plan to a fresh executing session via `superpowers:executing-plans`.

## The multi-initiative map

Sub-projects planned (in dependency order):

| # | Initiative | Status | Why this order |
|---|---|---|---|
| 1 | [rowl-memory-first](./rowl-memory-first/) | spec-draft | Foundational. Every subsequent feature behaves differently if agents have memory vs not. |
| 2 | rowl-organizing-layer *(future folder)* | not-started | Paperclip-style Goal/Issue/Document/Feedback/Approval layer on top of memory. |
| 3 | rowl-t3-cherrypicks *(future folder)* | not-started | Git checkpointing, worktrees, stacked PRs, composer-draft persistence, context-window meter, per-turn diff tree, etc. Self-contained cherry-picks from t3code. |
| 4 | rowl-research-ux *(future folder)* | not-started | Surfaces sub-project #2's data model as a real research workflow UI. |

Each sub-project = one folder under `plans/` with SPEC/RESEARCH/STATUS (and PHASE-*-PLAN.md files written as each phase begins).

## Reading order when you resume

**Every session start:**
1. This file (`plans/STATE.md`) — top section
2. Current sub-project's `STATUS.md` — session handoff + open questions
3. Current phase's `PHASE-*-PLAN.md` (if one exists)

**If zooming out or ambiguity:**
4. Current sub-project's `SPEC.md` — all phases, decisions, rationale
5. Current sub-project's `RESEARCH.md` — source-repo analysis + tradeoffs
6. `plans/INDEX.md` — full list of all Rowl initiatives (includes older pre-memory-first ones)
7. `docs/ROWL_VISION.md` — philosophical north star (agentic engineering control room, vibe coding)

## Reference material (external)

Reference repos cloned to `/Users/mauriello/Dev/_reference/`:
- `letta-code/` — **primary source for memory pattern**
- `craft-agents-oss/` — reference only (not our base)
- `paperclip/` — source for sub-project #2 (organizing layer)
- `t3code/` — the base of current Rowl

## Locked decisions across all sub-projects

- **2026-04-17** — Rowl base = current `/rowl` (t3code fork), NOT a fresh fork of craft-agents.
- **2026-04-17** — Letta: Option C (port pattern, no dep).
- **2026-04-17** — Memory storage: two-tier (global in `~/.rowl/`, project in `.rowl/memory/` gitignored default).
- **2026-04-17** — Agent ↔ thread: one agent per project.
- **2026-04-17** — Plans convention: use existing `plans/{initiative}/SPEC|RESEARCH|STATUS|PLAN|NOTES.md` pattern.
- **2026-04-17** — This STATE.md is the living front door. It is updated at every session end, every phase transition, every significant decision.

## Update discipline (non-negotiable)

Whenever you, the AI working on Rowl, do any of the following, you MUST update this file:

1. **Session end** — update "Last session handoff" with what happened and what's next.
2. **Phase transition** — update "Where we are right now".
3. **Sub-project transition** — update "Where we are right now" and the multi-initiative map.
4. **Architectural decision** — append to "Locked decisions across all sub-projects" with date.
5. **Spec revision** — note in "Last session handoff" that spec was revised and why.

Do not skip these updates. Future-you (with no context) will be reading this file to orient. If it is stale, orientation fails.
