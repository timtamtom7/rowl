import { open as openFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";

import { Effect, FileSystem, Layer, Path } from "effect";
import { sanitizeBranchFragment } from "@t3tools/shared/git";

import { GitCommandError, WorktreeServiceError } from "../Errors.ts";
import { GitServiceLive } from "./GitService.ts";
import { GitService } from "../Services/GitService.ts";
import {
  WorktreeService,
  type WorktreeServiceShape,
} from "../Services/WorktreeService.ts";

const MANAGED_WORKTREES_DIR = ".rowl/worktrees";
const LOCKS_DIR = ".locks";
const STALE_LOCK_MS = 24 * 60 * 60 * 1000;

interface ParsedWorktree {
  path: string;
  branch: string;
  head: string;
}

interface LockInfo {
  lockedBy: string;
  createdAt: string;
}

function commandLabel(args: readonly string[]): string {
  return `git ${args.join(" ")}`;
}

function toGitError(
  operation: string,
  cwd: string,
  args: readonly string[],
  detail: string,
  cause?: unknown,
): GitCommandError {
  return new GitCommandError({
    operation,
    command: commandLabel(args),
    cwd,
    detail,
    ...(cause !== undefined ? { cause } : {}),
  });
}

function toWorktreeError(operation: string, detail: string, cause?: unknown): WorktreeServiceError {
  return new WorktreeServiceError({
    operation,
    detail,
    ...(cause !== undefined ? { cause } : {}),
  });
}

function worktreeSlug(branch: string): string {
  return sanitizeBranchFragment(branch).replace(/\//g, "-");
}

function parseWorktreePorcelain(stdout: string): ParsedWorktree[] {
  const worktrees: ParsedWorktree[] = [];
  let currentPath: string | null = null;
  let currentHead: string | null = null;
  let currentBranch: string | null = null;

  const flush = () => {
    if (currentPath && currentHead) {
      worktrees.push({
        path: currentPath,
        head: currentHead,
        branch: currentBranch ?? "(detached)",
      });
    }
    currentPath = null;
    currentHead = null;
    currentBranch = null;
  };

  for (const line of stdout.split(/\r?\n/g)) {
    if (line.trim().length === 0) {
      flush();
      continue;
    }
    if (line.startsWith("worktree ")) {
      flush();
      currentPath = line.slice("worktree ".length).trim();
      continue;
    }
    if (line.startsWith("HEAD ")) {
      currentHead = line.slice("HEAD ".length).trim();
      continue;
    }
    if (line.startsWith("branch refs/heads/")) {
      currentBranch = line.slice("branch refs/heads/".length).trim();
    }
  }

  flush();
  return worktrees;
}

export const makeWorktreeService = Effect.gen(function* () {
  const git = yield* GitService;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const executeGit = (
    operation: string,
    cwd: string,
    args: readonly string[],
    options: { allowNonZeroExit?: boolean; timeoutMs?: number } = {},
  ) =>
    git
      .execute({
        operation,
        cwd,
        args,
        allowNonZeroExit: true,
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      })
      .pipe(
        Effect.flatMap((result) => {
          if (options.allowNonZeroExit || result.code === 0) {
            return Effect.succeed(result);
          }
          return Effect.fail(
            toGitError(
              operation,
              cwd,
              args,
              result.stderr.trim() || `${commandLabel(args)} failed with code ${result.code}.`,
            ),
          );
        }),
      );

  const repoRoot = (cwd: string) =>
    executeGit("WorktreeService.repoRoot", cwd, ["rev-parse", "--show-toplevel"]).pipe(
      Effect.map((result) => result.stdout.trim()),
      Effect.flatMap((root) =>
        root.length > 0
          ? Effect.succeed(root)
          : Effect.fail(toWorktreeError("WorktreeService.repoRoot", "Git returned no repo root.")),
      ),
    );

  const managedRoot = (root: string) => path.join(root, MANAGED_WORKTREES_DIR);
  const lockRoot = (root: string) => path.join(managedRoot(root), LOCKS_DIR);
  const lockPathForBranch = (root: string, branch: string) =>
    path.join(lockRoot(root), `${worktreeSlug(branch)}.lock`);
  const worktreePathForBranch = (root: string, branch: string) =>
    path.join(managedRoot(root), worktreeSlug(branch));

  const readLock = (lockPath: string) =>
    fs.readFileString(lockPath).pipe(
      Effect.map((raw): LockInfo | null => {
        try {
          const parsed = JSON.parse(raw) as Partial<LockInfo>;
          const lockedBy = parsed.lockedBy?.trim() ?? "";
          const createdAt = parsed.createdAt?.trim() ?? "";
          if (lockedBy.length === 0 || createdAt.length === 0) return null;
          return { lockedBy, createdAt };
        } catch {
          return null;
        }
      }),
      Effect.catch(() => Effect.succeed(null)),
    );

  const removeStaleLock = (lockPath: string, now: number) =>
    Effect.gen(function* () {
      const lock = yield* readLock(lockPath);
      if (!lock) {
        yield* fs.remove(lockPath, { force: true }).pipe(Effect.catch(() => Effect.void));
        return;
      }
      const createdAtMs = Date.parse(lock.createdAt);
      if (!Number.isFinite(createdAtMs) || now - createdAtMs > STALE_LOCK_MS) {
        yield* fs.remove(lockPath, { force: true }).pipe(Effect.catch(() => Effect.void));
      }
    });

  const acquireLock = (root: string, branch: string) =>
    Effect.acquireRelease(
      Effect.gen(function* () {
        const locksDir = lockRoot(root);
        yield* fs.makeDirectory(locksDir, { recursive: true });
        const lockPath = lockPathForBranch(root, branch);
        yield* removeStaleLock(lockPath, Date.now());
        const payload = JSON.stringify(
          {
            lockedBy: `pid:${process.pid}`,
            createdAt: new Date().toISOString(),
            branch,
          },
          null,
          2,
        );
        const handle = yield* Effect.tryPromise({
          try: () => openFile(lockPath, "wx"),
          catch: (cause) => cause,
        }).pipe(
          Effect.mapError((cause) =>
            toWorktreeError(
              "WorktreeService.acquireLock",
              `Worktree '${branch}' is locked.`,
              cause,
            ),
          ),
        );
        yield* Effect.tryPromise({
          try: () => handle.writeFile(payload, "utf8"),
          catch: (cause) => cause,
        }).pipe(
          Effect.mapError((cause) =>
            toWorktreeError(
              "WorktreeService.acquireLock",
              `Failed to write lock for worktree '${branch}'.`,
              cause,
            ),
          ),
        );
        return { lockPath, handle };
      }),
      ({ lockPath, handle }: { lockPath: string; handle: FileHandle }) =>
        Effect.all(
          [
            Effect.promise(() => handle.close()).pipe(Effect.catch(() => Effect.void)),
            fs.remove(lockPath, { force: true }).pipe(Effect.catch(() => Effect.void)),
          ],
          { discard: true },
        ),
    );

  const branchExists = (root: string, branch: string) =>
    executeGit(
      "WorktreeService.branchExists",
      root,
      ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
      { allowNonZeroExit: true, timeoutMs: 5_000 },
    ).pipe(Effect.map((result) => result.code === 0));

  const listParsedWorktrees = (root: string) =>
    executeGit("WorktreeService.listWorktrees", root, ["worktree", "list", "--porcelain"], {
      timeoutMs: 5_000,
    }).pipe(Effect.map((result) => parseWorktreePorcelain(result.stdout)));

  const cleanupAbandonedWorktrees = (root: string) =>
    Effect.gen(function* () {
      const managed = managedRoot(root);
      yield* executeGit("WorktreeService.prune", root, ["worktree", "prune"], {
        allowNonZeroExit: true,
        timeoutMs: 10_000,
      });
      const activePaths = new Set((yield* listParsedWorktrees(root)).map((entry) => entry.path));
      const entries = yield* fs
        .readDirectory(managed, { recursive: false })
        .pipe(Effect.catch(() => Effect.succeed([] as string[])));
      yield* Effect.forEach(
        entries,
        (entry) =>
          Effect.gen(function* () {
            if (entry === LOCKS_DIR) return;
            const candidate = path.join(managed, entry);
            if (!activePaths.has(candidate)) {
              yield* fs.remove(candidate, { recursive: true, force: true }).pipe(
                Effect.catch(() => Effect.void),
              );
            }
          }),
        { concurrency: 1 },
      );
    });

  const toInfo = (root: string, entry: ParsedWorktree) =>
    Effect.gen(function* () {
      const lock = yield* readLock(lockPathForBranch(root, entry.branch));
      return {
        path: entry.path,
        branch: entry.branch,
        head: entry.head,
        isLocked: lock !== null,
        lockedBy: lock?.lockedBy ?? null,
      };
    });

  const listWorktrees: WorktreeServiceShape["listWorktrees"] = (input) =>
    Effect.gen(function* () {
      const root = yield* repoRoot(input.cwd);
      yield* cleanupAbandonedWorktrees(root);
      const parsed = yield* listParsedWorktrees(root);
      const worktrees = yield* Effect.forEach(parsed, (entry) => toInfo(root, entry), {
        concurrency: 1,
      });
      return { worktrees };
    });

  const getWorktreeInfo: WorktreeServiceShape["getWorktreeInfo"] = (input) =>
    Effect.gen(function* () {
      const { worktrees } = yield* listWorktrees({ cwd: input.cwd });
      const found = worktrees.find((worktree) => worktree.branch === input.branch);
      if (!found) {
        return yield* Effect.fail(
          toWorktreeError(
            "WorktreeService.getWorktreeInfo",
            `No worktree found for branch '${input.branch}'.`,
          ),
        );
      }
      return found;
    });

  const createWorktree: WorktreeServiceShape["createWorktree"] = (input) =>
    Effect.gen(function* () {
      const root = yield* repoRoot(input.cwd);
      yield* cleanupAbandonedWorktrees(root);
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* acquireLock(root, input.branch);
          if (yield* branchExists(root, input.branch)) {
            return yield* Effect.fail(
              toWorktreeError(
                "WorktreeService.createWorktree",
                `Branch '${input.branch}' already exists.`,
              ),
            );
          }
          const targetPath = worktreePathForBranch(root, input.branch);
          yield* fs.makeDirectory(path.dirname(targetPath), { recursive: true });
          yield* executeGit(
            "WorktreeService.createWorktree",
            root,
            ["worktree", "add", "-b", input.branch, targetPath, input.baseBranch ?? "HEAD"],
            { timeoutMs: 30_000 },
          );
        }),
      );
      const info = yield* getWorktreeInfo({ cwd: root, branch: input.branch });
      return { worktree: info };
    });

  const removeWorktree: WorktreeServiceShape["removeWorktree"] = (input) =>
    Effect.gen(function* () {
      const root = yield* repoRoot(input.cwd);
      const info = yield* getWorktreeInfo({ cwd: root, branch: input.branch });
      const expectedPrefix = `${managedRoot(root)}${path.sep}`;
      if (!info.path.startsWith(expectedPrefix)) {
        return yield* Effect.fail(
          toWorktreeError(
            "WorktreeService.removeWorktree",
            `Refusing to remove unmanaged worktree '${info.path}'.`,
          ),
        );
      }
      const lock = yield* readLock(lockPathForBranch(root, input.branch));
      if (lock) {
        return yield* Effect.fail(
          toWorktreeError(
            "WorktreeService.removeWorktree",
            `Worktree '${input.branch}' is locked by ${lock.lockedBy}.`,
          ),
        );
      }
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* acquireLock(root, input.branch);
          const args = ["worktree", "remove"];
          if (input.force) args.push("--force");
          args.push(info.path);
          yield* executeGit("WorktreeService.removeWorktree", root, args, { timeoutMs: 30_000 });
        }),
      );
      yield* cleanupAbandonedWorktrees(root);
    });

  return {
    createWorktree,
    listWorktrees,
    removeWorktree,
    getWorktreeInfo,
  } satisfies WorktreeServiceShape;
});

export const WorktreeServiceLive = Layer.effect(WorktreeService, makeWorktreeService).pipe(
  Layer.provideMerge(GitServiceLive),
);
