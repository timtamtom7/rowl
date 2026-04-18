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
      description: "has: a colon",
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
    const raw = ["---", "label: x", "description: y", "scope: sideways", "---", ""].join("\n");
    expect(() => parseBlock(raw)).toThrow(/scope/);
  });
});
