import { describe, it, expect } from "vitest";
import { buildNerveGraph } from "./nerveMap";

describe("buildNerveGraph", () => {
  it("extracts function declarations", () => {
    const files = [
      {
        relativePath: "src/utils.ts",
        content: `export function formatDate(d: Date): string {
  return d.toISOString();
}

export function parseDate(s: string): Date {
  return new Date(s);
}`,
      },
    ];

    const graph = buildNerveGraph(files);
    expect(graph.functions.length).toBeGreaterThanOrEqual(2);
    expect(graph.functions.some((f) => f.name === "formatDate")).toBe(true);
    expect(graph.functions.some((f) => f.name === "parseDate")).toBe(true);
  });

  it("extracts React components", () => {
    const files = [
      {
        relativePath: "src/Button.tsx",
        content: `export function Button({ children }) {
  return <button>{children}</button>;
}`,
      },
    ];

    const graph = buildNerveGraph(files);
    expect(graph.functions.some((f) => f.name === "Button" && f.type === "component")).toBe(true);
  });

  it("extracts hooks", () => {
    const files = [
      {
        relativePath: "src/hooks.ts",
        content: `export function useCounter() {
  const [count, setCount] = useState(0);
  return { count, increment: () => setCount(c => c + 1) };
}`,
      },
    ];

    const graph = buildNerveGraph(files);
    expect(graph.functions.some((f) => f.name === "useCounter" && f.type === "hook")).toBe(true);
  });

  it("detects call relationships", () => {
    const files = [
      {
        relativePath: "src/app.ts",
        content: `function helper() { return 42; }
function main() { return helper(); }`,
      },
    ];

    const graph = buildNerveGraph(files);
    expect(graph.calls.some((c) => c.source.includes("main") && c.target.includes("helper"))).toBe(true);
  });

  it("calculates stats", () => {
    const files = [
      {
        relativePath: "src/app.ts",
        content: `export function unused() {}
function helper() {}
function main() { helper(); }`,
      },
    ];

    const graph = buildNerveGraph(files);
    expect(graph.stats.totalFunctions).toBeGreaterThanOrEqual(3);
    expect(graph.stats.totalCalls).toBeGreaterThanOrEqual(1);
  });

  it("handles empty input", () => {
    const graph = buildNerveGraph([]);
    expect(graph.functions).toHaveLength(0);
    expect(graph.calls).toHaveLength(0);
  });
});
