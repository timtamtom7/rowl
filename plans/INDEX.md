# Rowl Development Plans

A living index of all active and future Rowl initiatives. Each initiative is a self-contained folder with SPEC, RESEARCH, PLAN, STATUS files.

**➡ Living front door:** [`plans/STATE.md`](./STATE.md) — read this first at every session start. It always reflects the current focus, last handoff, and reading order.

---

## Active

| Initiative                                            | Status      | Last Updated | Summary                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [rowl-memory-first](./rowl-memory-first/)             | spec-draft  | 2026-04-17   | **Sub-project #1** of the memory-first evolution. Port Letta's memory pattern (git-backed blocks, reminder engine, memory tool, Palace viewer) into Rowl. Two-tier memory: global (cross-project) + project (per-codebase). See `plans/STATE.md`. |
| [rowl-doc-calibration](./rowl-doc-calibration/)       | in-progress | 2026-04-17   | Fixed V1 vs V2 inconsistencies, calibrated status language in V2                                                                                                                                                                                  |
| [rowl-overseer-hardening](./rowl-overseer-hardening/) | spec-draft  | 2026-04-17   | **PRIORITY #1** — scaffolded only, needs real AI output testing, confidence scoring, learning loop                                                                                                                                                |
| [rowl-right-sidebar](./rowl-right-sidebar/)           | spec-draft  | 2026-04-13   | Unified project state system — make all 6 tabs react as one                                                                                                                                                                                       |
| [rowl-outstanding](./rowl-outstanding/)               | verified    | 2026-04-13   | All Tier 2-4 roadmap items — verified against actual codebase. ~50% over-reported.                                                                                                                                                                |
| [index-system](./index-system/)                       | planning    | 2026-04-13   | The plans system itself — how we use plans during Rowl sessions                                                                                                                                                                                   |
| [rowl-codebase-context](./rowl-codebase-context/)     | done        | 2026-04-13   | Background worker keeps PM's codebase model updated — Tier 3. 10-agent audit complete.                                                                                                                                                            |

### Memory-First Evolution Roadmap (sub-projects #1–#4)

An arc of initiatives launched 2026-04-17 that ports proven patterns from four OSS reference projects (letta-code, paperclip, t3code, craft-agents-oss) into Rowl. Always read `plans/STATE.md` for current phase.

| #   | Sub-project                                                                                                       | Folder                                                                                 | Status      |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------- |
| 1   | Memory-first agent (Letta pattern, ported)                                                                        | [rowl-memory-first](./rowl-memory-first/)                                              | spec-draft  |
| 2   | Organizing layer (Paperclip-style Goal/Issue/Document/Approval)                                                   | _(future — subsumes `rowl-project-knowledge` and interacts with `rowl-right-sidebar`)_ | not-started |
| 3   | t3code cherry-picks (git checkpoints, worktrees, stacked PRs, composer drafts, context meter, per-turn diff tree) | _(future)_                                                                             | not-started |
| 4   | Research/review UX (surfaces sub-project #2's data model as a real research workflow)                             | _(future)_                                                                             | not-started |

---

## External Tool Integration Reference

See: `/Users/mauriello/.letta/plans/2026-04-17-rowl-external-tool-integration.md` for full synthesis of TurboQuant, WikiLLM, Paperclip, and Superpowers integration patterns.

---

## Future Initiatives (Priority Order)

| Initiative                   | Priority     | Tier   | Notes                                                                                                                                           |
| ---------------------------- | ------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| rowl-overseer-hardening      | HIGH         | Tier 2 | Scaffolded — needs real AI output testing, confidence scoring, learning loop                                                                    |
| harness-presets              | high         | Tier 2 | ProjectPromptsService + 5 built-in harness presets                                                                                              |
| multi-agent-coordination     | high         | Tier 3 | Two+ agents in separate worktrees, task graph later                                                                                             |
| spec-driven-dev-enforcement  | high         | Tier 2 | Overseer pattern: enforce spec-first, TDD before coding                                                                                         |
| context-compression-real     | medium       | Tier 2 | LLM-based summarization that actually reduces tokens                                                                                            |
| evaluator-agent-pattern      | medium       | Tier 3 | Lightweight evaluator after builder claims "done"                                                                                               |
| process-isolation-recovery   | medium       | Tier 3 | Isolated subprocess per agent, auto-restart                                                                                                     |
| apply-review-system-complete | medium       | Tier 3 | End-to-end approve/reject/rollback flow                                                                                                         |
| visual-dashboard-polish      | low          | Tier 3 | Dashboard polish, live agent status indicators                                                                                                  |
| rowl-project-knowledge       | _(subsumed)_ | Tier 2 | WikiLLM patterns for structured project memory — folded into `rowl-memory-first` (sub-project #1) and `rowl-organizing-layer` (sub-project #2). |
| agent-type-abstraction       | low          | Tier 4 | Agents declare capabilities (can_code, can_generate_images...)                                                                                  |
| flora-image-agents           | low          | Tier 4 | First-class image generation agent type                                                                                                         |
| flashboards-video-canvas     | low          | Tier 4 | AI video generation and visual canvas                                                                                                           |

---

## External Tool Integration (2026-04-17)

Research into external tools identified four complementary layers for non-coder product-builder UX:

| Tool            | Provides                                                   | Integration approach                                                          |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **TurboQuant**  | KV cache compression (6x memory, 8x speedup)               | Philosophy: data-oblivious compression for context system                     |
| **WikiLLM**     | LLM-compiled knowledge graphs                              | Pattern: parallel research, source ingestion, compilation → project knowledge |
| **Paperclip**   | Org charts, goals, budgets, governance, heartbeats         | Pattern: multi-agent orchestration for coordination                           |
| **Superpowers** | Skills framework — brainstorming, TDD, subagent-driven dev | Pattern: structured methodology layer for Rowl's skills system                |

**Lynchpin:** Overseer is priority #1 — it's the safety net that makes non-coders feel safe. Everything else flows from it working.

---

## How to Use This

During a Rowl session, reference any initiative by path:

- "What's the status of the right sidebar plan?"
- "Update the outstanding Rowl features plan with what we found today"
- "Does the rowl-outstanding plan cover the multi-agent coordination?"

After a session:

- "Sync notes to the rowl-right-sidebar STATUS.md"

---

## Vision

Rowl's right sidebar is the physical and metaphorical center of the agentic engineering control room.

```
PM Chat ←→ Goals ←→ Features ←→ Threads
              ↓
           Context ←→ Memory
```

When a user types in PM Chat "I want a login page" → Feature is created → Features tab lights up → Agent spawns → Threads shows it running → Context tracks consumption → Memory remembers why. **All 6 tabs react as one unified system.**

This maps directly to ROWL_VISION.md's arc: coding tool (today) → product building platform (near-term) → multi-medium creative workspace (future).
