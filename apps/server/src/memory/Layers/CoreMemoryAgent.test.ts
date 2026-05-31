import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Effect } from "effect";

import { writeBlockToDir } from "../blockFiles.ts";
import { assembleMemoryPreamble } from "../preamble.ts";
import { CoreMemoryService } from "../Services/CoreMemoryService.ts";
import { CoreMemoryLive } from "./CoreMemoryLive.ts";

let stateDir: string;
let projectRoot: string;

beforeEach(async () => {
  stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-agent-state-"));
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-agent-project-"));
});

afterEach(async () => {
  await fs.rm(stateDir, { recursive: true, force: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

function layer() {
  return CoreMemoryLive({ stateDir });
}

describe("CoreMemoryLive agent awareness", () => {
  it("resolves global memory blocks from the active project agent directory", async () => {
    await writeBlockToDir(path.join(stateDir, "agents", "default", "memory"), {
      label: "persona",
      description: "default persona",
      readOnly: false,
      scope: "global",
      version: 1,
      body: "Default agent memory",
    });
    await writeBlockToDir(path.join(stateDir, "agents", "agent-alpha", "memory"), {
      label: "persona",
      description: "alpha persona",
      readOnly: false,
      scope: "global",
      version: 1,
      body: "Alpha agent memory",
    });
    await fs.mkdir(path.join(projectRoot, ".rowl", "agents"), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, ".rowl", "agents", "active-agent.json"),
      `${JSON.stringify({ activeAgentId: "agent-alpha" }, null, 2)}\n`,
      "utf8",
    );

    const blocks = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CoreMemoryService;
        return yield* svc.listGlobal({ projectRoot });
      }).pipe(Effect.provide(layer())),
    );

    expect(blocks.map((block) => block.body.trim())).toEqual(["Alpha agent memory"]);
  });

  it("keeps project memory shared by project while prepending active agent memory", async () => {
    await writeBlockToDir(path.join(stateDir, "agents", "agent-alpha", "memory"), {
      label: "persona",
      description: "alpha persona",
      readOnly: false,
      scope: "global",
      version: 1,
      body: "Alpha agent memory",
    });
    await writeBlockToDir(path.join(projectRoot, ".rowl", "memory"), {
      label: "overview",
      description: "project overview",
      readOnly: false,
      scope: "project",
      version: 1,
      body: "Project memory",
    });

    const preamble = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* CoreMemoryService;
        const global = yield* svc.listGlobal({ agentId: "agent-alpha" });
        const project = yield* svc.listProject({ projectRoot, agentId: "agent-alpha" });
        return assembleMemoryPreamble({ global, project });
      }).pipe(Effect.provide(layer())),
    );

    expect(preamble).toContain("Alpha agent memory");
    expect(preamble).toContain("Project memory");
    expect(preamble!.indexOf("Alpha agent memory")).toBeLessThan(
      preamble!.indexOf("Project memory"),
    );
  });

  it("rejects path traversal agent ids before resolving memory directories", async () => {
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* CoreMemoryService;
          return yield* svc.listGlobal({ agentId: "../escape" });
        }).pipe(Effect.provide(layer())),
      ),
    ).rejects.toThrow();
  });
});
