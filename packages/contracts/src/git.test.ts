import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  CreateWorktreeInput,
  ListWorktreesResult,
  GitCreateWorktreeInput,
  GitCherryPickInput,
  GitPreparePullRequestThreadInput,
  GitResolvePullRequestResult,
  StackBranchInput,
  StackBranchResult,
} from "./git";

const decodeCreateWorktreeInput = Schema.decodeUnknownSync(GitCreateWorktreeInput);
const decodeManagedCreateWorktreeInput = Schema.decodeUnknownSync(CreateWorktreeInput);
const decodeListWorktreesResult = Schema.decodeUnknownSync(ListWorktreesResult);
const decodeGitCherryPickInput = Schema.decodeUnknownSync(GitCherryPickInput);
const decodePreparePullRequestThreadInput = Schema.decodeUnknownSync(
  GitPreparePullRequestThreadInput,
);
const decodeResolvePullRequestResult = Schema.decodeUnknownSync(GitResolvePullRequestResult);
const decodeStackBranchInput = Schema.decodeUnknownSync(StackBranchInput);
const decodeStackBranchResult = Schema.decodeUnknownSync(StackBranchResult);

describe("GitCreateWorktreeInput", () => {
  it("accepts omitted newBranch for existing-branch worktrees", () => {
    const parsed = decodeCreateWorktreeInput({
      cwd: "/repo",
      branch: "feature/existing",
      path: "/tmp/worktree",
    });

    expect(parsed.newBranch).toBeUndefined();
    expect(parsed.branch).toBe("feature/existing");
  });
});

describe("CreateWorktreeInput", () => {
  it("accepts managed worktree creation with an optional base branch", () => {
    const parsed = decodeManagedCreateWorktreeInput({
      cwd: "/repo",
      branch: "agent/feature-auth",
      baseBranch: "main",
    });

    expect(parsed.branch).toBe("agent/feature-auth");
    expect(parsed.baseBranch).toBe("main");
  });
});

describe("ListWorktreesResult", () => {
  it("decodes lock metadata for managed worktrees", () => {
    const parsed = decodeListWorktreesResult({
      worktrees: [
        {
          path: "/repo/.rowl/worktrees/agent-feature-auth",
          branch: "agent/feature-auth",
          head: "abc123",
          isLocked: true,
          lockedBy: "pid:123",
        },
      ],
    });

    expect(parsed.worktrees[0]?.isLocked).toBe(true);
    expect(parsed.worktrees[0]?.lockedBy).toBe("pid:123");
  });
});

describe("GitCherryPickInput", () => {
  it("accepts a branch or checkpoint ref source", () => {
    const parsed = decodeGitCherryPickInput({
      cwd: "/repo",
      sourceRef: "agent/feature-auth",
      targetBranch: "main",
    });

    expect(parsed.sourceRef).toBe("agent/feature-auth");
    expect(parsed.targetBranch).toBe("main");
  });
});

describe("StackBranchInput", () => {
  it("accepts stacked branch creation from the current branch", () => {
    const parsed = decodeStackBranchInput({
      cwd: "/repo",
      branch: "agent/stacked",
    });

    expect(parsed.branch).toBe("agent/stacked");
    expect(parsed.baseBranch).toBeUndefined();
  });
});

describe("StackBranchResult", () => {
  it("decodes ordered branch stack metadata", () => {
    const parsed = decodeStackBranchResult({
      stack: [
        { branch: "main", head: "base123", worktreePath: null },
        {
          branch: "agent/stacked",
          head: "base123",
          worktreePath: "/repo/.rowl/worktrees/agent-stacked",
          parentBranch: "main",
        },
      ],
      created: {
        branch: "agent/stacked",
        head: "base123",
        worktreePath: "/repo/.rowl/worktrees/agent-stacked",
        parentBranch: "main",
      },
    });

    expect(parsed.stack.map((entry) => entry.branch)).toEqual(["main", "agent/stacked"]);
    expect(parsed.created.parentBranch).toBe("main");
  });
});

describe("GitPreparePullRequestThreadInput", () => {
  it("accepts pull request references and mode", () => {
    const parsed = decodePreparePullRequestThreadInput({
      cwd: "/repo",
      reference: "#42",
      mode: "worktree",
    });

    expect(parsed.reference).toBe("#42");
    expect(parsed.mode).toBe("worktree");
  });
});

describe("GitResolvePullRequestResult", () => {
  it("decodes resolved pull request metadata", () => {
    const parsed = decodeResolvePullRequestResult({
      pullRequest: {
        number: 42,
        title: "PR threads",
        url: "https://github.com/pingdotgg/codething-mvp/pull/42",
        baseBranch: "main",
        headBranch: "feature/pr-threads",
        state: "open",
      },
    });

    expect(parsed.pullRequest.number).toBe(42);
    expect(parsed.pullRequest.headBranch).toBe("feature/pr-threads");
  });
});
