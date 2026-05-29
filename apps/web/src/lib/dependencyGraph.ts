/**
 * Dependency graph builder for the Live Map.
 *
 * Scans a project's file tree for import/require/export statements
 * and builds a graph of file dependencies. Uses regex-based parsing
 * (fast, no AST) that covers ~90% of JS/TS import patterns.
 *
 * Returns nodes (files) and edges (dependencies) suitable for
 * React Flow rendering.
 */

export interface FileNode {
  readonly id: string; // relative path
  readonly name: string; // filename
  readonly directory: string; // parent directory
  readonly extension: string; // .ts, .tsx, .js, etc.
  readonly lineCount: number;
  readonly sizeBytes: number;
}

export interface DependencyEdge {
  readonly source: string; // importer file path
  readonly target: string; // imported file path
}

export interface DependencyGraph {
  readonly nodes: FileNode[];
  readonly edges: DependencyEdge[];
  readonly stats: {
    readonly totalFiles: number;
    readonly totalEdges: number;
    readonly avgConnectionsPerFile: number;
    readonly largestFile: { path: string; lines: number } | null;
    readonly isolatedFiles: number;
  };
}

// ── Import pattern matching ──────────────────────────────────────

const IMPORT_PATTERNS = [
  // import ... from "path"
  /import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g,
  // import "path" (side-effect imports)
  /import\s+["']([^"']+)["']/g,
  // export ... from "path"
  /export\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g,
  // require("path")
  /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  // dynamic import("path")
  /import\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function extractImports(fileContent: string): string[] {
  const imports = new Set<string>();
  for (const pattern of IMPORT_PATTERNS) {
    // Reset the regex
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(fileContent)) !== null) {
      const importPath = match[1];
      if (importPath && !importPath.startsWith("node:")) {
        imports.add(importPath);
      }
    }
  }
  return [...imports];
}

// ── Path resolution ────────────────────────────────────────────────

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function isRelativeImport(importPath: string): boolean {
  return importPath.startsWith("./") || importPath.startsWith("../");
}

function resolveRelativeImport(
  importerDir: string,
  importPath: string,
  knownFiles: Set<string>,
): string | null {
  // Normalize the path
  const parts = [...importerDir.split("/").filter(Boolean), ...importPath.split("/")];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  const basePath = resolved.join("/");

  // Try exact match first
  if (knownFiles.has(basePath)) return basePath;

  // Try with extensions
  for (const ext of SOURCE_EXTENSIONS) {
    if (knownFiles.has(basePath + ext)) return basePath + ext;
  }

  // Try as directory with index
  for (const ext of SOURCE_EXTENSIONS) {
    if (knownFiles.has(basePath + "/index" + ext)) return basePath + "/index" + ext;
  }

  return null;
}

// ── Alias resolution ────────────────────────────────────────────────

export interface PathAliases {
  readonly [prefix: string]: string; // e.g., "~/": "src/"
}

function resolveAliasedImport(
  importPath: string,
  aliases: PathAliases,
  knownFiles: Set<string>,
): string | null {
  for (const [prefix, replacement] of Object.entries(aliases)) {
    if (importPath.startsWith(prefix)) {
      const resolved = importPath.replace(prefix, replacement);
      // Try exact
      if (knownFiles.has(resolved)) return resolved;
      // Try with extensions
      for (const ext of SOURCE_EXTENSIONS) {
        if (knownFiles.has(resolved + ext)) return resolved + ext;
      }
      for (const ext of SOURCE_EXTENSIONS) {
        if (knownFiles.has(resolved + "/index" + ext)) return resolved + "/index" + ext;
      }
    }
  }
  return null;
}

// ── Graph builder ───────────────────────────────────────────────────

export function buildDependencyGraph(
  files: ReadonlyArray<{
    relativePath: string;
    content: string;
    sizeBytes: number;
  }>,
  aliases: PathAliases = {},
): DependencyGraph {
  const knownFiles = new Set(files.map((f) => f.relativePath));
  const nodes: FileNode[] = [];
  const edges: DependencyEdge[] = [];
  const connectionCount = new Map<string, number>();

  for (const file of files) {
    const parts = file.relativePath.split("/");
    const name = parts.pop() ?? file.relativePath;
    const directory = parts.join("/") || ".";
    const extMatch = name.match(/\.[^.]+$/);
    const extension = extMatch?.[0] ?? "";
    const lineCount = file.content.split("\n").length;

    nodes.push({
      id: file.relativePath,
      name,
      directory,
      extension,
      lineCount,
      sizeBytes: file.sizeBytes,
    });

    // Extract and resolve imports
    const imports = extractImports(file.content);
    for (const importPath of imports) {
      let resolvedTarget: string | null = null;

      if (isRelativeImport(importPath)) {
        resolvedTarget = resolveRelativeImport(directory, importPath, knownFiles);
      } else {
        // Try alias resolution
        resolvedTarget = resolveAliasedImport(importPath, aliases, knownFiles);
      }

      if (resolvedTarget && resolvedTarget !== file.relativePath) {
        edges.push({ source: file.relativePath, target: resolvedTarget });
        connectionCount.set(file.relativePath, (connectionCount.get(file.relativePath) ?? 0) + 1);
        connectionCount.set(resolvedTarget, (connectionCount.get(resolvedTarget) ?? 0) + 1);
      }
    }
  }

  // Stats
  const connectedFiles = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
  const isolatedFiles = nodes.filter((n) => !connectedFiles.has(n.id)).length;
  const largestFile = nodes.reduce<{ path: string; lines: number } | null>((max, n) => {
    if (!max || n.lineCount > max.lines) return { path: n.id, lines: n.lineCount };
    return max;
  }, null);

  return {
    nodes,
    edges,
    stats: {
      totalFiles: nodes.length,
      totalEdges: edges.length,
      avgConnectionsPerFile:
        nodes.length > 0 ? Math.round((edges.length / nodes.length) * 10) / 10 : 0,
      largestFile,
      isolatedFiles,
    },
  };
}
