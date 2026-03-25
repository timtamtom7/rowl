import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export interface ReleaseChecksumEntry {
  readonly path: string;
  readonly sha256: string;
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join(posix.sep);
}

export function listReleaseFiles(rootDir: string): string[] {
  const resolvedRoot = resolve(rootDir);
  const discovered: string[] = [];

  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true }).toSorted((a, b) =>
      a.name.localeCompare(b.name),
    );

    for (const entry of entries) {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = normalizeRelativePath(relative(resolvedRoot, entryPath));
      if (relativePath === "SHA256SUMS") {
        continue;
      }

      discovered.push(entryPath);
    }
  };

  visit(resolvedRoot);
  return discovered;
}

export function computeSha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function createReleaseChecksums(rootDir: string): ReleaseChecksumEntry[] {
  const resolvedRoot = resolve(rootDir);
  return listReleaseFiles(resolvedRoot).map((filePath) => ({
    path: normalizeRelativePath(relative(resolvedRoot, filePath)),
    sha256: computeSha256(filePath),
  }));
}

export function serializeReleaseChecksums(entries: ReadonlyArray<ReleaseChecksumEntry>): string {
  return entries.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n");
}

export function writeReleaseChecksums(rootDir: string, outputPath?: string): string {
  const resolvedRoot = resolve(rootDir);
  const resolvedOutput = resolve(outputPath ?? `${resolvedRoot}/SHA256SUMS`);
  const entries = createReleaseChecksums(resolvedRoot);
  const serialized = serializeReleaseChecksums(entries);
  writeFileSync(resolvedOutput, serialized.length > 0 ? `${serialized}\n` : "", "utf8");
  return resolvedOutput;
}

function parseArgs(argv: ReadonlyArray<string>): {
  rootDir: string;
  outputPath: string | undefined;
} {
  let rootDir: string | undefined;
  let outputPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--output") {
      outputPath = argv[index + 1];
      if (!outputPath) {
        throw new Error("Missing value for --output.");
      }
      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    if (rootDir !== undefined) {
      throw new Error("Only one release asset directory can be provided.");
    }

    rootDir = argument;
  }

  return {
    rootDir: rootDir ?? "release",
    outputPath,
  };
}

const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { rootDir, outputPath } = parseArgs(process.argv.slice(2));
  const resolvedRoot = resolve(rootDir);
  const stat = statSync(resolvedRoot, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) {
    throw new Error(`Release asset directory not found: ${resolvedRoot}`);
  }

  const writtenPath = writeReleaseChecksums(resolvedRoot, outputPath);
  console.log(`Wrote SHA256SUMS to ${writtenPath}`);
}
