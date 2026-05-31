import { describe, expect, it, vi } from "vitest";
import type { NativeApi } from "@t3tools/contracts";

import { createWorktreeCheckpointActions } from "./useWorktreeCheckpoints";

const worktree = {
  path: "/repo/.rowl/worktrees/feature-checkpoint",
  branch: "feature/checkpoint",
  head: "abc123",
  isLocked: false,
  lockedBy: null,
};

const checkpoint = {
  checkpointRef: "refs/t3/checkpoints/worktrees/feature-checkpoint/20260530-abc123",
  worktreeBranch: "feature/checkpoint",
  worktreePath: worktree.path,
  head: "abc123",
  message: "agent checkpoint",
  createdAt: "2026-05-30T12:00:00.000Z",
};

describe("createWorktreeCheckpointActions", () => {
  it("maps checkpoint calls to the NativeApi checkpoints surface", async () => {
    const api = {
      checkpoints: {
        listByWorktree: vi.fn(async () => ({ checkpoints: [checkpoint], worktree })),
        createInWorktree: vi.fn(async () => ({
          checkpoint,
          worktree,
          branch: { name: "feature/checkpoint", head: "abc123" },
        })),
      },
    } as unknown as NativeApi;

    const actions = createWorktreeCheckpointActions({
      api,
      cwd: "/repo",
      worktreeBranch: "feature/checkpoint",
    });

    await expect(actions.listByWorktree()).resolves.toEqual([checkpoint]);
    await actions.createCheckpointInWorktree({ message: "agent checkpoint" });

    expect(api.checkpoints.listByWorktree).toHaveBeenCalledWith({
      cwd: "/repo",
      worktreeBranch: "feature/checkpoint",
    });
    expect(api.checkpoints.createInWorktree).toHaveBeenCalledWith({
      cwd: "/repo",
      worktreeBranch: "feature/checkpoint",
      message: "agent checkpoint",
    });
  });
});
