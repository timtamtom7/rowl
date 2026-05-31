import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApprovalGateId, GoalDocumentId, GoalId } from "@t3tools/contracts";

import { createApprovalService } from "./ApprovalServiceLive.ts";

const NOW = "2026-05-30T12:00:00.000Z";

let stateDir: string;
let ids: string[];

beforeEach(async () => {
  stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-approvals-state-"));
  ids = ["approval-1", "approval-2"];
});

afterEach(async () => {
  await fs.rm(stateDir, { recursive: true, force: true });
});

function service() {
  return createApprovalService({
    stateDir,
    generateId: () => ids.shift() ?? "approval-next",
    now: () => NOW,
  });
}

describe("ApprovalService", () => {
  it("creates approval gates and reports approval satisfaction", async () => {
    const approvals = service();

    const first = await Effect.runPromise(
      approvals.createApproval({
        goalId: GoalId.makeUnsafe("goal-1"),
        documentId: GoalDocumentId.makeUnsafe("doc-1"),
        requestedBy: "agent-1",
        reason: "Review the research doc",
      }),
    );
    await Effect.runPromise(
      approvals.createApproval({
        goalId: GoalId.makeUnsafe("goal-1"),
        requestedBy: "agent-2",
      }),
    );

    await expect(
      Effect.runPromise(approvals.isGoalApproved({ goalId: GoalId.makeUnsafe("goal-1") })),
    ).resolves.toEqual({ approved: false });

    await Effect.runPromise(
      approvals.approve({
        goalId: GoalId.makeUnsafe("goal-1"),
        approvalId: first.approval.id,
        reviewedBy: "mauriello",
      }),
    );
    await Effect.runPromise(
      approvals.approve({
        goalId: GoalId.makeUnsafe("goal-1"),
        approvalId: ApprovalGateId.makeUnsafe("approval-2"),
        reviewedBy: "mauriello",
      }),
    );

    await expect(
      Effect.runPromise(approvals.isGoalApproved({ goalId: GoalId.makeUnsafe("goal-1") })),
    ).resolves.toEqual({ approved: true });
    const list = await Effect.runPromise(
      approvals.listApprovalsByGoal({ goalId: GoalId.makeUnsafe("goal-1") }),
    );
    expect(list.approvals.map((approval) => approval.status)).toEqual(["approved", "approved"]);
  });

  it("rejects approval gates", async () => {
    const approvals = service();
    const created = await Effect.runPromise(
      approvals.createApproval({
        goalId: GoalId.makeUnsafe("goal-1"),
        requestedBy: "agent-1",
      }),
    );

    const rejected = await Effect.runPromise(
      approvals.reject({
        goalId: GoalId.makeUnsafe("goal-1"),
        approvalId: created.approval.id,
        reviewedBy: "mauriello",
        reason: "Needs more detail",
      }),
    );

    expect(rejected.approval.status).toBe("rejected");
    expect(rejected.approval.reason).toBe("Needs more detail");
  });
});
