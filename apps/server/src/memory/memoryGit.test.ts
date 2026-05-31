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
