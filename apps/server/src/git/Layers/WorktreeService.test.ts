import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { GitService, type ExecuteGitInput, type GitServiceShape } from "../Services/GitService.ts";
import { GitServiceLive } from "./GitService.ts";
import { WorktreeService } from "../Services/WorktreeService.ts";
import { makeWorktreeService } from "./WorktreeService.ts";
import { WorktreeServiceLive } from "./WorktreeService.ts";
import { CheckpointStore } from "../../checkpointing/Services/CheckpointStore.ts";
import { CheckpointStoreLive } from "../../checkpointing/Layers/CheckpointStore.ts";

function makeTempProject() {
  const root = mkdtempSync(path.join(os.tmpdir(), "rowl-worktree-service-"));
  mkdirSync(path.join(root, ".git"), { recursive: true });
  return root;
}

function makeLayer(gitService: GitServiceShape) {
  return Layer.effect(WorktreeService, makeWorktreeService).pipe(
    Layer.provide(Layer.succeed(GitService, gitService)),
    Layer.provide(NodeServices.layer),
  );
}

function fakeGit(
  handler: (input: ExecuteGitInput) => { code?: number; stdout?: string; stderr?: string },
): GitServiceShape {
  return {
    execute: (input) =>
      Effect.sync(() => {
        const result = handler(input);
        return {
          code: result.code ?? 0,
          stdout: result.stdout ?? "",
          stderr: result.stderr ?? "",
        };
      }),
  };
}

const RealGitLayer = Layer.mergeAll(WorktreeServiceLive, CheckpointStoreLive, GitServiceLive).pipe(
  Layer.provide(NodeServices.layer),
);

