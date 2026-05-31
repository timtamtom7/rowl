import { Schema } from "effect";

import { GoalDocumentId } from "./documents";
import { GoalId } from "./goals";
import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas";

export const ApprovalGateId = TrimmedNonEmptyString.check(
  Schema.isMaxLength(128),
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
).pipe(Schema.brand("ApprovalGateId"));
export type ApprovalGateId = typeof ApprovalGateId.Type;

export const ApprovalGateStatus = Schema.Literals(["pending", "approved", "rejected"]);
export type ApprovalGateStatus = typeof ApprovalGateStatus.Type;

export const ApprovalGate = Schema.Struct({
  id: ApprovalGateId,
  goalId: GoalId,
  documentId: Schema.optional(GoalDocumentId),
  status: ApprovalGateStatus,
  requestedBy: TrimmedNonEmptyString,
  reviewedBy: Schema.optional(TrimmedNonEmptyString),
  reason: Schema.optional(TrimmedNonEmptyString),
  createdAt: IsoDateTime,
});
export type ApprovalGate = typeof ApprovalGate.Type;

export const CreateApprovalInput = Schema.Struct({
  goalId: GoalId,
  documentId: Schema.optional(GoalDocumentId),
  requestedBy: TrimmedNonEmptyString,
  reason: Schema.optional(TrimmedNonEmptyString),
});
export type CreateApprovalInput = typeof CreateApprovalInput.Type;

export const ApproveInput = Schema.Struct({
  goalId: GoalId,
  approvalId: ApprovalGateId,
  reviewedBy: TrimmedNonEmptyString,
  reason: Schema.optional(TrimmedNonEmptyString),
});
export type ApproveInput = typeof ApproveInput.Type;

export const RejectInput = Schema.Struct({
  goalId: GoalId,
  approvalId: ApprovalGateId,
  reviewedBy: TrimmedNonEmptyString,
  reason: Schema.optional(TrimmedNonEmptyString),
});
export type RejectInput = typeof RejectInput.Type;

export const ListApprovalsByGoalInput = Schema.Struct({
  goalId: GoalId,
});
export type ListApprovalsByGoalInput = typeof ListApprovalsByGoalInput.Type;

export const ApprovalGateResult = Schema.Struct({
  approval: ApprovalGate,
});
export type ApprovalGateResult = typeof ApprovalGateResult.Type;

export const ListApprovalsByGoalResult = Schema.Struct({
  approvals: Schema.Array(ApprovalGate),
});
export type ListApprovalsByGoalResult = typeof ListApprovalsByGoalResult.Type;

export const IsGoalApprovedInput = Schema.Struct({
  goalId: GoalId,
});
export type IsGoalApprovedInput = typeof IsGoalApprovedInput.Type;

export const IsGoalApprovedResult = Schema.Struct({
  approved: Schema.Boolean,
});
export type IsGoalApprovedResult = typeof IsGoalApprovedResult.Type;
