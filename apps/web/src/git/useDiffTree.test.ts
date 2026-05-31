import { describe, expect, it, vi } from "vitest";
import { CheckpointRef, type DiffTree, type NativeApi } from "@t3tools/contracts";

import { createDiffTreeActions } from "./useDiffTree";

const diffTree: DiffTree = {
  turnId: null,
  timestamp: "2026-05-30T12:00:00.000Z",
  nodes: [
    {
      path: "src/file.ts",
      type: "modified",
      hunks: 1,
      insertions: 2,
      deletions: 1,
    },
  ],
  summary: {
    totalFiles: 1,
    totalInsertions: 2,
    totalDeletions: 1,
  },
};

describe("createDiffTreeActions", () => {
  it("maps diff tree calls to the NativeApi git surface", async () => {
    const api = {
      git: {
        getDiffTree: vi.fn(async () => diffTree),
      },
    } as unknown as NativeApi;
    const request = {
      cwd: "/repo",
      checkpointRef: CheckpointRef.makeUnsafe("refs/t3/checkpoints/worktrees/feature/1"),
    };

    const actions = createDiffTreeActions({ api, request });

    await expect(actions.getDiffTree()).resolves.toEqual(diffTree);
    expect(api.git.getDiffTree).toHaveBeenCalledWith(request);
  });
});
