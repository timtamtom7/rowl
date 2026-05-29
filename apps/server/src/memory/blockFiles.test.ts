import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readBlockFromDir, writeBlockToDir, listBlocksInDir, blockFileName } from "./blockFiles.ts";
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
    expect(read?.body).toContain("Architecture");
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
