# Rowl Codebase Context — Plan

## Goal

Build two related systems:

1. **Challenge A:** A codebase analysis toolkit for understanding Rowl's own code during development (human comprehension + AI-assisted)
2. **Challenge B:** A runtime CodebaseIndexWorker inside Rowl that keeps the PM's context model updated automatically

**Recommended order:** Challenge A first. Its tools + data naturally become Challenge B's foundation.

---

## Phase 1: Challenge A — Codebase Analysis Toolkit

### Step 1: Audit Current Rowl Codebase Structure

Understand what exists before building tools that operate on it.

**Do:**

- [ ] List all packages and their responsibilities (`apps/`, `packages/`, `docs/`)
- [ ] Map the key service dependencies (which service talks to which)
- [ ] Identify the largest/most complex modules
- [ ] Document the data flow from user message → AI response → UI update

**Verify:** A new team member can read the output and understand the rough architecture.

---

### Step 2: Set Up TreeSitter Parsing Pipeline

Parse TypeScript/TSX files into ASTs for structural analysis.

**Do:**

- [ ] Install TreeSitter CLI
- [ ] Write a parser script that walks `apps/` and `packages/`
- [ ] Extract: file declarations, import/export relationships, function signatures
- [ ] Output a JSON structure: `{ file, declarations[], imports[], exports[] }`

**Verify:** Script runs on the full codebase without errors, outputs parseable JSON.

---

### Step 3: Add Vector Embeddings (CodeBERT + Chroma)

Enable semantic search over the codebase.

**Do:**

- [ ] Install Chroma (embedded mode — no server needed)
- [ ] Load CodeBERT via HuggingFace Transformers
- [ ] Chunk files by function/class (use TreeSitter output from Step 2)
- [ ] Generate embeddings and store in Chroma
- [ ] Write a query function: natural language → ranked file results

**Verify:** "Where is the sidebar component defined?" returns relevant results.

---

### Step 4: Add Static Analysis (Semgrep Rules)

Catch patterns and understand code health.

**Do:**

- [ ] Install Semgrep
- [ ] Write Rowl-specific rules:
  - "No direct service-to-database calls from UI packages"
  - "Every async function must have error handling"
  - "No `any` types in public interfaces"
- [ ] Run across codebase, document findings

**Verify:** `semgrep --config=rowl-rules.yaml apps/ packages/` runs and returns findings.

---

### Step 5: Build a "Codebase Summary" Generator

Use the above tools to produce a readable architecture summary.

**Do:**

- [ ] Run TreeSitter → get file/declaration map
- [ ] Run embeddings query → identify semantically related clusters
- [ ] Run Semgrep → get code health score per package
- [ ] Combine into a markdown report: `### Package: apps/web ### Purpose: ... Dependencies: ... Health: ...`

**Verify:** Report is accurate enough that a new contributor could navigate the codebase with it.

---

## Phase 2: Challenge B — Runtime CodebaseIndexWorker

Start after Phase 1 is complete. The tools from Phase 1 become the engine of the worker.

---

### Step 6: Design the Worker Architecture

**Decisions to make before coding:**

- Should the worker run in the same process as Rowl, or a separate one?
- Should it use the same Chroma instance as Phase 1, or a separate runtime one?
- What events should trigger index updates? (file save, git commit, PM request)
- How does the PM read from the index vs. the builder reporting completions?

**Do:**

- [ ] Write architecture doc for CodebaseIndexWorker
- [ ] Define the event contract: what signals cause re-indexing?
- [ ] Define the query interface: how does PM ask "what files are relevant to X?"

---

### Step 7: Build the Background Worker

**Do:**

- [ ] Implement CodebaseIndexWorker as an isolated process
- [ ] Connect to same TreeSitter + Chroma pipeline from Phase 1
- [ ] Add 5-minute interval sync (Cursor's pattern)
- [ ] Add file watcher for immediate sync on git commits
- [ ] Add crash/restart logic (isolated subprocess)

**Verify:** Worker starts, builds index, stays alive across file changes, can be queried.

---

### Step 8: Integrate with PM Chat

**Do:**

- [ ] Add "codebase index status" to Context tab in sidebar
- [ ] PM reads from index when answering "where is X implemented?"
- [ ] PM emits structured completion events when builders finish tasks
- [ ] Worker updates index on completion events

**Verify:** PM Chat can answer "what package handles the sidebar?" without scanning live code.

---

## Dependencies

```
Phase 1 (Challenge A)
    ↓
Codebase Summary Generator
    ↓
Phase 2 (Challenge B)
    ↓
Worker + PM Integration
    ↓
Full Runtime Index
```

---

## Done Criteria

### Phase 1 Done when:

- Natural language queries return relevant files from Rowl codebase
- Architecture summary report is accurate and navigable
- Semgrep rules catch at least 3 real issues in the codebase

### Phase 2 Done when:

- Worker maintains live index across file changes
- PM reads from index for routine queries
- Index updates within 5 minutes of a builder completion event
