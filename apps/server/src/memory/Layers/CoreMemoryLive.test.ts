import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Effect } from "effect";
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
    const mdFiles = (await fs.readdir(globalDir)).filter((f) => f.endsWith(".md")).sort();
    expect(mdFiles).toEqual(["human.md", "persona.md", "preferences.md"]);
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
    const mdFiles = (await fs.readdir(globalDir)).filter((f) => f.endsWith(".md"));
    expect(mdFiles).toHaveLength(3);
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
    const mdFiles = (await fs.readdir(projMem)).filter((f) => f.endsWith(".md")).sort();
    expect(mdFiles).toEqual([
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
