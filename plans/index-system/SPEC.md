# Index System — SPEC

## Vision

A lightweight, file-based planning system for Rowl itself. Plans live in `~/Dev/rowl/plans/` as markdown files that both humans and AI can read. Each initiative gets its own folder. The system is simple enough that it never becomes a project in itself.

## Design Principles

1. **Plans are artifacts, not overhead.** Creating a plan should take minutes, not hours. If the planning process is more work than the work itself, something is wrong.
2. **Plans are referenced by path, not injected.** During a Rowl session, you refer to a plan by saying "the right sidebar plan" — I read the files. Plans are NOT auto-injected into AI context (that's what `.rowl/` is for).
3. **Every initiative is self-contained.** SPEC.md, RESEARCH.md, PLAN.md, STATUS.md — all in one folder. No chasing links across the codebase.
4. **INDEX.md is the entry point.** One file shows all initiatives, status, and what they cover. Updated after each session.
5. **No tooling.** Plain markdown files. No database, no special apps, no integrations. If you can read a .md file, you can use this system.

## Structure

```
~/Dev/rowl/plans/
  INDEX.md                   ← Entry point: all initiatives, status, summary
  [initiative-slug]/         ← One folder per initiative
    SPEC.md                  ← What we're building and why
    RESEARCH.md              ← What we know, sources, key findings
    PLAN.md                  ← Step-by-step how to do it
    STATUS.md                 ← Current state, blockers, next action
    NOTES.md                  ← Optional: session notes, discoveries
```

## File Formats

### INDEX.md

```markdown
# Rowl Development Plans

## Active
| Initiative | Status | Last Updated | Summary |
|---|---|---|---|
| [name](./name/) | status | date | one-liner |

## Future
| Initiative | Priority | Tier | Notes |

## How to Use
(Short reference)
```

### SPEC.md

- Vision: what this initiative achieves and why it matters
- Problem statement: what's broken or missing today
- Design approach: the solution in broad strokes
- Scope: what's in and what's explicitly out
- Success criteria: how we know we're done

### RESEARCH.md

- Sources: links to docs, code, videos, past sessions
- Key findings: what we learned that informs the approach
- Context: anything that would be lost if we didn't write it down

### PLAN.md

- Before we start: questions to answer first
- Implementation steps: numbered, with verification after each
- Dependencies: what must be done first
- Risks: what could go wrong

### STATUS.md

- Last updated
- Current phase
- What's done / in progress / blocked
- Next action
- Notes

### NOTES.md (optional)

- Session notes
-临时 discoveries
- Ideas to revisit later

## Usage During Rowl Sessions

**Before a session:**
- "What's the status of the right sidebar plan?" → I read STATUS.md

**During a session:**
- "Update the outstanding Rowl features plan with what we found today" → I append to NOTES.md and update STATUS.md

**After a session:**
- "Sync notes to the rowl-right-sidebar STATUS.md" → I do it

**On-demand:**
- "Show me the rowl-outstanding plan" → I read and summarize
- "Add a new initiative for X" → I create the folder and files

## What This Is NOT

- NOT a project management tool — no boards, no assignees, no deadlines
- NOT auto-injected into AI context — use `.rowl/AGENTS.md` for that
- NOT a replacement for good documentation — plans go into SPEC.md then into actual docs/code when shipped
- NOT a TODO list — STATUS.md tracks state, PLAN.md tracks approach

## Why Not Trello/Linear/Obsidian?

This system is for plans about Rowl itself — the tool we're building. Using the tool we're building to plan the tool we're building creates circular dependencies. Plain markdown files work everywhere, forever, with zero maintenance.
