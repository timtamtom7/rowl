/**
 * Nerve Map — Function-level dependency analysis.
 *
 * Extracts function/component declarations and their call relationships
 * from TypeScript/JavaScript source files. This goes deeper than the
 * file-level Live Map — it shows which functions call which other functions.
 *
 * Uses regex-based extraction (not full AST) for speed. Catches ~80% of
 * function relationships in typical React/Node.js codebases.
 *
 * Inspired by Valo's Nerve Map: "See how every function connects.
 * Find what's broken, unused, and what will break if you change something."
 */

export interface FunctionNode {
  readonly id: string; // "filePath:functionName"
  readonly name: string;
  readonly filePath: string;
  readonly type: "function" | "component" | "class" | "method" | "hook" | "export";
  readonly lineNumber: number;
  readonly lineCount: number;
  readonly isExported: boolean;
}

export interface FunctionEdge {
  readonly source: string; // caller function id
  readonly target: string; // called function id
}

export interface NerveGraph {
  readonly functions: FunctionNode[];
  readonly calls: FunctionEdge[];
  readonly stats: {
    readonly totalFunctions: number;
    readonly totalCalls: number;
    readonly unusedFunctions: number; // declared but never called
    readonly hotFunctions: number; // called by 5+ other functions
  };
}

// ── Function declaration extraction ──────────────────────────────

const DECLARATION_PATTERNS = [
  // SPECIFIC PATTERNS FIRST (hooks, components) before generic functions
  // function useFoo — React hook
  { pattern: /^(?:export\s+)?function\s+(use[A-Z]\w+)\s*\(/gm, type: "hook" as const },
  // const useFoo = () => — React hook
  { pattern: /^(?:export\s+)?(?:const|let|var)\s+(use[A-Z]\w+)\s*=/gm, type: "hook" as const },
  // const Foo = memo(function — React component
  { pattern: /^(?:export\s+)?(?:const|let|var)\s+([A-Z]\w+)\s*=\s*(?:memo|forwardRef|React\.memo)\s*\(/gm, type: "component" as const },
  // function Foo() with capital letter — React component
  { pattern: /^(?:export\s+)?function\s+([A-Z]\w+)\s*\(/gm, type: "component" as const },
  // class Foo — class declaration
  { pattern: /^(?:export\s+)?class\s+(\w+)/gm, type: "class" as const },
  // GENERIC PATTERNS LAST
  // function foo() — standard function declaration
  { pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm, type: "function" as const },
  // const foo = () => — arrow function
  { pattern: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$]\w*)\s*=>/gm, type: "function" as const },
  // const foo = function() — function expression
  { pattern: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/gm, type: "function" as const },
];

function extractFunctions(
  filePath: string,
  content: string,
): FunctionNode[] {
  const lines = content.split("\n");
  const functions: FunctionNode[] = [];
  const seenNames = new Set<string>();

  for (const { pattern, type } of DECLARATION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      const name = match[1]!;
      if (seenNames.has(name)) continue;
      seenNames.add(name);

      // Calculate line number
      const beforeMatch = content.slice(0, match.index);
      const lineNumber = beforeMatch.split("\n").length;

      // Estimate function length (rough: count lines until next declaration or end)
      let endLine = lines.length;
      for (let i = lineNumber; i < lines.length; i++) {
        const line = lines[i]!;
        // End at next top-level declaration or closing brace at column 0
        if (i > lineNumber && (line.match(/^(?:export\s+)?(?:function|class|const|let|var)\s/) || line === "}")) {
          endLine = i;
          break;
        }
      }
      const lineCount = endLine - lineNumber + 1;

      const isExported = match[0]!.startsWith("export");

      functions.push({
        id: `${filePath}:${name}`,
        name,
        filePath,
        type: name.startsWith("use") && name[3]?.match(/[A-Z]/) ? "hook" : type,
        lineNumber,
        lineCount,
        isExported,
      });
    }
  }

  return functions;
}

// ── Call relationship extraction ─────────────────────────────────

function extractCalls(
  filePath: string,
  content: string,
  declaredNames: Set<string>,
  allNames: Set<string>,
): FunctionEdge[] {
  const edges: FunctionEdge[] = [];
  const functions = extractFunctions(filePath, content);

  for (const func of functions) {
    // Get the function body (approximate)
    const lines = content.split("\n");
    const startLine = func.lineNumber - 1;
    const endLine = Math.min(startLine + func.lineCount, lines.length);
    const body = lines.slice(startLine, endLine).join("\n");

    // Find calls to known functions in the body
    for (const targetName of allNames) {
      if (targetName === func.name) continue; // Skip self-calls (usually recursion)

      // Check if this function's body calls the target
      const callPattern = new RegExp(`\\b${targetName}\\s*\\(`, "g");
      if (callPattern.test(body)) {
        edges.push({
          source: func.id,
          target: targetName, // Will be resolved to full ID later
        });
      }
    }
  }

  return edges;
}

// ── Graph builder ───────────────────────────────────────────────

export function buildNerveGraph(
  files: ReadonlyArray<{
    relativePath: string;
    content: string;
  }>,
): NerveGraph {
  // Phase 1: Extract all function declarations
  const allFunctions: FunctionNode[] = [];
  const nameToId = new Map<string, string>(); // name → full ID

  for (const file of files) {
    const functions = extractFunctions(file.relativePath, file.content);
    for (const func of functions) {
      allFunctions.push(func);
      // If name already exists, prefer exported version
      if (!nameToId.has(func.name) || func.isExported) {
        nameToId.set(func.name, func.id);
      }
    }
  }

  const allNames = new Set(allFunctions.map((f) => f.name));

  // Phase 2: Extract call relationships
  const allEdges: FunctionEdge[] = [];

  for (const file of files) {
    const edges = extractCalls(
      file.relativePath,
      file.content,
      new Set(allFunctions.filter((f) => f.filePath === file.relativePath).map((f) => f.name)),
      allNames,
    );

    for (const edge of edges) {
      // Resolve target name to full ID
      const targetId = nameToId.get(edge.target);
      if (targetId) {
        allEdges.push({
          source: edge.source,
          target: targetId,
        });
      }
    }
  }

  // Phase 3: Calculate stats
  const calledIds = new Set(allEdges.map((e) => e.target));
  const callCounts = new Map<string, number>();
  for (const edge of allEdges) {
    callCounts.set(edge.target, (callCounts.get(edge.target) ?? 0) + 1);
  }

  const unusedFunctions = allFunctions.filter(
    (f) => f.isExported && !calledIds.has(f.id) && f.type !== "component",
  ).length;

  const hotFunctions = [...callCounts.values()].filter((count) => count >= 5).length;

  return {
    functions: allFunctions,
    calls: allEdges,
    stats: {
      totalFunctions: allFunctions.length,
      totalCalls: allEdges.length,
      unusedFunctions,
      hotFunctions,
    },
  };
}
