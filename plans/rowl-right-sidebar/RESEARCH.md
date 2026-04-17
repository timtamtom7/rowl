# Rowl Right Sidebar — Research

## Sources

- `docs/superpowers/specs/2026-04-13-sidebar-deep-improvements-design.md` — primary spec (220 lines)
- `docs/superpowers/specs/2026-04-13-comprehensive-build-plan.md` — all remaining work (161 lines)
- `docs/ROWL_ROADMAP_V2.md` — product roadmap (229 lines)
- `apps/server/src/projectWorkspaceMetadata.ts` — `.rowl/` file reader implementation
- `apps/web/src/routes/_chat.$threadId.tsx` — main chat route with SidebarProvider/Sidebar structure

## Key Findings from Session (2026-04-13)

### The Control Room Metaphor — Confirmed

User confirmed: the right sidebar (PM Chat, Threads, Features, Goals, Context) is the physical incarnation of the control room metaphor. All 6 tabs are 6 facets of one unified project model:

```
PM Chat ←→ Goals ←→ Features ←→ Threads
              ↓
           Context ←→ Memory
```

### Plans Directory is Separate from `.rowl/`

Plans live in `~/Dev/rowl/plans/` — NOT in `.rowl/` workspace instructions. Plans are pre-coding artifacts referenced by path during sessions. The `.rowl/` directory (AGENTS.md, commands/, skills/) is for workspace instructions auto-injected into AI context.

### ROWL_ROADMAP_V2.md is the Single Source of Truth

All product decisions live there. Phase 1-4 tiers. Tier 1 complete. Tier 2 in progress. Tiers 3-4 not started.

### Current Sidebar State

- 6 tabs with 12 components totaling ~3,200 lines
- All plumbing exists (services, WS methods, UI shells)
- Three systemic problems: stale data, no cross-tab nav, silent failures
- React Query already used for project/git data — extend to sidebar data

### Ignored dirs for live source scanning

`node_modules, .git, dist, build, .next, .nuxt, .rowl, .claude, .vscode, coverage, __pycache__, .turbo, .vercel, .output, release`

Plans directory is NOT in the ignored list — safe to put anywhere outside `.rowl/`.

### Source extensions scanned

`.ts, .tsx, .js, .jsx, .mjs, .cjs, .vue, .svelte, .astro, .css, .scss, .less, .json, .md, .mdx`

### Max file size for live scan

100KB

## Relevant ROWL_ROADMAP_V2.md Entries

From the roadmap priority stack:
- #11 Overseer — Tier 2, Needs testing
- #12 PM Chat — Tier 2, Done
- #14 Multi-Agent Coordination — Tier 3, Not started
- #15 Process Isolation — Tier 3, Not started
- #16 Apply/Review System — Tier 3, Partial
- #17 Visual Dashboard — Tier 3, Partial

## Connection to Comprehensive Build Plan

The `2026-04-13-comprehensive-build-plan.md` covers:
- Phase A: Fix blockers (approval loop, session status, brand rename)
- Phase B: Harness presets + ProjectPromptsService
- Phase C: Make existing features bulletproof (all E2E testing)
- Phase D: Polish to Valo-level
- Phase E: Advanced features (cross-thread context, evaluator, custom harnesses, codebase intelligence)

The right sidebar improvements enable much of Phase C (cross-tab integration) and Phase D (dashboard as control room).
