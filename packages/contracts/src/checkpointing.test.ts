import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  CreateWorktreeCheckpointInput,
  ListWorktreeCheckpointsResult,
  WorktreeCheckpointResult,
} from "./checkpointing";

const decodeCreateInput = Schema.decodeUnknownSync(CreateWorktreeCheckpointInput);
const decodeCheckpointResult = Schema.decodeUnknownSync(WorktreeCheckpointResult);
const decodeListResult = Schema.decodeUnknownSync(ListWorktreeCheckpointsResult);

describe("CreateWorktreeCheckpointInput", () => {
  it("accepts worktree-scoped checkpoint creation", () => {
    const parsed = decodeCreateInput({
      cwd: "/repo",
      worktreeBranch: "agent/feature",
      message: "agent checkpoint",
    });

    expect(parsed.worktreeBranch).toBe("agent/feature");
    expect(parsed.message).toBe("agent checkpoint");
  });
});

describe("WorktreeCheckpointResult", () => {
  it("decodes checkpoint metadata with worktree branch info", () => {
    const parsed = decodeCheckpointResult({
      checkpoint: {
        checkpointRef: "refs/t3/checkpoints/worktrees/agent-feature/1",
        worktreeBranch: "agent/feature",
        worktreePath: "/repo/.rowl/worktrees/agent-feature",
        head: "abc123",
        message: "agent checkpoint",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      worktree: {
        path: "/repo/.rowl/worktrees/agent-feature",
        branch: "agent/feature",
        head: "abc123",
        isLocked: false,
        lockedBy: null,
      },
      branch: {
        name: "agent/feature",
        head: "abc123",
      },
    });

    expect(parsed.checkpoint.worktreeBranch).toBe("agent/feature");
    expect(parsed.branch.name).toBe("agent/feature");
  });
});

describe("ListWorktreeCheckpointsResult", () => {
  it("decodes worktree-scoped checkpoint lists", () => {
    const parsed = decodeListResult({
      checkpoints: [
        {
          checkpointRef: "refs/t3/checkpoints/worktrees/agent-feature/1",
          worktreeBranch: "agent/feature",
          worktreePath: "/repo/.rowl/worktrees/agent-feature",
          head: "abc123",
          message: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      worktree: {
        path: "/repo/.rowl/worktrees/agent-feature",
        branch: "agent/feature",
        head: "abc123",
        isLocked: false,
        lockedBy: null,
      },
    });

    expect(parsed.checkpoints).toHaveLength(1);
  });
});
