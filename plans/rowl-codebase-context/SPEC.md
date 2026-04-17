# Rowl Codebase Context — SPEC

## Vision

Rowl needs to know its own codebase the way a senior engineer does — not just what files exist, but how they relate, what they do, and when they're relevant. This is not a doc system problem. It is an **agentic runtime problem**: a background worker that maintains a persistent, queryable model of the codebase, and the PM agent reads from it when planning rather than scanning live code every time.

**The bootstrapping problem:** You can't use Rowl to figure out how Rowl should manage its own context while you're building Rowl. So we do it manually with docs for now. But Rowl itself needs to solve this for real — a platform that builds agentic platforms must have itself as a first-class citizen.

---

## The Problem

Two distinct challenges that are easy to conflate:

### Challenge A: How Rowl Analyzes Its Own Codebase (During Development)

While we're building Rowl, we need to understand what each part does. This is about human comprehension + AI-assisted analysis tools.

**Questions it answers:**
- "What does this package/service do?"
- "What's the relationship between X and Y?"
- "Where would I find the code for feature Z?"
- "What changed in the last 20 files?"

**Tools/approaches:**
- TreeSitter for AST-level parsing
- Custom embeddings trained on Rowl's actual session traces (Cursor's approach — 12.5% better than grep)
- Static analysis (Semgrep, CodeQL) for dependency graphs
- File-level diff detection

### Challenge B: How Rowl Keeps Its Own Context Model Updated (Runtime)

Once Rowl is running and being used to build projects, the PM agent needs ongoing awareness of the codebase. This is about Rowl-as-platform maintaining a persistent context model.

**Questions it answers:**
- "What files are relevant to this feature request?"
- "What did we build last sprint?"
- "Where is X implemented right now?"
- "What's the overall architecture?"

**This requires:**
- A background worker that maintains the index (CodebaseIndexWorker)
- Change triggers (time-based, event-based, or PM-requested)
- A way for the PM to query the index without scanning live code

---

## Why Both Matter

### Challenge A → Build Better Features

Before we can build the runtime context system in Rowl, we need Rowl to understand its own codebase. The research tools, the codebase index, the PM agent's ability to reason about the architecture — all of this starts with understanding what exists.

### Challenge B → True Agentic Platform

A real agentic engineering platform doesn't rely on manual doc updates. The PM agent coordinates builders. It reads the codebase model when planning. It updates it when builders report completions. The workers live inside the app, not in a Google Doc.

---

## Architectural Decision Required

**Core question:** Should the codebase index be maintained by a background worker inside Rowl, or by the PM agent on-demand?

**Option 1: Background Worker (Cursor/Devin pattern)**
- CodebaseIndexWorker runs on a schedule or file-watch triggers
- Maintains persistent index: file structure + embeddings + complexity metrics
- PM reads from index, never scans live code
- Pro: Always ready, fast queries
- Con: Index can go stale; background resource cost

**Option 2: On-Demand (SWE-agent pattern)**
- PM builds context for each task by querying live code
- No persistent state
- Pro: Always current
- Con: Slow for large codebases; cognitive load on PM

**Option 3: Hybrid (Recommended)**
- Persistent background index (Option 1) for broad awareness
- PM can request a targeted re-scan for specific areas on demand
- PM updates index when builders report completions (structured events)
- Pro: Fast for common cases, flexible for edge cases

---

## Relationship to ROWL_ROADMAP_V2.md

This cuts across multiple tiers:

- **Tier 2 (Context Compression Real):** The index feeds into what gets summarized
- **Tier 3 (Multi-Agent Coordination):** The PM+b pattern requires the PM to have a persistent codebase model to coordinate builders
- **Tier 3 (Process Isolation):** Index workers should be isolated processes that can crash/restart independently
- **Tier 4 (Agent Type Abstraction):** The index worker is a specialized agent with declared capabilities

---

## Connection to Right Sidebar

The Context tab in the sidebar is the UI layer for this system. It currently shows:
- Context nodes (from OverseerReactor)
- Budget gauge
- Compress/restore/delete controls

The expanded Context tab should show:
- Codebase index status (when last updated, % indexed)
- Active file/function being worked on
- Relevance-scored files for current task
- Code complexity indicators per module

---

## Open Questions

1. Should Challenge A and B be tackled together or separately?
2. Is there a clean way to build Challenge A (codebase analysis) that also feeds into Challenge B (runtime index)?
3. What is the minimum viable version of the runtime index that still provides value?
4. How does this interact with the existing `.rowl/` workspace instruction system?

---

## Status

Architectural decision made: **Hybrid pattern** — persistent background index + on-demand PM updates. This is the Cursor/Devin consensus. Implementation is Tier 3.
