import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GitService } from "../../git/Services/GitService.ts";
import { GitServiceLive } from "../../git/Layers/GitService.ts";
import { WorktreeService } from "../../git/Services/WorktreeService.ts";
import { WorktreeServiceLive } from "../../git/Layers/WorktreeService.ts";
import { CheckpointStore } from "../Services/CheckpointStore.ts";
import { CheckpointStoreLive } from "./CheckpointStore.ts";
import {
  WorktreeCheckpointService,
  type WorktreeCheckpointServiceError,
} from "../Services/WorktreeCheckpointService.ts";
import { WorktreeCheckpointServiceLive } from "./WorktreeCheckpointService.ts";

const WorktreeCheckpointLayer = WorktreeCheckpointServiceLive.pipe(
  Layer.provideMerge(WorktreeServiceLive),
  Layer.provideMerge(CheckpointStoreLive),
  Layer.provideMerge(GitServiceLive),
);
const WorktreeCheckpointTestLayer = Layer.mergeAll(
  GitServiceLive,
  WorktreeServiceLive,
  CheckpointStoreLive,
  WorktreeCheckpointLayer,
).pipe(Layer.provide(NodeServices.layer));

function runGit(cwd: string, args: ReadonlyArray<string>, allowNonZeroExit = false) {
  return Effect.gen(function* () {
    const git = yield* GitService;
    const result = yield* git.execute({
      operation: "WorktreeCheckpointService.test.git",
      cwd,
      args,
      allowNonZeroExit,
      timeoutMs: 10_000,
    });
    return result.stdout.trim();
  });
}

function initRepo(root: string) {
  return Effect.gen(function* () {
    yield* runGit(root, ["init", "-b", "main"]);
    yield* runGit(root, ["config", "user.name", "Rowl Test"]);
    yield* runGit(root, ["config", "user.email", "rowl-test@example.com"]);
    writeFileSync(path.join(root, "file.txt"), "base\n");
    yield* runGit(root, ["add", "file.txt"]);
    yield* runGit(root, ["commit", "-m", "base"]);
  });
}

