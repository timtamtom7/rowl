import { describe, expect, it, vi } from "vitest";
import type { NativeApi } from "@t3tools/contracts";
import { ApprovalGateId, GoalId } from "@t3tools/contracts";

import { createApprovalActions } from "./useApprovals";

const NOW = "2026-05-30T12:00:00.000Z";
const goalId = GoalId.makeUnsafe("goal-1");
const approvalId = ApprovalGateId.makeUnsafe("approval-1");

const approval = {
  id: approvalId,
  goalId,
  status: "pending" as const,
  requestedBy: "mauriello",
  reason: "Release gate",
  createdAt: NOW,
};

describe("createApprovalActions", () => {
  it("maps approval workflow calls to the NativeApi approvals surface", async () => {
    const api = {
      approvals: {
        listByGoal: vi.fn(async () => ({ approvals: [approval] })),
        create: vi.fn(async () => ({ approval })),
        approve: vi.fn(async () => ({ approval: { ...approval, status: "approved" as const } })),
        reject: vi.fn(async () => ({ approval: { ...approval, status: "rejected" as const } })),
        isGoalApproved: vi.fn(async () => ({ approved: false })),
      },
    } as unknown as NativeApi;

    const actions = createApprovalActions({ api, goalId });

    await expect(actions.listByGoal()).resolves.toEqual([approval]);
    await actions.create({ requestedBy: "mauriello", reason: "Release gate" });
    await actions.approve({ approvalId, reviewedBy: "reviewer", reason: "Looks good" });
    await actions.reject({ approvalId, reviewedBy: "reviewer", reason: "Needs work" });
    await expect(actions.isGoalApproved()).resolves.toBe(false);

    expect(api.approvals.listByGoal).toHaveBeenCalledWith({ goalId });
    expect(api.approvals.create).toHaveBeenCalledWith({
      goalId,
      requestedBy: "mauriello",
      reason: "Release gate",
    });
    expect(api.approvals.approve).toHaveBeenCalledWith({
      goalId,
      approvalId,
      reviewedBy: "reviewer",
      reason: "Looks good",
    });
    expect(api.approvals.reject).toHaveBeenCalledWith({
      goalId,
      approvalId,
      reviewedBy: "reviewer",
      reason: "Needs work",
    });
    expect(api.approvals.isGoalApproved).toHaveBeenCalledWith({ goalId });
  });
});
