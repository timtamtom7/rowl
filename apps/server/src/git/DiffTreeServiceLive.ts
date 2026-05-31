import {
  DiffTree,
  type DiffTree as DiffTreeResult,
  type DiffTreeNode,
  type DiffTreeNodeType,
  type GitGetDiffTreeInput,
} from "@t3tools/contracts";
import { Effect, Layer, Schema } from "effect";

import { GitCommandError } from "./Errors.ts";
import { GitService } from "./Services/GitService.ts";
import { DiffTreeService, type DiffTreeServiceShape } from "./DiffTreeService.ts";

const MAX_CACHE_ENTRIES = 200;

interface FileStats {
  path: string;
  insertions: number;
  deletions: number;
}

interface RefRange {
  fromRef: string;
  toRef: string;
}

function commandLabel(args: readonly string[]): string {
  return `git ${args.join(" ")}`;
}

function toGitError(
  operation: string,
  cwd: string,
  args: readonly string[],
  detail: string,
): GitCommandError {
  return new GitCommandError({
    operation,
    command: commandLabel(args),
    cwd,
    detail,
  });
}

function parseNonNegativeInt(value: string | undefined): number {
  if (!value || value === "-") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeRenamePath(rawPath: string): string {
  const pathValue = rawPath.trim();
  const arrowIndex = pathValue.indexOf(" => ");
  if (arrowIndex < 0) return pathValue;

  const openBraceIndex = pathValue.lastIndexOf("{", arrowIndex);
  const closeBraceIndex = pathValue.indexOf("}", arrowIndex);
  if (openBraceIndex >= 0 && closeBraceIndex > arrowIndex) {
    const prefix = pathValue.slice(0, openBraceIndex);
    const suffix = pathValue.slice(closeBraceIndex + 1);
    const inside = pathValue.slice(openBraceIndex + 1, closeBraceIndex);
    const insideArrowIndex = inside.indexOf(" => ");
    if (insideArrowIndex >= 0) {
      return `${prefix}${inside.slice(insideArrowIndex + " => ".length)}${suffix}`.trim();
    }
  }

  return pathValue.slice(arrowIndex + " => ".length).trim();
}

export function parseDiffNumstat(stdout: string): ReadonlyArray<FileStats> {
  const stats: FileStats[] = [];
  for (const line of stdout.split(/\r?\n/g)) {
    if (line.trim().length === 0) continue;
    const [insertionsRaw, deletionsRaw, ...pathParts] = line.split("\t");
    const rawPath = pathParts.join("\t").trim();
    if (rawPath.length === 0) continue;
    stats.push({
      path: normalizeRenamePath(rawPath),
      insertions: parseNonNegativeInt(insertionsRaw),
      deletions: parseNonNegativeInt(deletionsRaw),
    });
  }
  return stats;
}

export function parseDiffNameStatus(stdout: string): ReadonlyMap<string, DiffTreeNodeType> {
  const types = new Map<string, DiffTreeNodeType>();
  for (const line of stdout.split(/\r?\n/g)) {
    if (line.trim().length === 0) continue;
    const [status = "", firstPath = "", secondPath = ""] = line.split("\t");
    const statusCode = status.trim();
    const pathValue = (statusCode.startsWith("R") ? secondPath : firstPath).trim();
    if (pathValue.length === 0) continue;

    const type: DiffTreeNodeType = statusCode.startsWith("A")
      ? "added"
      : statusCode.startsWith("D")
        ? "deleted"
        : statusCode.startsWith("R")
          ? "renamed"
          : "modified";
    types.set(pathValue, type);
  }
  return types;
}

export function parseDiffHunkCounts(stdout: string): ReadonlyMap<string, number> {
  const hunks = new Map<string, number>();
  let currentPath: string | null = null;
  let pendingOldPath: string | null = null;

  for (const line of stdout.split(/\r?\n/g)) {
    if (line.startsWith("--- ")) {
      const oldPath = line.slice("--- ".length).trim();
      pendingOldPath = oldPath.startsWith("a/") ? oldPath.slice(2) : null;
      continue;
    }

    if (line.startsWith("+++ ")) {
      const newPath = line.slice("+++ ".length).trim();
      currentPath = newPath.startsWith("b/") ? newPath.slice(2) : pendingOldPath;
      pendingOldPath = null;
      continue;
    }

    if (line.startsWith("@@") && currentPath) {
      hunks.set(currentPath, (hunks.get(currentPath) ?? 0) + 1);
    }
  }

  return hunks;
}

function resolveInputRange(input: GitGetDiffTreeInput): RefRange {
  if (input.fromCheckpointRef && input.toCheckpointRef) {
    return {
      fromRef: input.fromCheckpointRef,
      toRef: input.toCheckpointRef,
    };
  }

  if (input.checkpointRef) {
    return {
      fromRef: input.fromRef ?? `${input.checkpointRef}^`,
      toRef: input.toRef ?? input.checkpointRef,
    };
  }

  if (input.fromRef && input.toRef) {
    return {
      fromRef: input.fromRef,
      toRef: input.toRef,
    };
  }

  if (input.fromRef) {
    return {
      fromRef: input.fromRef,
      toRef: "HEAD",
    };
  }

  if (input.toRef) {
    return {
      fromRef: `${input.toRef}^`,
      toRef: input.toRef,
    };
  }

  return {
    fromRef: "HEAD^",
    toRef: "HEAD",
  };
}

function buildNodes(input: {
  readonly numstat: string;
  readonly nameStatus: string;
  readonly patch: string;
}): ReadonlyArray<DiffTreeNode> {
  const stats = parseDiffNumstat(input.numstat);
  const types = parseDiffNameStatus(input.nameStatus);
  const hunksByPath = parseDiffHunkCounts(input.patch);
  const paths = new Set<string>();

  for (const stat of stats) paths.add(stat.path);
  for (const path of types.keys()) paths.add(path);
  for (const path of hunksByPath.keys()) paths.add(path);

  return Array.from(paths)
    .map((path) => {
      const stat = stats.find((entry) => entry.path === path);
      const fallbackType: DiffTreeNodeType =
        stat && stat.insertions > 0 && stat.deletions === 0
          ? "added"
          : stat && stat.deletions > 0 && stat.insertions === 0
            ? "deleted"
            : "modified";
      return {
        path,
        type: types.get(path) ?? fallbackType,
        hunks: hunksByPath.get(path) ?? 0,
        insertions: stat?.insertions ?? 0,
        deletions: stat?.deletions ?? 0,
      };
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

const makeDiffTreeService = Effect.gen(function* () {
  const git = yield* GitService;
  const cache = new Map<string, DiffTreeResult>();

  const runGitStdout = (
    operation: string,
    cwd: string,
    args: readonly string[],
  ): Effect.Effect<string, GitCommandError> =>
    git
      .execute({
        operation,
        cwd,
        args,
        timeoutMs: 30_000,
        maxOutputBytes: 5_000_000,
      })
      .pipe(Effect.map((result) => result.stdout));

  const getDiffTreeBetweenRefs: DiffTreeServiceShape["getDiffTreeBetweenRefs"] = (input) =>
    Effect.gen(function* () {
      const operation = "DiffTreeService.getDiffTreeBetweenRefs";
      const cacheKey = `${input.cwd}\0${input.fromRef}\0${input.toRef}\0${input.turnId ?? ""}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const commonArgs = ["diff", "--find-renames", input.fromRef, input.toRef, "--"] as const;
      const [stat, numstat, nameStatus, patch] = yield* Effect.all(
        [
          runGitStdout(operation, input.cwd, [
            ...commonArgs.slice(0, 1),
            "--stat",
            ...commonArgs.slice(1),
          ]),
          runGitStdout(operation, input.cwd, [
            ...commonArgs.slice(0, 1),
            "--numstat",
            ...commonArgs.slice(1),
          ]),
          runGitStdout(operation, input.cwd, [
            ...commonArgs.slice(0, 1),
            "--name-status",
            ...commonArgs.slice(1),
          ]),
          runGitStdout(operation, input.cwd, [
            ...commonArgs.slice(0, 1),
            "--unified=0",
            ...commonArgs.slice(1),
          ]),
        ],
        { concurrency: "unbounded" },
      );

      void stat;
      const nodes = buildNodes({ numstat, nameStatus, patch });
      const summary = nodes.reduce(
        (current, node) => ({
          totalFiles: current.totalFiles + 1,
          totalInsertions: current.totalInsertions + node.insertions,
          totalDeletions: current.totalDeletions + node.deletions,
        }),
        { totalFiles: 0, totalInsertions: 0, totalDeletions: 0 },
      );
      const diffTree: DiffTreeResult = {
        turnId: input.turnId ?? null,
        timestamp: new Date().toISOString(),
        nodes,
        summary,
      };

      if (!Schema.is(DiffTree)(diffTree)) {
        return yield* toGitError(
          operation,
          input.cwd,
          ["diff", "--find-renames", input.fromRef, input.toRef],
          "Computed diff tree does not satisfy the contract schema.",
        );
      }

      cache.set(cacheKey, diffTree);
      if (cache.size > MAX_CACHE_ENTRIES) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
      return diffTree;
    });

  const getCheckpointDiffTree: DiffTreeServiceShape["getCheckpointDiffTree"] = (input) =>
    getDiffTreeBetweenRefs({
      cwd: input.cwd,
      fromRef: input.baseRef ?? `${input.checkpointRef}^`,
      toRef: input.checkpointRef,
      ...(input.turnId !== undefined ? { turnId: input.turnId } : {}),
    });

  const getDiffTree: DiffTreeServiceShape["getDiffTree"] = (input) => {
    const range = resolveInputRange(input);
    return getDiffTreeBetweenRefs({
      cwd: input.cwd,
      ...range,
      ...(input.turnId !== undefined ? { turnId: input.turnId } : {}),
    });
  };

  return {
    getDiffTree,
    getDiffTreeBetweenRefs,
    getCheckpointDiffTree,
  } satisfies DiffTreeServiceShape;
});

export const DiffTreeServiceLive = Layer.effect(DiffTreeService, makeDiffTreeService);