function runGit(cwd: string, args: ReadonlyArray<string>) {
  return Effect.gen(function* () {
    const git = yield* GitService;
    const result = yield* git.execute({
      operation: "WorktreeService.test.git",
      cwd,
      args,
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

describe("WorktreeService", () => {
  it("creates managed worktrees under .rowl/worktrees with branch locks", async () => {
    const root = makeTempProject();
    const calls: ExecuteGitInput[] = [];
    const layer = makeLayer(
      fakeGit((input) => {
        calls.push(input);
        if (input.args.join(" ") === "rev-parse --show-toplevel") {
          return { stdout: root };
        }
        if (input.args.join(" ") === "show-ref --verify --quiet refs/heads/agent/feature-auth") {
          return { code: 1 };
        }
        if (input.args.join(" ") === "worktree list --porcelain") {
          return {
            stdout: [
              `worktree ${root}`,
              "HEAD base123",
              "branch refs/heads/main",
              "",
              `worktree ${path.join(root, ".rowl", "worktrees", "agent-feature-auth")}`,
              "HEAD abc123",
              "branch refs/heads/agent/feature-auth",
              "",
            ].join("\n"),
          };
        }
        return {};
      }),
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* WorktreeService;
        return yield* service.createWorktree({
          cwd: root,
          branch: "agent/feature-auth",
          baseBranch: "main",
        });
      }).pipe(Effect.provide(layer)),
    );

    expect(result.worktree).toEqual({
      path: path.join(root, ".rowl", "worktrees", "agent-feature-auth"),
      branch: "agent/feature-auth",
      head: "abc123",
      isLocked: false,
      lockedBy: null,
    });
    expect(calls.map((call) => call.args)).toContainEqual([
      "worktree",
      "add",
      "-b",
      "agent/feature-auth",
      path.join(root, ".rowl", "worktrees", "agent-feature-auth"),
      "main",
    ]);
    expect(existsSync(path.join(root, ".rowl", "worktrees", ".locks"))).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  it("fails when the branch already exists", async () => {
    const root = makeTempProject();
    const add = vi.fn();
    const layer = makeLayer(
      fakeGit((input) => {
        if (input.args.join(" ") === "rev-parse --show-toplevel") {
          return { stdout: root };
        }
        if (input.args.join(" ") === "show-ref --verify --quiet refs/heads/agent/existing") {
          return { code: 0 };
        }
        if (input.args[0] === "worktree" && input.args[1] === "add") {
          add();
        }
        return {};
      }),
    );

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* WorktreeService;
          return yield* service.createWorktree({ cwd: root, branch: "agent/existing" });
        }).pipe(Effect.provide(layer)),
      ),
    ).rejects.toThrow("Branch 'agent/existing' already exists");
    expect(add).not.toHaveBeenCalled();
    rmSync(root, { recursive: true, force: true });
  });

  it("reports locked worktrees and refuses removal", async () => {
    const root = makeTempProject();
    const lockDir = path.join(root, ".rowl", "worktrees", ".locks");
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(
      path.join(lockDir, "agent-feature-auth.lock"),
      JSON.stringify({ lockedBy: "agent:test", createdAt: new Date().toISOString() }),
    );
    const worktreePath = path.join(root, ".rowl", "worktrees", "agent-feature-auth");
    mkdirSync(worktreePath, { recursive: true });
    const layer = makeLayer(
      fakeGit((input) => {
        if (input.args.join(" ") === "rev-parse --show-toplevel") {
          return { stdout: root };
        }
        if (input.args.join(" ") === "worktree list --porcelain") {
          return {
            stdout: [
              `worktree ${root}`,
              "HEAD base123",
              "branch refs/heads/main",
              "",
              `worktree ${worktreePath}`,
              "HEAD abc123",
              "branch refs/heads/agent/feature-auth",
              "",
            ].join("\n"),
          };
        }
        return {};
      }),
    );

    const info = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* WorktreeService;
        return yield* service.getWorktreeInfo({ cwd: root, branch: "agent/feature-auth" });
      }).pipe(Effect.provide(layer)),
    );
    expect(info.isLocked).toBe(true);
    expect(info.lockedBy).toBe("agent:test");

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* WorktreeService;
          return yield* service.removeWorktree({ cwd: root, branch: "agent/feature-auth" });
        }).pipe(Effect.provide(layer)),
      ),
    ).rejects.toThrow("is locked by agent:test");
    rmSync(root, { recursive: true, force: true });
  });

  it("creates a real worktree and cherry-picks its branch back to main", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "rowl-worktree-integration-"));

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* initRepo(root);
        const worktrees = yield* WorktreeService;
        const checkpoints = yield* CheckpointStore;
        const created = yield* worktrees.createWorktree({
          cwd: root,
          branch: "agent/change-file",
          baseBranch: "main",
        });

        writeFileSync(path.join(created.worktree.path, "file.txt"), "base\nagent\n");
        yield* runGit(created.worktree.path, ["add", "file.txt"]);
        yield* runGit(created.worktree.path, ["commit", "-m", "agent change"]);

        const result = yield* checkpoints.cherryPickCheckpoint({
          cwd: root,
          checkpointRef: "agent/change-file",
        });

        expect(result.status).toBe("applied");
        expect(readFileSync(path.join(root, "file.txt"), "utf8")).toBe("base\nagent\n");
      }).pipe(Effect.provide(RealGitLayer)),
    );

    rmSync(root, { recursive: true, force: true });
  });

  it("surfaces merge conflicts for human fallback", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "rowl-worktree-conflict-"));

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          yield* initRepo(root);
          const checkpoints = yield* CheckpointStore;

          yield* runGit(root, ["checkout", "-b", "agent/conflict"]);
          writeFileSync(path.join(root, "file.txt"), "agent\n");
          yield* runGit(root, ["add", "file.txt"]);
          yield* runGit(root, ["commit", "-m", "agent conflict"]);
          yield* runGit(root, ["checkout", "main"]);
          writeFileSync(path.join(root, "file.txt"), "main\n");
          yield* runGit(root, ["add", "file.txt"]);
          yield* runGit(root, ["commit", "-m", "main conflict"]);

          return yield* checkpoints.mergeCheckpoint({
            cwd: root,
            branch: "agent/conflict",
          });
        }).pipe(Effect.provide(RealGitLayer)),
      ),
    ).rejects.toThrow("Git command failed in CheckpointStore.mergeCheckpoint");

    rmSync(root, { recursive: true, force: true });
  });
});
