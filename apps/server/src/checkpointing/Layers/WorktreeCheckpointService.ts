import { Encoding, Effect, Layer } from "effect";
import { CheckpointRef, type StackBranchResult, type WorktreeCheckpoint } from "@t3tools/contracts";

import { GitCommandError, WorktreeServiceError } from "../../git/Errors.ts";
import { GitService } from "../../git/Services/GitService.ts";
import { WorktreeService } from "../../git/Services/WorktreeService.ts";
import { CheckpointStore } from "../Services/CheckpointStore.ts";
import {
  WorktreeCheckpointService,
  type WorktreeCheckpointServiceShape,
} from "../Services/WorktreeCheckpointService.ts";

const WORKTREE_CHECKPOINT_REFS_PREFIX = "refs/t3/checkpoints/worktrees";
const DEFAULT_TARGET_BRANCH = "main";

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

function worktreeCheckpointPrefix(branch: string): string {
  return `${WORKTREE_CHECKPOINT_REFS_PREFIX}/${Encoding.encodeBase64Url(branch)}`;
}

function generateCheckpointRef(branch: string, head: string, now: Date): CheckpointRef {
  const timestamp = now.toISOString().replace(/[^0-9A-Za-z]/g, "");
  return CheckpointRef.makeUnsafe(
    `${worktreeCheckpointPrefix(branch)}/${timestamp}-${head.slice(0, 12)}`,
  );
}

