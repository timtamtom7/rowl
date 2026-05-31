import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GitService } from "./Services/GitService.ts";
import { GitServiceLive } from "./Layers/GitService.ts";
import { DiffTreeService } from "./DiffTreeService.ts";
import { DiffTreeServiceLive } from "./DiffTreeServiceLive.ts";
import type { GitCommandError } from "./Errors.ts";

const DiffTreeLayer = DiffTreeServiceLive.pipe(Layer.provideMerge(GitServiceLive));
const DiffTreeTestLayer = Layer.mergeAll(GitServiceLive, DiffTreeLayer).pipe(
  Layer.provide(NodeServices.layer),
);

function runGit(cwd: string, args: ReadonlyArray<string>) {
  return Effect.gen(function* () {
    const git = yield* GitService;
    const result = yield* git.execute({
      operation: "DiffTreeService.test.git",
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
    mkdirSync(path.join(root, "src"), { recursive: true });
    writeFileSync(path.join(root, "src", "keep.ts"), "one\n");
    writeFileSync(path.join(root, "delete.txt"), "remove\n");
    yield* runGit(root, ["add", "."]);
    yield* runGit(root, ["commit", "-m", "base"]);
  });
}

function withTempRepo<T>(
  effect: (root: string) => Effect.Effect<T, GitCommandError, GitService | DiffTreeService>,
) {
  const root = mkdtempSync(path.join(os.tmpdir(), "rowl-diff-tree-"));
  return Effect.gen(function* () {
    try {
      return yield* effect(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }).pipe(Effect.provide(DiffTreeTestLayer));
}

describe("DiffTreeServiceLive", () => {
  it("builds file-level diff tree stats between refs", async () => {
    await Effect.runPromise(
      withTempRepo((root) =>
        Effect.gen(function* () {
          yield* initRepo(root);
          writeFileSync(path.join(root, "src", "keep.ts"), "one\ntwo\n");
          writeFileSync(path.join(root, "added.txt"), "new\nfile\n");
          unlinkSync(path.join(root, "delete.txt"));
          yield* runGit(root, ["add", "."]);
          yield* runGit(root, ["commit", "-m", "changes"]);

          const service = yield* DiffTreeService;
          const diffTree = yield* service.getDiffTreeBetweenRefs({
            cwd: root,
            fromRef: "HEAD^",
            toRef: "HEAD",
          });

          expect(diffTree.summary).toEqual({
            totalFiles: 3,
            totalInsertions: 3,
            totalDeletions: 1,
          });
          expect(diffTree.nodes).toEqual([
            {
              path: "added.txt",
              type: "added",
              hunks: 1,
              insertions: 2,
              deletions: 0,
            },
            {
              path: "delete.txt",
              type: "deleted",
              hunks: 1,
              insertions: 0,
              deletions: 1,
            },
            {
              path: "src/keep.ts",
              type: "modified",
              hunks: 1,
              insertions: 1,
              deletions: 0,
            },
          ]);
        }),
      ),
    );
  });

  it("uses a checkpoint ref parent for checkpoint diff trees", async () => {
    await Effect.runPromise(
      withTempRepo((root) =>
        Effect.gen(function* () {
          yield* initRepo(root);
          writeFileSync(path.join(root, "src", "keep.ts"), "one\ntwo\n");
          yield* runGit(root, ["add", "."]);
          yield* runGit(root, ["commit", "-m", "checkpoint"]);
          const checkpointRef = "refs/t3/checkpoints/test/turn/1";
          yield* runGit(root, ["update-ref", checkpointRef, "HEAD"]);

          const service = yield* DiffTreeService;
          const diffTree = yield* service.getCheckpointDiffTree({
            cwd: root,
            checkpointRef,
          });

          expect(diffTree.summary.totalFiles).toBe(1);
          expect(diffTree.nodes[0]?.path).toBe("src/keep.ts");
          expect(diffTree.nodes[0]?.insertions).toBe(1);
        }),
      ),
    );
  });
});
