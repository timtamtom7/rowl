import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { ApprovalGate, ApproveInput, CreateApprovalInput } from "./approvals";

const decodeApproval = Schema.decodeUnknownEffect(ApprovalGate);
const decodeCreateApprovalInput = Schema.decodeUnknownEffect(CreateApprovalInput);
const decodeApproveInput = Schema.decodeUnknownEffect(ApproveInput);

it.effect("decodes approval gates", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeApproval({
      id: "approval-1",
      goalId: "goal-1",
      documentId: "doc-1",
      status: "pending",
      requestedBy: "agent-1",
      reason: "Needs human review",
      createdAt: "2026-05-30T12:00:00.000Z",
    });

    assert.strictEqual(parsed.status, "pending");
    assert.strictEqual(parsed.documentId, "doc-1");
  }),
);

it.effect("decodes create and approve inputs", () =>
  Effect.gen(function* () {
    const create = yield* decodeCreateApprovalInput({
      goalId: "goal-1",
      documentId: "doc-1",
      requestedBy: "agent-1",
    });
    const approve = yield* decodeApproveInput({
      goalId: "goal-1",
      approvalId: "approval-1",
      reviewedBy: "mauriello",
      reason: "Looks correct",
    });

    assert.strictEqual(create.requestedBy, "agent-1");
    assert.strictEqual(approve.reviewedBy, "mauriello");
  }),
);

it.effect("rejects invalid approval status", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(
      decodeApproval({
        id: "approval-1",
        goalId: "goal-1",
        status: "in_review",
        requestedBy: "agent-1",
        createdAt: "2026-05-30T12:00:00.000Z",
      }),
    );

    assert.strictEqual(result._tag, "Failure");
  }),
);
