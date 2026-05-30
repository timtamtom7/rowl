import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { CoreAgentMetadata, CoreAgentScope } from "@t3tools/contracts";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeAgentMetadata } from "./agentMetadataStore.ts";
import {
  createCoreAgentService,
  createFileCoreAgentStore,
  type CoreAgentService,
} from "./CoreAgentService.ts";
import { executeCoreAgentSlashCommand } from "./coreAgentSlashCommands.ts";
import {
  createMemoryPalaceService,
  MemoryPalaceLive,
  MemoryPalaceService,
  migrateMemoryNotesFromAgentMetadata,
} from "./MemoryPalaceService.ts";

const NOW = "2026-05-29T12:00:00.000Z";
const UPDATED = "2026-05-29T12:10:00.000Z";

let stateDir: string;
let projectRoot: string;
let generatedIds: string[];

beforeEach(async () => {
  stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-memory-palace-state-"));
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-memory-palace-project-"));
  generatedIds = [];
});

afterEach(async () => {
  await fs.rm(stateDir, { recursive: true, force: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

function globalScope(): CoreAgentScope {
  return { type: "global" };
}

function projectScope(): CoreAgentScope {
  return { type: "project", projectRoot };
}

function metadata(overrides: Partial<CoreAgentMetadata> = {}): CoreAgentMetadata {
  return {
    id: "agent-alpha",
    name: "Alpha",
    scope: globalScope(),
    personality: {
      kind: "custom",
      instructions: "Remember project decisions.",
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function coreAgents(): CoreAgentService {
  return createCoreAgentService({
    store: createFileCoreAgentStore({ stateDir }),
    now: () => NOW,
    generateId: () => {
      const id = generatedIds.shift();
      if (!id) throw new Error("Test did not provide a generated agent id");
      return id;
    },
  });
}

async function createActiveProjectAgent(): Promise<CoreAgentService> {
  const service = coreAgents();
  generatedIds.push("agent-alpha");
  await service.createAgent({
    scope: projectScope(),
    name: "Alpha",
    personality: {
      kind: "custom",
      instructions: "Project agent.",
    },
  });
  await service.setActiveAgent({ scope: projectScope(), agentId: "agent-alpha" });
  return service;
}

function run<T>(effect: Effect.Effect<T, never, MemoryPalaceService>): Promise<T> {
  return Effect.runPromise(
    effect.pipe(Effect.provide(MemoryPalaceLive({ stateDir, now: () => NOW }))),
  );
}

async function writeRawNote(dir: string, filename: string, contents: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${filename}.md`), contents, "utf8");
}

describe("MemoryPalaceService", () => {
  it("lists and reads global agent notes from {stateDir}/memory/{agentId}", async () => {
    await writeRawNote(
      path.join(stateDir, "memory", "agent-alpha"),
      "api-contracts",
      [
        "---",
        "label: api-contracts",
        "description: API contracts",
        "scope: global",
        "version: 1",
        "tags: [api, contracts]",
        `created: ${NOW}`,
        `updated: ${UPDATED}`,
        "---",
        "",
        "# API contracts",
        "",
        "Keep shared schemas in packages/contracts.",
      ].join("\n"),
    );

    const list = await run(
      Effect.gen(function* () {
        const palace = yield* MemoryPalaceService;
        return yield* palace.list({ scope: globalScope(), agentId: "agent-alpha" });
      }),
    );

    expect(list.notes).toEqual([
      {
        filename: "api-contracts",
        title: "API contracts",
        tags: ["api", "contracts"],
        created: NOW,
        updated: UPDATED,
      },
    ]);

    const note = await run(
      Effect.gen(function* () {
        const palace = yield* MemoryPalaceService;
        return yield* palace.read({
          scope: globalScope(),
          agentId: "agent-alpha",
          filename: "api-contracts",
        });
      }),
    );

    expect(note).toMatchObject({
      filename: "api-contracts",
      title: "API contracts",
      content: expect.stringContaining("Keep shared schemas"),
    });
  });

  it("uses project memory for project-scoped agents", async () => {
    await writeRawNote(
      path.join(projectRoot, ".rowl", "memory"),
      "architecture",
      [
        "---",
        "label: architecture",
        "description: Package layout",
        "scope: project",
        "version: 1",
        "---",
        "",
        "# Project architecture",
        "",
        "Server owns orchestration; web owns session UX.",
      ].join("\n"),
    );

    const list = await run(
      Effect.gen(function* () {
        const palace = yield* MemoryPalaceService;
        return yield* palace.list({ scope: projectScope(), agentId: "agent-project" });
      }),
    );

    expect(list.notes).toMatchObject([
      {
        filename: "architecture",
        title: "Project architecture",
        tags: [],
      },
    ]);
  });

  it("writes and deletes markdown notes with YAML frontmatter", async () => {
    await run(
      Effect.gen(function* () {
        const palace = yield* MemoryPalaceService;
        yield* palace.write({
          scope: globalScope(),
          agentId: "agent-alpha",
          filename: "release-hardening",
          title: "Release hardening",
          tags: ["release", "ci"],
          content: "# Release hardening\n\nAlways verify SHA256SUMS.",
        });
      }),
    );

    const filePath = path.join(stateDir, "memory", "agent-alpha", "release-hardening.md");
    const raw = await fs.readFile(filePath, "utf8");
    expect(raw).toContain("tags: [release, ci]");
    expect(raw).toContain(`created: ${NOW}`);
    expect(raw).toContain("# Release hardening");

    await run(
      Effect.gen(function* () {
        const palace = yield* MemoryPalaceService;
        yield* palace.delete({
          scope: globalScope(),
          agentId: "agent-alpha",
          filename: "release-hardening",
        });
      }),
    );

    await expect(fs.stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("migrates legacy metadata memoryNotes into note files and removes metadata field", async () => {
    const metadataPath = path.join(stateDir, "agents", "agent-alpha", "metadata.json");
    writeAgentMetadata({ filePath: metadataPath, metadata: metadata() });
    const raw = JSON.parse(await fs.readFile(metadataPath, "utf8")) as Record<string, unknown>;
    raw.memoryNotes = [
      {
        filename: "review-style",
        title: "Review style",
        tags: ["review"],
        content: "# Review style\n\nLead findings with bugs.",
        created: NOW,
        updated: UPDATED,
      },
      "Prefer focused tests for narrow changes.",
    ];
    await fs.writeFile(metadataPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");

    const result = await migrateMemoryNotesFromAgentMetadata({
      stateDir,
      metadataPath,
      now: () => NOW,
    });

    expect(result).toEqual({ migrated: 2, agentId: "agent-alpha" });
    await expect(
      fs.readFile(path.join(stateDir, "memory", "agent-alpha", "review-style.md"), "utf8"),
    ).resolves.toContain("Lead findings with bugs.");
    const migratedRaw = JSON.parse(await fs.readFile(metadataPath, "utf8")) as Record<
      string,
      unknown
    >;
    expect(migratedRaw.memoryNotes).toBeUndefined();
  });

  it("seeds project-overview, tech-stack, and conventions through /init", async () => {
    await fs.writeFile(
      path.join(projectRoot, "package.json"),
      JSON.stringify(
        {
          name: "rowl-fixture",
          description: "Fixture project",
          packageManager: "bun@1.3.0",
          scripts: { test: "vitest run" },
          dependencies: { react: "^19.0.0" },
          devDependencies: { vitest: "^4.1.0" },
        },
        null,
        2,
      ),
      "utf8",
    );
    await fs.writeFile(
      path.join(projectRoot, "README.md"),
      "# Rowl Fixture\n\nA project README used to seed memory.",
      "utf8",
    );
    await fs.mkdir(path.join(projectRoot, ".rowl"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, ".rowl", "project-brief.md"), "Brief.", "utf8");

    const service = await createActiveProjectAgent();
    const memory = createMemoryPalaceService({ stateDir, now: () => NOW });
    const result = await executeCoreAgentSlashCommand({
      service,
      memory,
      scope: projectScope(),
      stateDir,
      text: "/init",
    });

    expect(result?.response).toContain("Seeded memory for Alpha (agent-alpha).");
    expect(result?.response).toContain("project-overview");
    expect(result?.response).toContain("tech-stack");
    expect(result?.response).toContain("conventions");
    expect(result?.response).toContain(".rowl/project-brief.md");

    await expect(
      fs.readFile(path.join(projectRoot, ".rowl", "memory", "project-overview.md"), "utf8"),
    ).resolves.toContain("A project README used to seed memory.");
    await expect(
      fs.readFile(path.join(projectRoot, ".rowl", "memory", "tech-stack.md"), "utf8"),
    ).resolves.toContain("react: ^19.0.0");
    await expect(
      fs.readFile(path.join(projectRoot, ".rowl", "memory", "conventions.md"), "utf8"),
    ).resolves.toContain("# Conventions");
  });

  it("reports memory health through /doctor", async () => {
    const service = await createActiveProjectAgent();
    const memory = createMemoryPalaceService({ stateDir, now: () => NOW });

    const emptyDoctor = await executeCoreAgentSlashCommand({
      service,
      memory,
      scope: projectScope(),
      stateDir,
      text: "/doctor",
    });
    expect(emptyDoctor?.response).toContain("No memory notes exist");
    expect(emptyDoctor?.response).toContain("Run /init to seed starter memories.");

    await executeCoreAgentSlashCommand({
      service,
      memory,
      scope: projectScope(),
      stateDir,
      text: "/init",
    });

    const doctor = await executeCoreAgentSlashCommand({
      service,
      memory,
      scope: projectScope(),
      stateDir,
      text: "/doctor",
    });

    expect(doctor?.response).toContain("Memory doctor for Alpha (agent-alpha)");
    expect(doctor?.response).toContain("3 memory notes found.");
    expect(doctor?.response).toContain("Empty notes: conventions.");
    expect(doctor?.response).toContain("Agent metadata.json matches the active agent id.");
    expect(doctor?.response).toContain("Agent metadata.json scope matches the active scope.");
  });
});
