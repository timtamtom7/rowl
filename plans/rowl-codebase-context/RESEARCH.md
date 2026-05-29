# Rowl Codebase Context — Research

## Sources

- Research agent 1: `~/.hermes/hermes-agent/ai_coding_agents_context_management.md` — Cursor, Devin, SWE-agent context management systems
- Research agent 2: Codebase analysis tools — TreeSitter, embeddings, vector DBs, static analysis (partially lost in compaction)
- Research agent 3: Cognitive context mismanagement — SWE-agent internals, Cursor's custom embedding model (partially lost)
- Research agent 4: PM agent patterns — PM+b builder architecture, PM Chat context coordination (partially lost)

---

## Key Findings

### Finding 1: Cognitive Context Mismanagement is the Root Cause

From arXiv:2604.08906 — "cognitive context mismanagement" is one of three key root causes of agent failures (along with model-related faults and orchestration faults).

**Implication:** Even if your agents are smart, they fail when they lose track of what they were doing. This confirms exactly the problem Tommaso identified.

---

### Finding 2: Cursor's Custom Embedding Model (12.5% Improvement)

Cursor's semantic search uses a **custom embedding model trained on actual agent session traces**:

- When the agent performs searches and opens files, LLM ranks what content would have been helpful at each step
- Model trained to align similarity scores with LLM-generated rankings
- **Result: 12.5% accuracy improvement over grep alone**
- Available at 80% index completion, then incremental updates
- Indexing trigger: workspace open (automatic); sync every 5 minutes for changed files

**Implication for Rowl:** You don't need a general code embedding model. You need one trained on your actual usage patterns — what you search for, what you open, what turns out to be relevant.

---

### Finding 3: The PM+b Builder Pattern

Research into PM agent patterns (from agentic AI architecture studies):

```
PM owns what to build and in what order.
Builders own how to build it.
PM does NOT make low-level code decisions — it coordinates via "prompt packages":

TO: builder-auth-service
TASK: Implement JWT refresh token rotation
CONTEXT: [only what's relevant to this task]
ACCEPTANCE: [how we know it's done]
CONSTRAINTS: [what NOT to touch]
```

**Implication for Rowl:** The PM is the natural owner of the codebase context model. It reads from the index when planning, and updates it when builders report completions. But the PM itself should not be doing the indexing work — that's a background worker.

---

### Finding 4: Cursor's Hybrid Search System

Cursor combines three search mechanisms:

1. **Instant Grep** — exact match for symbols, regex, function names
2. **Semantic Search** — vector embeddings for conceptual queries
3. **File-level Diff Detection** — incremental sync, only changed files processed

All three are needed. Grep alone misses conceptual relevance. Embeddings alone miss exact symbol matches.

---

### Finding 5: Platform Comparison

| Platform      | Indexing Trigger      | Change Detection            | Persistence              | Key Innovation                                    |
| ------------- | --------------------- | --------------------------- | ------------------------ | ------------------------------------------------- |
| **Cursor**    | Workspace open        | 5-min sync, file-level diff | Session-based            | Custom embeddings trained on agent traces         |
| **Devin**     | Repo add (automatic)  | Not documented              | Multi-session continuity | Knowledge system + AGENTS.md + scheduled sessions |
| **SWE-agent** | Per-issue (on-demand) | None (fresh each task)      | None                     | Open source research platform                     |

**Consensus:** Hybrid persistent + incremental is the winning pattern.

---

## Tools Landscape

### Parsing

- **TreeSitter** — incremental AST for all languages; perfect for code chunking
- **Babel** — JS/TS transpilation; useful for understanding TSX component trees

### Embeddings

- **CodeBERT** / **GraphCodeBERT** — general code semantics
- **UnixCoder** / **CodeT5+** — cross-language
- **Custom fine-tune** — train on Rowl's actual session traces (highest ROI per Tommaso's use case)

### Static Analysis

- **Semgrep** — custom rules, fast, good for security/correctness patterns
- **CodeQL** — deep semantic queries, best for architectural analysis
- **Ruff** — Python health (if Rowl ever uses Python)

### Vector DB

- **Chroma** — simple, embedded, no server needed (MVP choice)
- **FAISS** — fast nearest-neighbor at scale
- **Pinecone** — managed, not self-hosted

### Graph Storage

- **Neo4j** — for dependency relationships between modules/packages

---

## Two Distinct Challenges

### Challenge A: Analyzing the Rowl Codebase (During Development)

While we're building Rowl, we need tools to understand what exists and how it relates. TreeSitter for AST-level understanding, custom embeddings trained on our session traces, static analysis for dependency graphs.

**MVP approach:** TreeSitter + CodeBERT + a vector DB (Chroma). Parse files, chunk by function/class, embed, store. Query returns ranked files.

### Challenge B: Runtime Index Maintenance (Rowl as Platform)

Once Rowl is running and managing projects, the PM agent needs persistent context. Background worker maintains the index. PM reads from it when planning. Builders emit completion events that trigger index updates.

**MVP approach:** Background worker on a 5-minute interval (Cursor's pattern). File watcher for immediate sync on git commits. Chroma for embeddings. Structured PM prompt packages for builder→PM communication.

---

## Architectural Decision: Hybrid Pattern

**Chosen approach:** Persistent background index + on-demand PM updates

1. **CodebaseIndexWorker** — background process that maintains persistent index
   - Runs on schedule (5-min intervals) or file-watch events
   - Maintains file structure + embeddings + complexity metrics
   - Can be queried without scanning live code
   - Isolated process — crash/restart independently

2. **PM reads from index** when planning
   - Does not scan live code for routine queries
   - Can request targeted re-scan for specific areas

3. **Builders emit structured completion events**
   - PM receives completion event
   - PM updates index to reflect new state

4. **Challenge A and B are separate but related**
   - Build Challenge A first (codebase analysis for human comprehension)
   - Challenge A's tools + data feed into Challenge B (runtime index)
   - Both use the same TreeSitter + embedding + vector DB pipeline

---

## Research Gaps

The following research was partially lost in session context compaction:

- Research agent 2: Full tools landscape for codebase analysis (TreeSitter alternatives, embedding model benchmarks, vector DB comparisons)
- Research agent 3: Deep dive on SWE-agent internals, specific embedding model architectures
- Research agent 4: PM+b pattern specifics, how prompt packages are structured in production systems

**Recommended:** Re-run agents 2-4 before implementation to fill gaps.

---

_Research completed: April 13, 2026_
_Synthesis from 4 parallel research agents (1 fully preserved, 3 partially lost in context compaction)_