function withTempRepo<T>(
  effect: (
    root: string,
  ) => Effect.Effect<
    T,
    WorktreeCheckpointServiceError,
    WorktreeCheckpointService | WorktreeService | CheckpointStore | GitService
  >,
) {
  const root = mkdtempSync(path.join(os.tmpdir(), "rowl-worktree-checkpoint-"));
  return Effect.gen(function* () {
    try {
      return yield* effect(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }).pipe(Effect.provide(WorktreeCheckpointTestLayer));
}

describe("WorktreeCheckpointService", () => {
  it("creates and lists a checkpoint in a managed worktree", async () => {
    await Effect.runPromise(
      withTempRepo((root) =>
        Effect.gen(function* () {
          yield* initRepo(root);
          const worktrees = yield* WorktreeService;
          const service = yield* WorktreeCheckpointService;
          const created = yield* worktrees.createWorktree({
            cwd: root,
            branch: "agent/checkpoint-file",
            baseBranch: "main",
          });
          writeFileSync(path.join(created.worktree.path, "file.txt"), "base\nagent\n");

          const result = yield* service.createCheckpointInWorktree({
            cwd: root,
            worktreeBranch: "agent/checkpoint-file",
            message: "agent checkpoint",
          });

          expect(result.worktree.path).toBe(created.worktree.path);
          expect(result.branch.name).toBe("agent/checkpoint-file");
          expect(result.checkpoint.worktreeBranch).toBe("agent/checkpoint-file");
          expect(result.checkpoint.message).toBe("agent checkpoint");

          const refHead = yield* runGit(root, ["rev-parse", result.checkpoint.checkpointRef]);
          expect(refHead).toBe(result.checkpoint.head);

          const listed = yield* service.listCheckpointsByWorktree({
            cwd: root,
            worktreeBranch: "agent/checkpoint-file",
          });
          expect(listed.checkpoints.map((checkpoint) => checkpoint.checkpointRef)).toContain(
            result.checkpoint.checkpointRef,
          );
        }),
      ),
    );
  });

  it("cherry-picks a worktree checkpoint back to main", async () => {
    await Effect.runPromise(
      withTempRepo((root) =>
        Effect.gen(function* () {
          yield* initRepo(root);
          const worktrees = yield* WorktreeService;
          const service = yield* WorktreeCheckpointService;
          const created = yield* worktrees.createWorktree({
            cwd: root,
            branch: "agent/cherry-pick",
            baseBranch: "main",
          });
          writeFileSync(path.join(created.worktree.path, "file.txt"), "base\ncherry\n");
          const checkpoint = yield* service.createCheckpointInWorktree({
            cwd: root,
            worktreeBranch: "agent/cherry-pick",
            message: "cherry change",
          });

          const result = yield* service.cherryPickCheckpointToMain({
            cwd: root,
            checkpointRef: checkpoint.checkpoint.checkpointRef,
            targetBranch: "main",
          });

          expect(result.status).toBe("applied");
          expect(readFileSync(path.join(root, "file.txt"), "utf8")).toBe("base\ncherry\n");
        }),
      ),
    );
  });

  it("merges an entire worktree branch back to main", async () => {
    await Effect.runPromise(
      withTempRepo((root) =>
        Effect.gen(function* () {
          yield* initRepo(root);
          const worktrees = yield* WorktreeService;
          const service = yield* WorktreeCheckpointService;
          const created = yield* worktrees.createWorktree({
            cwd: root,
            branch: "agent/merge-branch",
            baseBranch: "main",
          });
          writeFileSync(path.join(created.worktree.path, "file.txt"), "base\nmerge\n");
          yield* service.createCheckpointInWorktree({
            cwd: root,
            worktreeBranch: "agent/merge-branch",
            message: "merge change",
          });

          const result = yield* service.mergeWorktreeBranch({
            cwd: root,
            branch: "agent/merge-branch",
            targetBranch: "main",
          });

          expect(result.status).toBe("applied");
          expect(readFileSync(path.join(root, "file.txt"), "utf8")).toBe("base\nmerge\n");
        }),
      ),
    );
  });

  it("creates a stacked branch in its own managed worktree", async () => {
    await Effect.runPromise(
      withTempRepo((root) =>
        Effect.gen(function* () {
          yield* initRepo(root);
          const service = yield* WorktreeCheckpointService;

          const result = yield* service.createStackedBranch({
            cwd: root,
            branch: "agent/stack-child",
          });

          expect(result.stack.map((entry) => entry.branch)).toEqual(["main", "agent/stack-child"]);
          expect(result.created.parentBranch).toBe("main");
          expect(result.created.worktreePath).not.toBeNull();
          expect(existsSync(result.created.worktreePath as string)).toBe(true);
          const branch = yield* runGit(result.created.worktreePath as string, [
            "branch",
            "--show-current",
          ]);
          expect(branch).toBe("agent/stack-child");
        }),
      ),
    );
  });

  it("rejects checkpoint and merge operations for locked worktrees", async () => {
    await expect(
      Effect.runPromise(
        withTempRepo((root) =>
          Effect.gen(function* () {
            yield* initRepo(root);
            const worktrees = yield* WorktreeService;
            const service = yield* WorktreeCheckpointService;
            const created = yield* worktrees.createWorktree({
              cwd: root,
              branch: "agent/locked",
              baseBranch: "main",
            });
            writeFileSync(path.join(created.worktree.path, "file.txt"), "base\nlocked\n");
            mkdirSync(path.join(root, ".rowl", "worktrees", ".locks"), { recursive: true });
            writeFileSync(
              path.join(root, ".rowl", "worktrees", ".locks", "agent-locked.lock"),
              JSON.stringify({ lockedBy: "agent:test", createdAt: new Date().toISOString() }),
            );

            return yield* service.createCheckpointInWorktree({
              cwd: root,
              worktreeBranch: "agent/locked",
            });
          }),
        ),
      ),
    ).rejects.toThrow("locked by agent:test");
  });

  it("surfaces merge conflicts when merging a worktree branch", async () => {
    await expect(
      Effect.runPromise(
        withTempRepo((root) =>
          Effect.gen(function* () {
            yield* initRepo(root);
            const worktrees = yield* WorktreeService;
            const service = yield* WorktreeCheckpointService;
            const created = yield* worktrees.createWorktree({
              cwd: root,
              branch: "agent/conflict",
              baseBranch: "main",
            });
            writeFileSync(path.join(created.worktree.path, "file.txt"), "agent\n");
            yield* service.createCheckpointInWorktree({
              cwd: root,
              worktreeBranch: "agent/conflict",
              message: "agent conflict",
            });

            writeFileSync(path.join(root, "file.txt"), "main\n");
            yield* runGit(root, ["add", "file.txt"]);
            yield* runGit(root, ["commit", "-m", "main conflict"]);

            return yield* service.mergeWorktreeBranch({
              cwd: root,
              branch: "agent/conflict",
              targetBranch: "main",
            });
          }),
        ),
      ),
    ).rejects.toThrow("Git command failed in CheckpointStore.mergeCheckpoint");
  });
});