export const makeWorktreeCheckpointService = Effect.gen(function* () {
  const git = yield* GitService;
  const worktrees = yield* WorktreeService;
  const checkpointStore = yield* CheckpointStore;

  const executeGit = (
    operation: string,
    cwd: string,
    args: readonly string[],
    options: { allowNonZeroExit?: boolean; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
  ) =>
    git
      .execute({
        operation,
        cwd,
        args,
        allowNonZeroExit: true,
        ...(options.env ? { env: options.env } : {}),
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

  const ensureUnlockedWorktree = (cwd: string, branch: string, operation: string) =>
    worktrees.getWorktreeInfo({ cwd, branch }).pipe(
      Effect.flatMap((worktree) => {
        if (!worktree.isLocked) {
          return Effect.succeed(worktree);
        }
        return Effect.fail(
          new WorktreeServiceError({
            operation,
            detail: `Worktree '${branch}' is locked${
              worktree.lockedBy ? ` by ${worktree.lockedBy}` : ""
            }.`,
          }),
        );
      }),
    );

  const resolveRef = (cwd: string, ref: string, operation: string) =>
    executeGit(operation, cwd, ["rev-parse", "--verify", `${ref}^{commit}`]).pipe(
      Effect.map((result) => result.stdout.trim()),
    );

  const currentBranch = (cwd: string, operation: string) =>
    executeGit(operation, cwd, ["branch", "--show-current"]).pipe(
      Effect.map((result) => result.stdout.trim()),
      Effect.flatMap((branch) =>
        branch.length > 0
          ? Effect.succeed(branch)
          : Effect.fail(
              toGitError(
                operation,
                cwd,
                ["branch", "--show-current"],
                "Detached HEAD is unsupported.",
              ),
            ),
      ),
    );

  const createCheckpointInWorktree: WorktreeCheckpointServiceShape["createCheckpointInWorktree"] = (
    input,
  ) =>
    Effect.gen(function* () {
      const operation = "WorktreeCheckpointService.createCheckpointInWorktree";
      const worktree = yield* ensureUnlockedWorktree(input.cwd, input.worktreeBranch, operation);
      const commitEnv: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: "Rowl",
        GIT_AUTHOR_EMAIL: "rowl@users.noreply.github.com",
        GIT_COMMITTER_NAME: "Rowl",
        GIT_COMMITTER_EMAIL: "rowl@users.noreply.github.com",
      };

      yield* executeGit(operation, worktree.path, ["add", "-A", "--", "."], { env: commitEnv });
      const stagedDiff = yield* executeGit(
        operation,
        worktree.path,
        ["diff", "--cached", "--quiet", "--exit-code"],
        { allowNonZeroExit: true, env: commitEnv },
      );
      if (stagedDiff.code === 0) {
        return yield* new WorktreeServiceError({
          operation,
          detail: `Worktree '${input.worktreeBranch}' has no changes to checkpoint.`,
        });
      }
      if (stagedDiff.code !== 1) {
        return yield* toGitError(
          operation,
          worktree.path,
          ["diff", "--cached", "--quiet", "--exit-code"],
          stagedDiff.stderr.trim() ||
            `${commandLabel(["diff", "--cached", "--quiet", "--exit-code"])} failed with code ${
              stagedDiff.code
            }.`,
        );
      }

      const message = input.message ?? `rowl checkpoint: ${input.worktreeBranch}`;
      yield* executeGit(operation, worktree.path, ["commit", "-m", message], {
        env: commitEnv,
        timeoutMs: 30_000,
      });
      const head = yield* resolveRef(worktree.path, "HEAD", operation);
      const checkpointRef =
        input.checkpointRef ?? generateCheckpointRef(input.worktreeBranch, head, new Date());
      yield* executeGit(operation, worktree.path, ["update-ref", checkpointRef, head]);

      const checkpoint: WorktreeCheckpoint = {
        checkpointRef,
        worktreeBranch: input.worktreeBranch,
        worktreePath: worktree.path,
        head,
        message,
        createdAt: new Date().toISOString(),
      };

      return {
        checkpoint,
        worktree: {
          ...worktree,
          head,
        },
        branch: {
          name: input.worktreeBranch,
          head,
        },
      };
    });

  const listCheckpointsByWorktree: WorktreeCheckpointServiceShape["listCheckpointsByWorktree"] = (
    input,
  ) =>
    Effect.gen(function* () {
      const operation = "WorktreeCheckpointService.listCheckpointsByWorktree";
      const worktree = yield* worktrees.getWorktreeInfo({
        cwd: input.cwd,
        branch: input.worktreeBranch,
      });
      const prefix = worktreeCheckpointPrefix(input.worktreeBranch);
      const result = yield* executeGit(
        operation,
        input.cwd,
        [
          "for-each-ref",
          "--format=%(refname)%09%(objectname)%09%(committerdate:iso-strict)%09%(subject)",
          prefix,
        ],
        { allowNonZeroExit: true },
      );
      const checkpoints = result.stdout
        .split(/\r?\n/g)
        .map((line): WorktreeCheckpoint | null => {
          if (line.trim().length === 0) return null;
          const [checkpointRef, head, createdAt, ...subjectParts] = line.split("\t");
          if (!checkpointRef || !head || !createdAt) return null;
          const message = subjectParts.join("\t").trim();
          return {
            checkpointRef: CheckpointRef.makeUnsafe(checkpointRef),
            worktreeBranch: input.worktreeBranch,
            worktreePath: worktree.path,
            head,
            message: message.length > 0 ? message : null,
            createdAt,
          };
        })
        .filter((checkpoint): checkpoint is WorktreeCheckpoint => checkpoint !== null);

      return { checkpoints, worktree };
    });

  const cherryPickCheckpointToMain: WorktreeCheckpointServiceShape["cherryPickCheckpointToMain"] = (
    input,
  ) =>
    checkpointStore.cherryPickCheckpoint({
      cwd: input.cwd,
      checkpointRef: input.checkpointRef,
      targetBranch: input.targetBranch ?? DEFAULT_TARGET_BRANCH,
    });

  const mergeWorktreeBranch: WorktreeCheckpointServiceShape["mergeWorktreeBranch"] = (input) =>
    Effect.gen(function* () {
      const operation = "WorktreeCheckpointService.mergeWorktreeBranch";
      yield* ensureUnlockedWorktree(input.cwd, input.branch, operation);
      return yield* checkpointStore.mergeCheckpoint({
        cwd: input.cwd,
        branch: input.branch,
        targetBranch: input.targetBranch ?? DEFAULT_TARGET_BRANCH,
      });
    });

  const createStackedBranch: WorktreeCheckpointServiceShape["createStackedBranch"] = (input) =>
    Effect.gen(function* () {
      const operation = "WorktreeCheckpointService.createStackedBranch";
      const baseBranch = input.baseBranch ?? (yield* currentBranch(input.cwd, operation));
      const baseHead = yield* resolveRef(input.cwd, baseBranch, operation);
      const createdWorktree = yield* worktrees.createWorktree({
        cwd: input.cwd,
        branch: input.branch,
        baseBranch,
      });
      const createdHead = yield* resolveRef(createdWorktree.worktree.path, "HEAD", operation);
      const created = {
        branch: input.branch,
        head: createdHead,
        worktreePath: createdWorktree.worktree.path,
        parentBranch: baseBranch,
      };
      return {
        stack: [
          {
            branch: baseBranch,
            head: baseHead,
            worktreePath: null,
          },
          created,
        ],
        created,
      } satisfies StackBranchResult;
    });

  return {
    createCheckpointInWorktree,
    listCheckpointsByWorktree,
    cherryPickCheckpointToMain,
    mergeWorktreeBranch,
    createStackedBranch,
  } satisfies WorktreeCheckpointServiceShape;
});

export const WorktreeCheckpointServiceLive = Layer.effect(
  WorktreeCheckpointService,
  makeWorktreeCheckpointService,
);
