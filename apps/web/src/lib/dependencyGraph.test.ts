import { describe, it, expect } from "vitest";
import { buildDependencyGraph } from "./dependencyGraph";

describe("buildDependencyGraph", () => {
  it("extracts import edges between files", () => {
    const files = [
      {
        relativePath: "src/App.tsx",
        content: 'import { Button } from "./components/Button";\nimport React from "react";\n',
        sizeBytes: 100,
      },
      {
        relativePath: "src/components/Button.tsx",
        content: 'import { cn } from "../lib/utils";\n',
        sizeBytes: 50,
      },
      {
        relativePath: "src/lib/utils.ts",
        content: "export function cn() {}\n",
        sizeBytes: 30,
      },
    ];

    const graph = buildDependencyGraph(files);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges.length).toBeGreaterThanOrEqual(2);

    // App → Button
    expect(
      graph.edges.some(
        (e) => e.source === "src/App.tsx" && e.target === "src/components/Button.tsx",
      ),
    ).toBe(true);
    // Button → utils
    expect(
      graph.edges.some(
        (e) => e.source === "src/components/Button.tsx" && e.target === "src/lib/utils.ts",
      ),
    ).toBe(true);
  });

  it("resolves alias imports", () => {
    const files = [
      {
        relativePath: "src/App.tsx",
        content: 'import { cn } from "~/lib/utils";\n',
        sizeBytes: 50,
      },
      {
        relativePath: "src/lib/utils.ts",
        content: "export function cn() {}\n",
        sizeBytes: 30,
      },
    ];

    const graph = buildDependencyGraph(files, { "~/": "src/" });

    expect(
      graph.edges.some((e) => e.source === "src/App.tsx" && e.target === "src/lib/utils.ts"),
    ).toBe(true);
  });

  it("calculates stats correctly", () => {
    const files = [
      { relativePath: "a.ts", content: "", sizeBytes: 10 },
      { relativePath: "b.ts", content: 'import "./a";\n', sizeBytes: 20 },
    ];

    const graph = buildDependencyGraph(files);

    expect(graph.stats.totalFiles).toBe(2);
    expect(graph.stats.totalEdges).toBe(1);
    expect(graph.stats.isolatedFiles).toBe(0); // both connected
  });

  it("handles empty input", () => {
    const graph = buildDependencyGraph([]);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it("counts line numbers correctly", () => {
    const files = [{ relativePath: "big.ts", content: "line\n".repeat(100), sizeBytes: 500 }];

    const graph = buildDependencyGraph(files);
    expect(graph.nodes[0]?.lineCount).toBe(101); // 100 newlines + 1
  });
});
