import { describe, expect, it, vi } from "vitest";
import type { NativeApi } from "@t3tools/contracts";

import { createWorktreeActions } from "./useWorktrees";

const worktree = {
  path: "/repo/.rowl/worktrees/feature-organizing",
  branch: "feature/organizing",
  head: "abc123",
  isLocked: false,
  lockedBy: null,
};

describe("createWorktreeActions", () => {
  it("maps managed worktree calls and integration actions to the NativeApi git surface", async () => {
    const api = {
      git: {
        worktrees: {
          list: vi.fn(async () => ({ worktrees: [worktree] })),
          create: vi.fn(async () => ({ worktree })),
          remove: vi.fn(async () => undefined),
          info: vi.fn(async () => worktree),
        },
        cherryPick: vi.fn(async () => ({ status: "applied", head: "def456" })),
        mergeBranch: vi.fn(async () => ({ status: "applied", head: "def456" })),
      },
    } as unknown as NativeApi;

    const actions = createWorktreeActions({ api, cwd: "/repo" });

    await expect(actions.list()).resolves.toEqual([worktree]);
    await actions.create({ branch: "feature/organizing", baseBranch: "main" });
    await actions.info("feature/organizing");
    await actions.cherryPick({ sourceRef: "feature/organizing" });
    await actions.merge({ branch: "feature/organizing" });
    await actions.remove("feature/organizing", true);

    expect(api.git.worktrees.list).toHaveBeenCalledWith({ cwd: "/repo" });
    expect(api.git.worktrees.create).toHaveBeenCalledWith({
      cwd: "/repo",
      branch: "feature/organizing",
      baseBranch: "main",
    });
    expect(api.git.worktrees.info).toHaveBeenCalledWith({
      cwd: "/repo",
      branch: "feature/organizing",
    });
    expect(api.git.cherryPick).toHaveBeenCalledWith({
      cwd: "/repo",
      sourceRef: "feature/organizing",
    });
    expect(api.git.mergeBranch).toHaveBeenCalledWith({
      cwd: "/repo",
      branch: "feature/organizing",
    });
    expect(api.git.worktrees.remove).toHaveBeenCalledWith({
      cwd: "/repo",
      branch: "feature/organizing",
      force: true,
    });
  });
});
