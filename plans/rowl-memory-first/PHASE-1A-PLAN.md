# Phase 1a — Core Memory Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Rowl agents persistent global + project memory. Memory is plain markdown blocks on disk, git-versioned, injected into every turn's context, editable by both user and agent through existing tooling.

**Architecture:** Two-tier memory dirs (global at `~/.t3/rowl/agents/{id}/memory/`, project at `{projectRoot}/.rowl/memory/`). A new `CoreMemoryService` (Effect-TS) owns block read/write + git. The provider-agnostic `ProviderCommandReactor.applyThreadTurnContext` hook prepends an `<agent_memory>` section to the user's message every turn — this gets memory into every provider (Codex, Copilot, KiloCode, Kimi, MiniMax, OpenCode, Pi) with zero per-adapter changes. Agent-side edits in 1a ride on top of existing file-edit tools + existing `file-change` approval gate; the dedicated `memory` tool with its own `memory-write` approval kind is deferred to a later phase (see §"Scope adjustment vs SPEC" below).

**Tech Stack:** TypeScript, Bun, Effect-TS (services via `ServiceMap.Service`), Vitest (colocated `.test.ts`), existing `GitCore` helpers, YAML-ish flat frontmatter (no external lib — we use Rowl's existing parser, extracted to a shared module).

---

## Scope adjustment vs SPEC (important — read before implementing)

SPEC §6 calls for a **dedicated `memory` tool** with 6 subcommands (`create` / `str_replace` / `insert` / `delete` / `rename` / `update_description`) and a **new `memory-write` approval kind**. Research during plan-authoring confirmed Rowl has **no central cross-provider tool registry** — tools are provider-native. Implementing SPEC §6 as specified requires either (a) inventing a cross-provider tool layer, or (b) duplicating the tool across seven provider adapters. Either is too much for phase 1a.

**Phase 1a revised scope:**
- Memory is file-based markdown at `.rowl/memory/*.md` and `~/.t3/rowl/agents/{id}/memory/*.md`, same as SPEC.
- Memory **contents** are injected into every turn via the provider-agnostic reactor hook (SPEC §5 delivered as specified).
- Memory **self-editing** uses the agent's existing file-edit tools. These already go through the `file-change` approval gate. Git-backing captures history. Atomic `str_replace` / `insert` semantics are provided by the agent's tools.
- `/remember {text}` is a user slash command that produces a message nudging the agent toward the right memory file (not a direct server command).
- The dedicated `memory` tool and new `memory-write` approval kind are **deferred to phase 1a-plus or 1b**, implemented once we decide whether to (a) introduce a cross-provider tool layer or (b) start with a single-provider prototype.

This is still a full implementation of core memory's *outcome*: persistent memory that the agent can read and edit, gated by approval, versioned in git, inspectable by the user. Task 14 updates SPEC.md to reflect this.

---

## File structure

New files (created by this plan):
- `packages/shared/src/frontmatter.ts` — extracted + exported frontmatter parsers
- `packages/shared/src/frontmatter.test.ts` — tests for extracted parsers
- `apps/server/src/memory/paths.ts` — dir resolution (global + project)
- `apps/server/src/memory/paths.test.ts`
- `apps/server/src/memory/block.ts` — block type, serialize, parse
- `apps/server/src/memory/block.test.ts`
- `apps/server/src/memory/blockFiles.ts` — read/write single block, list dir
- `apps/server/src/memory/blockFiles.test.ts`
- `apps/server/src/memory/defaultBlocks.ts` — default seed contents
- `apps/server/src/memory/Services/CoreMemoryService.ts` — Effect-TS service interface + tag
- `apps/server/src/memory/Layers/CoreMemoryLive.ts` — live layer
- `apps/server/src/memory/Layers/CoreMemoryLive.test.ts`
- `apps/server/src/memory/preamble.ts` — preamble assembly
- `apps/server/src/memory/preamble.test.ts`

Modified files:
- `apps/server/src/projectWorkspaceMetadata.ts` — inline parsers replaced with re-imports from `@t3tools/shared/frontmatter`
- `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts` — `applyThreadTurnContext` gains an `agentMemory` parameter; reactor reads `CoreMemoryService` before each turn
- `apps/server/src/orchestration/Layers/ProviderCommandReactor.test.ts` — cover new memory section
- `apps/server/src/serverLayers.ts` — wire `CoreMemoryService` live layer
- `apps/web/src/composer-logic.ts` — add `"remember"` to `ComposerSlashCommand`
- `apps/web/src/components/chat/ComposerCommandMenu.tsx` — add `/remember` entry
- `apps/web/src/session-logic.ts` (or wherever slash commands expand into messages) — handle `/remember` expansion (see Task 11 for the exact file)
- `AGENTS.md` — short note that memory is injected into every turn and lives in `.rowl/memory/`
- `plans/rowl-memory-first/SPEC.md` — §6 revised to record scope adjustment
- `plans/rowl-memory-first/STATUS.md` — phase 1a shipped
- `plans/STATE.md` — phase 1a shipped

No existing behavior regresses: all additions are additive. The reactor gains a new optional parameter; if `CoreMemoryService` returns empty memory, the turn behaves exactly as today.

---

## Task 1: Extract frontmatter parsers to shared module

**Why first:** Phase 1a reads block frontmatter constantly. Three unexported functions in `projectWorkspaceMetadata.ts:185-239` already do the parsing; extracting them avoids duplication and lets memory code depend on `@t3tools/shared` rather than on server internals.

**Files:**
- Create: `packages/shared/src/frontmatter.ts`
- Create: `packages/shared/src/frontmatter.test.ts`
- Modify: `apps/server/src/projectWorkspaceMetadata.ts` (replace inline funcs with re-imports)

### Steps

- [ ] **Step 1: Write failing test `packages/shared/src/frontmatter.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  parseFrontmatterSection,
  parseFlatFrontmatter,
  parseFrontmatterValue,
} from "./frontmatter.ts";

describe("parseFrontmatterSection", () => {
  it("splits a document with frontmatter and body", () => {
    const raw = "---\nfoo: bar\n---\nbody text";
    expect(parseFrontmatterSection(raw)).toEqual({
      frontmatter: "foo: bar",
      body: "body text",
    });
  });

  it("throws when frontmatter is not closed", () => {
    expect(() => parseFrontmatterSection("---\nfoo: bar\n")).toThrow(
      "Frontmatter is missing a closing --- line.",
    );
  });

  it("throws when document does not start with ---", () => {
    expect(() => parseFrontmatterSection("foo: bar")).toThrow(
      "Expected YAML frontmatter fenced by ---.",
    );
  });
});

describe("parseFrontmatterValue", () => {
  it("parses true/false to booleans", () => {
    expect(parseFrontmatterValue("true")).toBe(true);
    expect(parseFrontmatterValue("false")).toBe(false);
  });

  it("strips matching quotes", () => {
    expect(parseFrontmatterValue('"hello"')).toBe("hello");
    expect(parseFrontmatterValue("'hi'")).toBe("hi");
  });

  it("trims unquoted strings", () => {
    expect(parseFrontmatterValue("  abc  ")).toBe("abc");
  });
});

describe("parseFlatFrontmatter", () => {
  it("parses a flat key-value block", () => {
    const result = parseFlatFrontmatter("label: architecture\nread_only: true");
    expect(result).toEqual({ label: "architecture", read_only: true });
  });

  it("skips blank lines and comments", () => {
    const result = parseFlatFrontmatter("\n# a comment\nfoo: bar\n");
    expect(result).toEqual({ foo: "bar" });
  });

  it("throws on malformed lines", () => {
    expect(() => parseFlatFrontmatter("not a pair")).toThrow(
      "Invalid frontmatter line 'not a pair'.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test packages/shared/src/frontmatter.test.ts`
Expected: FAIL with "Cannot find module './frontmatter.ts'".

- [ ] **Step 3: Create `packages/shared/src/frontmatter.ts`**

Copy the three functions from `apps/server/src/projectWorkspaceMetadata.ts:185-239` verbatim, changing them from `function ...` to `export function ...`:

```typescript
export function parseFrontmatterSection(raw: string): { frontmatter: string; body: string } {
  if (!raw.startsWith("---")) {
    throw new Error("Expected YAML frontmatter fenced by ---.");
  }
  const lines = raw.split(/\r?\n/g);
  if (lines[0] !== "---") {
    throw new Error("Frontmatter must start on the first line.");
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closingIndex < 0) {
    throw new Error("Frontmatter is missing a closing --- line.");
  }
  return {
    frontmatter: lines.slice(1, closingIndex).join("\n"),
    body: lines
      .slice(closingIndex + 1)
      .join("\n")
      .trim(),
  };
}

export function parseFrontmatterValue(rawValue: string): string | boolean {
  const trimmed = rawValue.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseFlatFrontmatter(frontmatter: string): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const line of frontmatter.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) {
      throw new Error(`Invalid frontmatter line '${trimmed}'.`);
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1);
    result[key] = parseFrontmatterValue(rawValue);
  }
  return result;
}
```

- [ ] **Step 4: Verify `@t3tools/shared/frontmatter` subpath export**

Check `packages/shared/package.json` `exports` field. If it uses explicit subpath exports (per AGENTS.md: "Uses explicit subpath exports"), add:

```json
"./frontmatter": {
  "types": "./src/frontmatter.ts",
  "default": "./src/frontmatter.ts"
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test packages/shared/src/frontmatter.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Replace inline functions in `projectWorkspaceMetadata.ts`**

In `apps/server/src/projectWorkspaceMetadata.ts`, delete lines 185-239 (the three `function` definitions) and add near the top with the other imports:

```typescript
import {
  parseFlatFrontmatter,
  parseFrontmatterSection,
} from "@t3tools/shared/frontmatter";
```

(Do not import `parseFrontmatterValue` — it's only used internally by `parseFlatFrontmatter`.)

- [ ] **Step 7: Run existing tests to verify no regression**

Run: `bun run test apps/server/src/projectWorkspaceMetadata`
Expected: all existing tests still pass.

- [ ] **Step 8: Full lint + typecheck**

Run: `bun run fmt && bun run lint && bun run typecheck`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/frontmatter.ts packages/shared/src/frontmatter.test.ts packages/shared/package.json apps/server/src/projectWorkspaceMetadata.ts
git commit -m "refactor(shared): extract frontmatter parsers to @t3tools/shared/frontmatter"
```

---

## Task 2: Memory path resolution helpers

**Why:** Every subsequent memory operation needs to resolve "where do global blocks live" and "where do this project's blocks live." Isolate that so path logic can be unit-tested with a fake fs.

**Files:**
- Create: `apps/server/src/memory/paths.ts`
- Create: `apps/server/src/memory/paths.test.ts`

### Steps

- [ ] **Step 1: Write failing test `apps/server/src/memory/paths.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  globalAgentsRoot,
  globalAgentMemoryDir,
  projectMemoryDir,
  DEFAULT_AGENT_ID,
} from "./paths.ts";

describe("memory paths", () => {
  it("globalAgentsRoot composes from stateDir", () => {
    expect(globalAgentsRoot("/tmp/state")).toBe("/tmp/state/agents");
  });

  it("globalAgentMemoryDir scopes by agent id", () => {
    expect(globalAgentMemoryDir("/tmp/state", "agent-42")).toBe(
      "/tmp/state/agents/agent-42/memory",
    );
  });

  it("projectMemoryDir lives under {projectRoot}/.rowl/memory", () => {
    expect(projectMemoryDir("/home/x/proj")).toBe("/home/x/proj/.rowl/memory");
  });

  it("DEFAULT_AGENT_ID is a stable constant", () => {
    expect(DEFAULT_AGENT_ID).toBe("default");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test apps/server/src/memory/paths.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/server/src/memory/paths.ts`**

```typescript
/**
 * Filesystem paths for Rowl memory blocks.
 *
 * Two tiers:
 *   - global:  {stateDir}/agents/{agentId}/memory/
 *   - project: {projectRoot}/.rowl/memory/
 *
 * Phase 1a uses a single implicit agent per installation (DEFAULT_AGENT_ID).
 * Phase 1b introduces multi-agent support.
 */
import path from "node:path";

export const DEFAULT_AGENT_ID = "default";

export function globalAgentsRoot(stateDir: string): string {
  return path.join(stateDir, "agents");
}

export function globalAgentMemoryDir(stateDir: string, agentId: string): string {
  return path.join(globalAgentsRoot(stateDir), agentId, "memory");
}

export function projectMemoryDir(projectRoot: string): string {
  return path.join(projectRoot, ".rowl", "memory");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test apps/server/src/memory/paths.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/memory/paths.ts apps/server/src/memory/paths.test.ts
git commit -m "feat(memory): add path resolution for global and project memory dirs"
```

---

## Task 3: Memory block type + (de)serialization

**Why:** All block IO goes through a single serialize/parse pair. This isolates the frontmatter schema (label/description/read_only/scope/version) from file IO.

**Files:**
- Create: `apps/server/src/memory/block.ts`
- Create: `apps/server/src/memory/block.test.ts`

### Steps

- [ ] **Step 1: Write failing test `apps/server/src/memory/block.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { parseBlock, serializeBlock, type MemoryBlock } from "./block.ts";

describe("serializeBlock", () => {
  it("emits frontmatter + body", () => {
    const block: MemoryBlock = {
      label: "architecture",
      description: "High-level architecture.",
      readOnly: false,
      scope: "project",
      version: 1,
      body: "# Project architecture\n\nHere it is.",
    };
    expect(serializeBlock(block)).toBe(
      [
        "---",
        "label: architecture",
        "description: High-level architecture.",
        "read_only: false",
        "scope: project",
        "version: 1",
        "---",
        "",
        "# Project architecture",
        "",
        "Here it is.",
        "",
      ].join("\n"),
    );
  });

  it("quotes descriptions containing special characters", () => {
    const block: MemoryBlock = {
      label: "x",
      description: 'has: a colon',
      readOnly: false,
      scope: "global",
      version: 1,
      body: "",
    };
    const serialized = serializeBlock(block);
    expect(serialized).toContain('description: "has: a colon"');
  });
});

describe("parseBlock", () => {
  it("round-trips a serialized block", () => {
    const block: MemoryBlock = {
      label: "persona",
      description: "Who the agent is.",
      readOnly: true,
      scope: "global",
      version: 3,
      body: "I am Rowl.",
    };
    expect(parseBlock(serializeBlock(block))).toEqual(block);
  });

  it("defaults read_only to false and version to 1", () => {
    const raw = ["---", "label: x", "description: y", "scope: project", "---", "body"].join("\n");
    const block = parseBlock(raw);
    expect(block.readOnly).toBe(false);
    expect(block.version).toBe(1);
  });

  it("throws on missing label", () => {
    const raw = ["---", "description: y", "scope: project", "---", ""].join("\n");
    expect(() => parseBlock(raw)).toThrow(/label/);
  });

  it("throws on invalid scope", () => {
    const raw = [
      "---", "label: x", "description: y", "scope: sideways", "---", "",
    ].join("\n");
    expect(() => parseBlock(raw)).toThrow(/scope/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test apps/server/src/memory/block.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/server/src/memory/block.ts`**

```typescript
/**
 * MemoryBlock — a named, versioned piece of persistent agent memory.
 * Persisted as a markdown file with flat YAML frontmatter.
 */
import {
  parseFlatFrontmatter,
  parseFrontmatterSection,
} from "@t3tools/shared/frontmatter";

export type MemoryScope = "global" | "project";

export interface MemoryBlock {
  readonly label: string;
  readonly description: string;
  readonly readOnly: boolean;
  readonly scope: MemoryScope;
  readonly version: number;
  readonly body: string;
}

function needsQuoting(value: string): boolean {
  return /[:#]/.test(value) || value.trim() !== value;
}

function emitString(value: string): string {
  if (!needsQuoting(value)) return value;
  const escaped = value.replaceAll('"', '\\"');
  return `"${escaped}"`;
}

export function serializeBlock(block: MemoryBlock): string {
  const frontmatter = [
    "---",
    `label: ${emitString(block.label)}`,
    `description: ${emitString(block.description)}`,
    `read_only: ${block.readOnly ? "true" : "false"}`,
    `scope: ${block.scope}`,
    `version: ${block.version}`,
    "---",
    "",
  ].join("\n");
  const trimmedBody = block.body.trim();
  return trimmedBody.length === 0 ? `${frontmatter}\n` : `${frontmatter}${trimmedBody}\n`;
}

export function parseBlock(raw: string): MemoryBlock {
  const { frontmatter, body } = parseFrontmatterSection(raw);
  const fm = parseFlatFrontmatter(frontmatter);

  const label = fm.label;
  const description = fm.description;
  const scope = fm.scope;

  if (typeof label !== "string" || label.length === 0) {
    throw new Error("Memory block frontmatter requires a non-empty 'label'.");
  }
  if (typeof description !== "string" || description.length === 0) {
    throw new Error("Memory block frontmatter requires a non-empty 'description'.");
  }
  if (scope !== "global" && scope !== "project") {
    throw new Error(
      `Memory block frontmatter 'scope' must be 'global' or 'project', got '${String(scope)}'.`,
    );
  }

  const readOnlyRaw = fm.read_only;
  const readOnly = typeof readOnlyRaw === "boolean" ? readOnlyRaw : false;

  const versionRaw = fm.version;
  const versionParsed =
    typeof versionRaw === "string" ? Number.parseInt(versionRaw, 10) : Number.NaN;
  const version =
    Number.isFinite(versionParsed) && versionParsed >= 1 ? versionParsed : 1;

  return {
    label,
    description,
    readOnly,
    scope,
    version,
    body,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test apps/server/src/memory/block.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/memory/block.ts apps/server/src/memory/block.test.ts
git commit -m "feat(memory): memory block type + (de)serialization"
```

---

## Task 4: Block file IO (read / write / list)

**Why:** Keep filesystem IO isolated from the Effect-TS service so we can unit-test file layout behavior with a tmpdir.

**Files:**
- Create: `apps/server/src/memory/blockFiles.ts`
- Create: `apps/server/src/memory/blockFiles.test.ts`

### Steps

- [ ] **Step 1: Write failing test `apps/server/src/memory/blockFiles.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  readBlockFromDir,
  writeBlockToDir,
  listBlocksInDir,
  blockFileName,
} from "./blockFiles.ts";
import type { MemoryBlock } from "./block.ts";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-memory-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const sample: MemoryBlock = {
  label: "architecture",
  description: "High-level architecture.",
  readOnly: false,
  scope: "project",
  version: 1,
  body: "# Architecture\nbody",
};

describe("blockFileName", () => {
  it("uses label + .md", () => {
    expect(blockFileName("architecture")).toBe("architecture.md");
  });

  it("sanitizes path separators", () => {
    expect(blockFileName("a/b")).toBe("a_b.md");
  });
});

describe("writeBlockToDir / readBlockFromDir", () => {
  it("round-trips a block through the filesystem", async () => {
    await writeBlockToDir(tmp, sample);
    const read = await readBlockFromDir(tmp, "architecture");
    expect(read).toEqual(sample);
  });

  it("creates the directory if it does not exist", async () => {
    const deeper = path.join(tmp, "nested", "memory");
    await writeBlockToDir(deeper, sample);
    const read = await readBlockFromDir(deeper, "architecture");
    expect(read.body).toContain("Architecture");
  });

  it("returns null when block is absent", async () => {
    expect(await readBlockFromDir(tmp, "missing")).toBeNull();
  });
});

describe("listBlocksInDir", () => {
  it("returns empty array when dir does not exist", async () => {
    expect(await listBlocksInDir(path.join(tmp, "nope"))).toEqual([]);
  });

  it("returns blocks sorted by label", async () => {
    await writeBlockToDir(tmp, { ...sample, label: "zeta" });
    await writeBlockToDir(tmp, { ...sample, label: "alpha" });
    const blocks = await listBlocksInDir(tmp);
    expect(blocks.map((b) => b.label)).toEqual(["alpha", "zeta"]);
  });

  it("skips non-.md files", async () => {
    await fs.writeFile(path.join(tmp, "notes.txt"), "ignore");
    await writeBlockToDir(tmp, sample);
    const blocks = await listBlocksInDir(tmp);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.label).toBe("architecture");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test apps/server/src/memory/blockFiles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/server/src/memory/blockFiles.ts`**

```typescript
/**
 * Low-level memory block filesystem operations.
 * Pure IO — no Effect, no service layer; used by CoreMemoryService live layer.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseBlock, serializeBlock, type MemoryBlock } from "./block.ts";

export function blockFileName(label: string): string {
  const safe = label.replaceAll(/[\\/\\\\]/g, "_");
  return `${safe}.md`;
}

export async function writeBlockToDir(dir: string, block: MemoryBlock): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, blockFileName(block.label));
  await fs.writeFile(filePath, serializeBlock(block), "utf8");
}

export async function readBlockFromDir(
  dir: string,
  label: string,
): Promise<MemoryBlock | null> {
  const filePath = path.join(dir, blockFileName(label));
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  return parseBlock(raw);
}

export async function listBlocksInDir(dir: string): Promise<ReadonlyArray<MemoryBlock>> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const blocks: MemoryBlock[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const raw = await fs.readFile(path.join(dir, entry), "utf8");
    try {
      blocks.push(parseBlock(raw));
    } catch {
      // skip unparseable files; later tasks will surface these via a diagnostic.
    }
  }
  blocks.sort((a, b) => a.label.localeCompare(b.label));
  return blocks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test apps/server/src/memory/blockFiles.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/memory/blockFiles.ts apps/server/src/memory/blockFiles.test.ts
git commit -m "feat(memory): block filesystem IO (read/write/list)"
```

---

## Task 5: Default block seed contents

**Why:** SPEC §4.4 defines default blocks for global (persona/human/preferences) and project (overview/architecture/conventions/decisions/current-focus). Put them in one data-only file so later tasks — and the reader — can see exactly what's seeded.

**Files:**
- Create: `apps/server/src/memory/defaultBlocks.ts`
- (No test — this is pure data; tested by Task 7's service tests that consume it.)

### Steps

- [ ] **Step 1: Create `apps/server/src/memory/defaultBlocks.ts`**

```typescript
/**
 * Default memory blocks seeded on first use.
 *
 * Global blocks (per agent): persona, human, preferences.
 * Project blocks (per project bind): overview, architecture, conventions, decisions, current-focus.
 *
 * Keep bodies short. They are placeholders that the agent (and user) fill in
 * over time.
 */
import type { MemoryBlock } from "./block.ts";

export const DEFAULT_GLOBAL_BLOCKS: ReadonlyArray<MemoryBlock> = [
  {
    label: "persona",
    description: "Who this agent is. Tone, priorities, how it approaches problems.",
    readOnly: false,
    scope: "global",
    version: 1,
    body:
      "I am Rowl, a memory-first coding agent. I keep durable notes about the user and each project I work on, so every conversation starts with context instead of a blank slate.",
  },
  {
    label: "human",
    description: "What this agent knows about the user across all projects.",
    readOnly: false,
    scope: "global",
    version: 1,
    body: "(Empty — fills in as we work together.)",
  },
  {
    label: "preferences",
    description: "User preferences: coding style, communication, tooling.",
    readOnly: false,
    scope: "global",
    version: 1,
    body: "(Empty — fills in as we work together.)",
  },
];

export const DEFAULT_PROJECT_BLOCKS: ReadonlyArray<MemoryBlock> = [
  {
    label: "overview",
    description: "One-paragraph description of what this project is.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty — seed from first exchange or from /init in phase 1d.)",
  },
  {
    label: "architecture",
    description: "Package layout, data flow, key boundaries.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty.)",
  },
  {
    label: "conventions",
    description: "Coding conventions specific to this project.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty.)",
  },
  {
    label: "decisions",
    description: "Append-only log of architectural decisions with rationale.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty.)",
  },
  {
    label: "current-focus",
    description: "What we are working on right now.",
    readOnly: false,
    scope: "project",
    version: 1,
    body: "(Empty.)",
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/memory/defaultBlocks.ts
git commit -m "feat(memory): default block seeds for global + project"
```

---

## Task 6: CoreMemoryService interface

**Why:** Define the service shape first (tag + shape), so the reactor and live layer can both depend on the tag without circular deps. Mirrors `MemoryService.ts` style at `apps/server/src/orchestration/Services/MemoryService.ts`.

**Files:**
- Create: `apps/server/src/memory/Services/CoreMemoryService.ts`

### Steps

- [ ] **Step 1: Create `apps/server/src/memory/Services/CoreMemoryService.ts`**

```typescript
/**
 * CoreMemoryService — Letta-style named memory blocks injected into every turn.
 *
 * Two tiers:
 *   - global:  {stateDir}/agents/{agentId}/memory/*.md
 *   - project: {projectRoot}/.rowl/memory/*.md
 *
 * Sibling to `MemoryService` (SQLite/FTS5 archival memory — not yet implemented).
 * This service owns the "small, curated, always-in-prompt" layer; `MemoryService`
 * will own the "large, searchable, on-demand" layer in a later phase. See
 * `plans/rowl-memory-first/SPEC.md` §12.
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { MemoryBlock } from "../block.ts";

export interface CoreMemoryServiceShape {
  /** List global blocks for the (implicit, phase 1a) default agent. */
  readonly listGlobal: () => Effect.Effect<ReadonlyArray<MemoryBlock>>;

  /** List project blocks for the given project root. Returns [] if no dir. */
  readonly listProject: (input: {
    readonly projectRoot: string;
  }) => Effect.Effect<ReadonlyArray<MemoryBlock>>;

  /**
   * Ensure global memory dir exists with default blocks seeded.
   * No-op if the dir already has any block files.
   */
  readonly ensureGlobalSeeded: () => Effect.Effect<void>;

  /**
   * Ensure project memory dir exists with default blocks seeded.
   * No-op if the project dir already has any block files.
   */
  readonly ensureProjectSeeded: (input: {
    readonly projectRoot: string;
  }) => Effect.Effect<void>;
}

export class CoreMemoryService extends ServiceMap.Service<
  CoreMemoryService,
  CoreMemoryServiceShape
>()("rowl/memory/Services/CoreMemoryService") {}
```

- [ ] **Step 2: Typecheck passes**

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/memory/Services/CoreMemoryService.ts
git commit -m "feat(memory): CoreMemoryService interface"
```

---

## Task 7: CoreMemoryService live layer + tests

**Why:** The live layer wires paths → block IO → git-init. Tests use a tmpdir and assert the disk outcome; the git layer is added in the next task so this one stays focused.

**Files:**
- Create: `apps/server/src/memory/Layers/CoreMemoryLive.ts`
- Create: `apps/server/src/memory/Layers/CoreMemoryLive.test.ts`

### Steps

- [ ] **Step 1: Write failing test `apps/server/src/memory/Layers/CoreMemoryLive.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Effect, Layer } from "effect";
import { CoreMemoryService } from "../Services/CoreMemoryService.ts";
import { CoreMemoryLive } from "./CoreMemoryLive.ts";

let stateDir: string;
let projectRoot: string;

beforeEach(async () => {
  stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-state-"));
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-proj-"));
});

afterEach(async () => {
  await fs.rm(stateDir, { recursive: true, force: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

function layer() {
  return CoreMemoryLive({ stateDir });
}

describe("CoreMemoryLive", () => {
  it("ensureGlobalSeeded creates default blocks on first call", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CoreMemoryService;
        yield* svc.ensureGlobalSeeded();
      }).pipe(Effect.provide(layer())),
    );

    const globalDir = path.join(stateDir, "agents", "default", "memory");
    const files = (await fs.readdir(globalDir)).sort();
    expect(files).toEqual(["human.md", "persona.md", "preferences.md"]);
  });

  it("ensureGlobalSeeded is idempotent", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CoreMemoryService;
        yield* svc.ensureGlobalSeeded();
        yield* svc.ensureGlobalSeeded();
      }).pipe(Effect.provide(layer())),
    );
    const globalDir = path.join(stateDir, "agents", "default", "memory");
    const files = await fs.readdir(globalDir);
    expect(files).toHaveLength(3);
  });

  it("ensureGlobalSeeded preserves user edits", async () => {
    const globalDir = path.join(stateDir, "agents", "default", "memory");
    await fs.mkdir(globalDir, { recursive: true });
    await fs.writeFile(
      path.join(globalDir, "persona.md"),
      "---\nlabel: persona\ndescription: edited\nscope: global\n---\nuser wrote this",
      "utf8",
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CoreMemoryService;
        yield* svc.ensureGlobalSeeded();
      }).pipe(Effect.provide(layer())),
    );

    const contents = await fs.readFile(path.join(globalDir, "persona.md"), "utf8");
    expect(contents).toContain("user wrote this");
  });

  it("ensureProjectSeeded creates default project blocks", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CoreMemoryService;
        yield* svc.ensureProjectSeeded({ projectRoot });
      }).pipe(Effect.provide(layer())),
    );
    const projMem = path.join(projectRoot, ".rowl", "memory");
    const files = (await fs.readdir(projMem)).sort();
    expect(files).toEqual([
      "architecture.md",
      "conventions.md",
      "current-focus.md",
      "decisions.md",
      "overview.md",
    ]);
  });

  it("listGlobal returns seeded blocks sorted by label", async () => {
    const blocks = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CoreMemoryService;
        yield* svc.ensureGlobalSeeded();
        return yield* svc.listGlobal();
      }).pipe(Effect.provide(layer())),
    );
    expect(blocks.map((b) => b.label)).toEqual(["human", "persona", "preferences"]);
  });

  it("listProject returns [] when no memory dir exists", async () => {
    const blocks = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CoreMemoryService;
        return yield* svc.listProject({ projectRoot });
      }).pipe(Effect.provide(layer())),
    );
    expect(blocks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test apps/server/src/memory/Layers/CoreMemoryLive.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/server/src/memory/Layers/CoreMemoryLive.ts`**

```typescript
import { Effect, Layer } from "effect";
import { CoreMemoryService } from "../Services/CoreMemoryService.ts";
import { listBlocksInDir, writeBlockToDir } from "../blockFiles.ts";
import {
  DEFAULT_GLOBAL_BLOCKS,
  DEFAULT_PROJECT_BLOCKS,
} from "../defaultBlocks.ts";
import {
  DEFAULT_AGENT_ID,
  globalAgentMemoryDir,
  projectMemoryDir,
} from "../paths.ts";
import fs from "node:fs/promises";

async function dirHasAnyBlocks(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.some((e) => e.endsWith(".md"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

export function CoreMemoryLive(config: {
  readonly stateDir: string;
}): Layer.Layer<CoreMemoryService> {
  return Layer.succeed(CoreMemoryService, {
    listGlobal: () =>
      Effect.promise(() =>
        listBlocksInDir(globalAgentMemoryDir(config.stateDir, DEFAULT_AGENT_ID)),
      ),

    listProject: (input) =>
      Effect.promise(() => listBlocksInDir(projectMemoryDir(input.projectRoot))),

    ensureGlobalSeeded: () =>
      Effect.promise(async () => {
        const dir = globalAgentMemoryDir(config.stateDir, DEFAULT_AGENT_ID);
        if (await dirHasAnyBlocks(dir)) return;
        for (const block of DEFAULT_GLOBAL_BLOCKS) {
          await writeBlockToDir(dir, block);
        }
      }),

    ensureProjectSeeded: (input) =>
      Effect.promise(async () => {
        const dir = projectMemoryDir(input.projectRoot);
        if (await dirHasAnyBlocks(dir)) return;
        for (const block of DEFAULT_PROJECT_BLOCKS) {
          await writeBlockToDir(dir, block);
        }
      }),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test apps/server/src/memory/Layers/CoreMemoryLive.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/memory/Layers/CoreMemoryLive.ts apps/server/src/memory/Layers/CoreMemoryLive.test.ts
git commit -m "feat(memory): CoreMemoryLive layer with seeding + listing"
```

---

## Task 8: Memory preamble assembly

**Why:** Convert a list of blocks into the exact string we inject into the turn. Keep it pure so it's trivially testable; the reactor just calls it with the service's output.

**Files:**
- Create: `apps/server/src/memory/preamble.ts`
- Create: `apps/server/src/memory/preamble.test.ts`

### Steps

- [ ] **Step 1: Write failing test `apps/server/src/memory/preamble.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { assembleMemoryPreamble } from "./preamble.ts";
import type { MemoryBlock } from "./block.ts";

function blk(overrides: Partial<MemoryBlock>): MemoryBlock {
  return {
    label: "x",
    description: "d",
    readOnly: false,
    scope: "global",
    version: 1,
    body: "",
    ...overrides,
  };
}

describe("assembleMemoryPreamble", () => {
  it("returns null when no blocks have body content", () => {
    expect(assembleMemoryPreamble({ global: [], project: [] })).toBeNull();
  });

  it("renders global before project, each block as ## label — description", () => {
    const out = assembleMemoryPreamble({
      global: [blk({ label: "persona", description: "who", body: "I am Rowl." })],
      project: [blk({ label: "overview", description: "what", body: "A fork.", scope: "project" })],
    });
    expect(out).toBe(
      [
        "## persona — who",
        "I am Rowl.",
        "",
        "## overview — what",
        "A fork.",
      ].join("\n"),
    );
  });

  it("skips blocks with empty bodies", () => {
    const out = assembleMemoryPreamble({
      global: [
        blk({ label: "persona", description: "who", body: "Hi." }),
        blk({ label: "human", description: "user", body: "" }),
      ],
      project: [],
    });
    expect(out).toBe("## persona — who\nHi.");
  });

  it("orders well-known global blocks first, then alphabetical", () => {
    const out = assembleMemoryPreamble({
      global: [
        blk({ label: "zeta", description: "z", body: "z" }),
        blk({ label: "persona", description: "p", body: "p" }),
        blk({ label: "human", description: "h", body: "h" }),
        blk({ label: "preferences", description: "pr", body: "pr" }),
        blk({ label: "alpha", description: "a", body: "a" }),
      ],
      project: [],
    });
    const order = out!
      .split("\n")
      .filter((l) => l.startsWith("## "))
      .map((l) => l.slice(3).split(" ")[0]);
    expect(order).toEqual(["persona", "human", "preferences", "alpha", "zeta"]);
  });

  it("orders well-known project blocks first, then alphabetical", () => {
    const out = assembleMemoryPreamble({
      global: [],
      project: [
        blk({ label: "zeta", description: "z", body: "z", scope: "project" }),
        blk({
          label: "current-focus",
          description: "c",
          body: "c",
          scope: "project",
        }),
        blk({ label: "overview", description: "o", body: "o", scope: "project" }),
      ],
    });
    const order = out!
      .split("\n")
      .filter((l) => l.startsWith("## "))
      .map((l) => l.slice(3).split(" ")[0]);
    expect(order).toEqual(["overview", "current-focus", "zeta"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test apps/server/src/memory/preamble.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/server/src/memory/preamble.ts`**

```typescript
/**
 * Assemble the memory preamble injected into every turn.
 *
 * Format (per SPEC §5):
 *   ## {label} — {description}
 *   {body}
 *
 * Global blocks come first, then project blocks. Within each group, well-known
 * labels come first in a fixed order; remaining labels are alphabetical.
 */
import type { MemoryBlock } from "./block.ts";

const GLOBAL_WELL_KNOWN = ["persona", "human", "preferences"] as const;
const PROJECT_WELL_KNOWN = [
  "overview",
  "architecture",
  "conventions",
  "decisions",
  "current-focus",
] as const;

function orderBlocks(
  blocks: ReadonlyArray<MemoryBlock>,
  wellKnown: ReadonlyArray<string>,
): ReadonlyArray<MemoryBlock> {
  const byLabel = new Map(blocks.map((b) => [b.label, b]));
  const ordered: MemoryBlock[] = [];
  for (const label of wellKnown) {
    const b = byLabel.get(label);
    if (b) {
      ordered.push(b);
      byLabel.delete(label);
    }
  }
  const rest = [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
  return [...ordered, ...rest];
}

function renderBlock(block: MemoryBlock): string | null {
  const trimmed = block.body.trim();
  if (trimmed.length === 0) return null;
  return `## ${block.label} — ${block.description}\n${trimmed}`;
}

export function assembleMemoryPreamble(input: {
  readonly global: ReadonlyArray<MemoryBlock>;
  readonly project: ReadonlyArray<MemoryBlock>;
}): string | null {
  const parts: string[] = [];
  for (const b of orderBlocks(input.global, GLOBAL_WELL_KNOWN)) {
    const rendered = renderBlock(b);
    if (rendered) parts.push(rendered);
  }
  for (const b of orderBlocks(input.project, PROJECT_WELL_KNOWN)) {
    const rendered = renderBlock(b);
    if (rendered) parts.push(rendered);
  }
  if (parts.length === 0) return null;
  return parts.join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test apps/server/src/memory/preamble.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/memory/preamble.ts apps/server/src/memory/preamble.test.ts
git commit -m "feat(memory): assemble memory preamble from blocks"
```

---

## Task 9: Wire CoreMemoryService into server layers

**Why:** Make the service available for injection into `ProviderCommandReactor`. `serverLayers.ts` at `apps/server/src/serverLayers.ts` is Rowl's central layer composition (per research: already wires `MemoryService`, `MemoryEntries`, etc.).

**Files:**
- Modify: `apps/server/src/serverLayers.ts`

### Steps

- [ ] **Step 1: Read current `serverLayers.ts` to understand the layer-composition style**

Run: open `apps/server/src/serverLayers.ts` — find where `MemoryService` is provided around line 47/173 per research. Match that exact pattern.

- [ ] **Step 2: Add CoreMemoryLive layer**

At the top, import:

```typescript
import { CoreMemoryLive } from "./memory/Layers/CoreMemoryLive.ts";
```

In the layer composition, provide:

```typescript
CoreMemoryLive({ stateDir: config.stateDir })
```

Merge it into the main layer via `Layer.mergeAll` (or whatever pattern the file uses — match existing style).

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 4: Run server tests**

Run: `bun run test apps/server`
Expected: all existing tests still pass (we have not yet wired the reactor to use it).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/serverLayers.ts
git commit -m "feat(memory): wire CoreMemoryService into server layers"
```

---

## Task 10: Inject memory into per-turn context via ProviderCommandReactor

**Why:** SPEC §5. Every provider goes through `applyThreadTurnContext` (`ProviderCommandReactor.ts:93-156`). Adding an `agentMemory` parameter there makes memory available to Codex, Copilot, KiloCode, Kimi, MiniMax, OpenCode, and Pi in one change.

**Files:**
- Modify: `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`
- Modify: `apps/server/src/orchestration/Layers/ProviderCommandReactor.test.ts`

### Steps

- [ ] **Step 1: Write failing test in `ProviderCommandReactor.test.ts`**

Add a new `describe` block (append to existing file). The file already covers `applyThreadTurnContext` (per research, around line 345 in existing tests). Mirror that style:

```typescript
describe("applyThreadTurnContext — agent memory", () => {
  it("injects <agent_memory> section when preamble is non-empty", () => {
    const result = applyThreadTurnContext({
      agentsContents: undefined,
      messageText: "hello",
      agentMemory: "## persona — who\nI am Rowl.",
    });
    expect(result).toContain("<agent_memory>");
    expect(result).toContain("## persona — who");
    expect(result).toContain("</agent_memory>");
    expect(result.indexOf("<agent_memory>")).toBeLessThan(result.indexOf("<user_request>"));
  });

  it("omits <agent_memory> when preamble is null", () => {
    const result = applyThreadTurnContext({
      agentsContents: undefined,
      messageText: "hello",
      agentMemory: null,
    });
    expect(result).not.toContain("<agent_memory>");
  });

  it("places <agent_memory> after <workspace_instructions> and before <project_context>", () => {
    const result = applyThreadTurnContext({
      agentsContents: "AGENTS rules",
      messageText: "hi",
      agentMemory: "MEM",
      projectContext: "PC",
    });
    const iWorkspace = result.indexOf("<workspace_instructions");
    const iMemory = result.indexOf("<agent_memory>");
    const iProject = result.indexOf("<project_context>");
    expect(iWorkspace).toBeLessThan(iMemory);
    expect(iMemory).toBeLessThan(iProject);
  });
});
```

(Note: `applyThreadTurnContext` is currently not exported. Step 3 exports it.)

- [ ] **Step 2: Run test to verify it fails (compile error or export missing)**

Run: `bun run test apps/server/src/orchestration/Layers/ProviderCommandReactor.test.ts`
Expected: FAIL — either export-not-found or missing `agentMemory` param.

- [ ] **Step 3: Modify `ProviderCommandReactor.ts`**

a. Export `applyThreadTurnContext` (change `function applyThreadTurnContext` to `export function applyThreadTurnContext`).

b. Add `agentMemory?: string | null | undefined` to its input type.

c. Inside the function, after the `agentsContents` section and before the `projectContext` section, add:

```typescript
const normalizedAgentMemory = input.agentMemory?.trim();
if (normalizedAgentMemory && normalizedAgentMemory.length > 0) {
  sections.push("<agent_memory>", normalizedAgentMemory, "</agent_memory>");
}
```

Place it right after the `workspace_instructions` push (lines ~126-132 in current file) and before the `project_context` push (lines ~133-135). Also include the short-circuit branch at `:114-118` — if ALL of `resumeSummary`, `skills`, `projectContext`, AND `agentMemory` are empty, the function can still short-circuit.

d. In the reactor's turn-dispatch logic (the same file, where `applyThreadTurnContext` is called), resolve the memory preamble before the call:

```typescript
const coreMemory = yield* CoreMemoryService;
yield* coreMemory.ensureGlobalSeeded();
yield* coreMemory.ensureProjectSeeded({ projectRoot });
const global = yield* coreMemory.listGlobal();
const project = yield* coreMemory.listProject({ projectRoot });
const agentMemory = assembleMemoryPreamble({ global, project });
```

Imports to add:

```typescript
import { CoreMemoryService } from "../../memory/Services/CoreMemoryService.ts";
import { assembleMemoryPreamble } from "../../memory/preamble.ts";
```

Pass `agentMemory` into the `applyThreadTurnContext` call.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test apps/server/src/orchestration/Layers/ProviderCommandReactor.test.ts`
Expected: PASS — new memory tests pass, existing tests still pass.

- [ ] **Step 5: Full typecheck + test suite**

Run: `bun run fmt && bun run lint && bun run typecheck && bun run test`
Expected: clean. If `CoreMemoryService` isn't found by existing reactor tests, their Layer.provide probably needs `CoreMemoryLive({ stateDir: tmp })` added. Update affected test setups to provide a tmpdir-based `CoreMemoryLive`.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/orchestration/Layers/ProviderCommandReactor.ts apps/server/src/orchestration/Layers/ProviderCommandReactor.test.ts
git commit -m "feat(memory): inject <agent_memory> section into per-turn context"
```

---

## Task 11: Add `/remember` slash command (client-side)

**Why:** SPEC §9 — the user can say `/remember {text}` to ask the agent to record something. In 1a it's a thin client-side transform (no new server command) that turns into a user message with explicit memory guidance, letting the agent use its existing file-edit tool to update the right block.

**Files:**
- Modify: `apps/web/src/composer-logic.ts`
- Modify: `apps/web/src/components/chat/ComposerCommandMenu.tsx`
- Modify: one of `apps/web/src/composer-logic.ts` or wherever the existing slash commands expand into a message body

### Steps

- [ ] **Step 1: Locate current `/remember`-style slash command expansion point**

Run: `grep -rn '"init"\\|"compact"' apps/web/src/composer-logic.ts`
(Research identified this file. We need to find where e.g. `/init` is translated to a message.)

- [ ] **Step 2: Write failing test for composer-logic transform**

Create or extend `apps/web/src/composer-logic.test.ts` (matching whatever test file already exists next to `composer-logic.ts` — if none, create):

```typescript
import { describe, it, expect } from "vitest";
import { expandSlashCommand } from "./composer-logic.ts"; // adjust name to match current export

describe("/remember", () => {
  it("expands to a memory-guidance wrapper with the user text", () => {
    const result = expandSlashCommand({ command: "remember", argument: "I prefer tabs" });
    expect(result).toContain("I prefer tabs");
    expect(result).toMatch(/remember|\.rowl\/memory/i);
  });

  it("is a no-op when the argument is empty", () => {
    const result = expandSlashCommand({ command: "remember", argument: "" });
    expect(result).toBe("");
  });
});
```

Adjust the test to match the actual exported API of `composer-logic.ts` — the executor should discover the current export name before writing the test.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test apps/web/src/composer-logic.test.ts`
Expected: FAIL — command not recognized.

- [ ] **Step 4: Add `"remember"` to `ComposerSlashCommand`**

In `apps/web/src/composer-logic.ts:4-17`, add `"remember"` to the union. Add the expansion logic in the same file, near where other commands are handled. Example expansion body:

```typescript
case "remember":
  if (argument.trim().length === 0) return "";
  return [
    "Please remember the following and update the appropriate block under",
    "`.rowl/memory/` (or `~/.t3/rowl/agents/default/memory/` if it's about the user",
    "or general preferences rather than this project). Use your file-edit tool;",
    "it will go through the normal approval gate.",
    "",
    "Content to remember:",
    argument.trim(),
  ].join("\n");
```

- [ ] **Step 5: Add `/remember` to `ComposerCommandMenu.tsx`**

Add a new entry matching the existing pattern (name, description, argument hint).

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test apps/web/src/composer-logic.test.ts`
Expected: PASS.

- [ ] **Step 7: Full checks**

Run: `bun run fmt && bun run lint && bun run typecheck && bun run test`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/composer-logic.ts apps/web/src/composer-logic.test.ts apps/web/src/components/chat/ComposerCommandMenu.tsx
git commit -m "feat(memory): /remember slash command (client-side transform)"
```

---

## Task 12: Git-back the memory directories

**Why:** SPEC §6 specifies git-backed memory with per-edit commits. In 1a, since writes come from the agent's existing file-edit tool (not a dedicated memory tool), we stage+commit on a *post-turn* hook: after any turn in which `.rowl/memory/` files changed, commit them with a generic message. The global memory dir gets the same treatment.

**Files:**
- Create: `apps/server/src/memory/memoryGit.ts`
- Create: `apps/server/src/memory/memoryGit.test.ts`
- Modify: `apps/server/src/memory/Layers/CoreMemoryLive.ts` (optionally: auto-init on seed)

### Steps

- [ ] **Step 1: Write failing test `apps/server/src/memory/memoryGit.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { ensureMemoryRepo, commitMemoryChanges } from "./memoryGit.ts";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-memgit-"));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("ensureMemoryRepo", () => {
  it("initializes a git repo in the target dir if absent", async () => {
    await ensureMemoryRepo(dir);
    expect(await fs.stat(path.join(dir, ".git"))).toBeTruthy();
  });

  it("is idempotent when a repo already exists", async () => {
    execSync("git init", { cwd: dir });
    await ensureMemoryRepo(dir);
    expect(await fs.stat(path.join(dir, ".git"))).toBeTruthy();
  });
});

describe("commitMemoryChanges", () => {
  it("creates a commit when there are changes", async () => {
    await ensureMemoryRepo(dir);
    await fs.writeFile(path.join(dir, "a.md"), "hello");
    await commitMemoryChanges(dir, "add a");
    const log = execSync("git log --format=%s", { cwd: dir, encoding: "utf8" }).trim();
    expect(log).toBe("add a");
  });

  it("is a no-op when there are no changes", async () => {
    await ensureMemoryRepo(dir);
    await fs.writeFile(path.join(dir, "a.md"), "hello");
    await commitMemoryChanges(dir, "first");
    await commitMemoryChanges(dir, "noop"); // nothing to commit
    const log = execSync("git log --format=%s", { cwd: dir, encoding: "utf8" }).trim().split("\n");
    expect(log).toEqual(["first"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test apps/server/src/memory/memoryGit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/server/src/memory/memoryGit.ts`**

Use `GitCore` from `apps/server/src/git/Layers/GitCore.ts` if it can be used outside the full Effect context; otherwise shell out directly via `node:child_process` for these narrow operations. Prefer `GitCore` if it already runs without a full Effect layer — investigate by reading `GitCore.ts:1407-1411` (`initRepo` signature). If `GitCore` requires too much context, the narrow `execFile("git", …)` shell-out is acceptable here since this module is boundary code.

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const run = promisify(execFile);

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureMemoryRepo(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  if (await exists(path.join(dir, ".git"))) return;
  await run("git", ["init"], { cwd: dir });
  await run("git", ["config", "user.email", "memory@rowl.local"], { cwd: dir });
  await run("git", ["config", "user.name", "Rowl Memory"], { cwd: dir });
}

export async function commitMemoryChanges(dir: string, message: string): Promise<void> {
  await run("git", ["add", "-A"], { cwd: dir });
  // Bail out if nothing is staged
  try {
    await run("git", ["diff", "--cached", "--quiet"], { cwd: dir });
    return; // exit 0 = no changes staged
  } catch {
    // non-zero = there ARE changes; fall through and commit
  }
  await run("git", ["commit", "-m", message], { cwd: dir });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test apps/server/src/memory/memoryGit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Hook into reactor — commit after each turn**

In `ProviderCommandReactor.ts`, where the turn completes (after `applyThreadTurnContext` runs and the provider returns a result — find the "turn done" boundary; `mapProviderSessionStatusToOrchestrationStatus` around line 158 is a clue, but the actual turn-complete handler is elsewhere), add:

```typescript
yield* Effect.promise(() =>
  commitMemoryChanges(projectMemoryDir(projectRoot), "rowl: memory update").catch(() => {
    /* log only; never fail a turn because of memory git */
  }),
);
yield* Effect.promise(() =>
  commitMemoryChanges(
    globalAgentMemoryDir(config.stateDir, DEFAULT_AGENT_ID),
    "rowl: memory update",
  ).catch(() => {}),
);
```

Research did not identify the exact turn-complete line; the executor should find it by searching for where `thread.turn-start-requested` is processed to completion (`ProviderCommandReactor.ts` already has the `thread.*` handler switch around line 60+). If the right hook point isn't obvious, a deferred task is to add a clean "after-turn" hook; in the meantime commit on a simple post-dispatch point.

- [ ] **Step 6: Extend `ensureGlobalSeeded` / `ensureProjectSeeded` to call `ensureMemoryRepo` and make an initial commit**

In `CoreMemoryLive.ts`, after the seeding loop:

```typescript
await ensureMemoryRepo(dir);
await commitMemoryChanges(dir, "rowl: seed default blocks");
```

- [ ] **Step 7: Re-run full tests**

Run: `bun run test`
Expected: clean. Update `CoreMemoryLive.test.ts` to tolerate the `.git` dir appearing (existing test uses `readdir` and expects exactly 3 files — filter to `.md` only).

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/memory/memoryGit.ts apps/server/src/memory/memoryGit.test.ts apps/server/src/memory/Layers/CoreMemoryLive.ts apps/server/src/memory/Layers/CoreMemoryLive.test.ts apps/server/src/orchestration/Layers/ProviderCommandReactor.ts
git commit -m "feat(memory): git-back global + project memory dirs"
```

---

## Task 13: Gitignore `.rowl/memory/` in project by default

**Why:** SPEC §3 — project memory is gitignored by default (opt-in via `commitMemory: true`). In 1a we always gitignore (the opt-in config is phase 1b territory).

**Files:**
- Modify: `apps/server/src/memory/Layers/CoreMemoryLive.ts` (extend `ensureProjectSeeded`)

### Steps

- [ ] **Step 1: Write failing test (append to `CoreMemoryLive.test.ts`)**

```typescript
it("ensureProjectSeeded adds .rowl/memory to the project's .gitignore", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const svc = yield* CoreMemoryService;
      yield* svc.ensureProjectSeeded({ projectRoot });
    }).pipe(Effect.provide(layer())),
  );
  const gitignore = await fs.readFile(path.join(projectRoot, ".gitignore"), "utf8");
  expect(gitignore).toContain(".rowl/memory/");
});

it("ensureProjectSeeded does not duplicate the gitignore entry", async () => {
  await fs.writeFile(path.join(projectRoot, ".gitignore"), ".rowl/memory/\n");
  await Effect.runPromise(
    Effect.gen(function* () {
      const svc = yield* CoreMemoryService;
      yield* svc.ensureProjectSeeded({ projectRoot });
    }).pipe(Effect.provide(layer())),
  );
  const gitignore = await fs.readFile(path.join(projectRoot, ".gitignore"), "utf8");
  const occurrences = gitignore.match(/\.rowl\/memory\//g)?.length ?? 0;
  expect(occurrences).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test apps/server/src/memory/Layers/CoreMemoryLive.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement gitignore append in `CoreMemoryLive.ts`**

In `ensureProjectSeeded`, after seeding:

```typescript
const gitignorePath = path.join(input.projectRoot, ".gitignore");
let existing = "";
try {
  existing = await fs.readFile(gitignorePath, "utf8");
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}
const lines = existing.split(/\r?\n/);
if (!lines.some((l) => l.trim() === ".rowl/memory/")) {
  const next = existing.endsWith("\n") || existing.length === 0
    ? `${existing}.rowl/memory/\n`
    : `${existing}\n.rowl/memory/\n`;
  await fs.writeFile(gitignorePath, next, "utf8");
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test apps/server/src/memory/Layers/CoreMemoryLive.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/memory/Layers/CoreMemoryLive.ts apps/server/src/memory/Layers/CoreMemoryLive.test.ts
git commit -m "feat(memory): gitignore project memory dir by default"
```

---

## Task 14: Update SPEC, STATUS, STATE to reflect phase-1a reality

**Why:** Phase 1a ships with a scope adjustment (§"Scope adjustment vs SPEC" at the top of this plan). Docs must reflect reality, not aspirational SPEC, per AGENTS.md: "Treat stale docs as a bug."

**Files:**
- Modify: `plans/rowl-memory-first/SPEC.md`
- Modify: `plans/rowl-memory-first/STATUS.md`
- Modify: `plans/STATE.md`
- Modify: `AGENTS.md`

### Steps

- [ ] **Step 1: Update SPEC §6**

Replace the dedicated memory-tool section with a note:

> **Phase 1a implementation:** memory edits use the agent's existing file-edit tools, gated by the existing `file-change` approval. The dedicated `memory` tool (six subcommands, `memory-write` approval kind) is deferred to a later phase — we will either invent a cross-provider tool layer or prototype per-adapter. Rationale: Rowl has no central cross-provider tool registry (see RESEARCH.md §3 update), so a dedicated tool would have required either (a) a new abstraction layer or (b) seven per-adapter implementations, both outside phase-1a scope.

- [ ] **Step 2: Add a new locked decision to SPEC §3 and STATUS**

In SPEC §3 (the decisions table), append:
> | Memory-editing mechanism in 1a | Agent uses existing file-edit tools; dedicated memory tool deferred | Rowl has no cross-provider tool registry. File-edit tools already have `file-change` approval. |

In STATUS "Locked decisions":
> - **YYYY-MM-DD** — Phase 1a scope adjusted: memory edits via existing file-edit tools, not a dedicated memory tool. SPEC §6 updated. Dedicated memory tool + `memory-write` approval kind deferred to later phase.

- [ ] **Step 3: Update STATUS phase tracker**

Mark phase 1a status `in-progress` → `shipped`. Fill in branch name, tag.

- [ ] **Step 4: Update STATE.md**

- Update "Where we are right now" to phase 1b pending.
- Update "Last session handoff" with phase 1a retrospective.
- Append the scope-adjustment locked decision to "Locked decisions across all sub-projects".

- [ ] **Step 5: Update AGENTS.md**

Add a short note (in the appropriate section, near the existing `.rowl/` mentions):

> ### Memory
>
> Rowl agents have persistent memory at `~/.t3/rowl/agents/{agentId}/memory/` (global, per-agent) and `{projectRoot}/.rowl/memory/` (project, gitignored). Contents are injected into every turn as `<agent_memory>`. Agents update memory by editing those files with their standard file-edit tool.

- [ ] **Step 6: Commit**

```bash
git add plans/rowl-memory-first/SPEC.md plans/rowl-memory-first/STATUS.md plans/STATE.md AGENTS.md
git commit -m "docs(memory): phase 1a shipped — update SPEC/STATUS/STATE + AGENTS"
```

---

## Task 15: Smoke test end-to-end + tag release

**Why:** Automated tests cover units; we still need a manual sanity pass against a real provider to confirm memory actually shows up in the turn and the agent can write to it.

**Files:** (no file changes — manual verification + tag)

### Steps

- [ ] **Step 1: Pre-ship checks**

Run: `bun run fmt && bun run lint && bun run typecheck && bun run test`
Expected: all clean.

- [ ] **Step 2: Manual smoke (Codex adapter, as most-instrumented)**

1. Start dev server + web: `bun run dev:server` / `bun run dev:web` (per AGENTS.md port layout).
2. Open a new Rowl thread in a test project dir.
3. Confirm `{testProject}/.rowl/memory/` was created with five default `.md` files.
4. Confirm `~/.t3/rowl/agents/default/memory/` was created with three default `.md` files.
5. Confirm both dirs have `.git/`.
6. Confirm `.gitignore` in the test project contains `.rowl/memory/`.
7. Edit `persona.md` globally — put in "I love TypeScript." Start a new thread.
8. Ask the agent: "What do you know about me?" — the response should reference TypeScript (or at least mention it has persona info).
9. Type `/remember I prefer two-space indentation` and send. Approve any `file-change` approvals. Verify `preferences.md` was updated. Verify a new git commit appeared in `~/.t3/rowl/agents/default/memory/`.

- [ ] **Step 3: Tag the commit**

```bash
git tag v-phase-1a
git push origin main --tags   # only if user directs
```

(Per AGENTS.md: do not push unless explicitly requested.)

- [ ] **Step 4: Add retro log entry to STATUS.md**

In "Retro log" of `plans/rowl-memory-first/STATUS.md`, append a new section:

```markdown
### Phase 1a — Core memory substrate (shipped YYYY-MM-DD)

**What went well:**
- [fill in]

**What was painful:**
- [fill in]

**Notes for future phases:**
- Dedicated memory tool still owed. Research a cross-provider tool layer before phase 1b starts or commit to per-adapter implementations.
- The post-turn git commit hook is best-effort. If a cleaner "turn-complete" hook is added elsewhere in the reactor, re-wire.
```

- [ ] **Step 5: Commit retro**

```bash
git add plans/rowl-memory-first/STATUS.md
git commit -m "docs(memory): phase 1a retro"
```

---

## Scope check & self-review

**Spec coverage:**
- SPEC §3 (architectural decisions) — honored, with one adjustment captured in Task 14 for the memory-tool decision. ✓
- SPEC §4 (data model) — Tasks 3 (block), 5 (defaults), implicit in `paths.ts`. Agent data model (4.2) and project↔agent binding (4.3) are not implemented in 1a; a single implicit default agent suffices. Flagged for phase 1b in STATUS; not a regression since SPEC §10 lists "Multi-agent management UI" as out-of-scope for 1a.
- SPEC §5 (reminder engine) — Task 8 + Task 10. ✓
- SPEC §6 (memory tool) — **deferred**, documented in Task 14. ✓
- SPEC §9 (slash commands 1a) — `/remember` covered in Task 11. `/memory` is phase 1c, not 1a. ✓
- SPEC §10 phase-1a scope list — all five bullets covered except the agent-JSON file and `memory-write` approval (deferred, flagged). The "Migration: existing threads assigned to a default agent bound to their project" bullet is trivially satisfied since we use an implicit `DEFAULT_AGENT_ID`; no migration needed.

**Placeholders:** Task 9 step 1 and Task 11 step 1 ask the executor to locate specific code via targeted greps rather than guessing paths. This is intentional (the executor can do a 10-second lookup faster than this plan can guess across two files); each step specifies the exact grep pattern and the exact change to make once located.

**Type consistency:** `MemoryBlock` defined in Task 3 is used verbatim in Tasks 4, 5, 7, 8. `MemoryScope` is `"global" | "project"` throughout. `CoreMemoryService` shape in Task 6 matches usage in Tasks 7 (implementation), 10 (consumption), 9 (wiring). `DEFAULT_AGENT_ID = "default"` defined in Task 2, used in Tasks 7 and 12.

---

## Execution handoff

Plan complete and saved to `plans/rowl-memory-first/PHASE-1A-PLAN.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.

**2. Inline Execution** — execute tasks in the current session using `superpowers:executing-plans`, batch execution with checkpoints for review. REQUIRED SUB-SKILL: `superpowers:executing-plans`.

Which approach?
