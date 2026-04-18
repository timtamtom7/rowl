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
      ["## persona — who", "I am Rowl.", "", "## overview — what", "A fork."].join("\n"),
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
