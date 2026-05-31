import { Schema } from "effect";

import {
  IsoDateTime,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
} from "./baseSchemas";

export const ThreadApprovalGateId = TrimmedNonEmptyString.check(
  Schema.isMaxLength(128),
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
).pipe(Schema.brand("ThreadApprovalGateId"));
export type ThreadApprovalGateId = typeof ThreadApprovalGateId.Type;

export const ThreadApprovalGateType = Schema.Literals([
  "file-change",
  "shell-command",
  "destructive",
]);
export type ThreadApprovalGateType = typeof ThreadApprovalGateType.Type;

export const ThreadApprovalGateStatus = Schema.Literals(["pending", "approved", "rejected"]);
export type ThreadApprovalGateStatus = typeof ThreadApprovalGateStatus.Type;

export const ThreadApprovalGateProposedFile = Schema.Struct({
  path: TrimmedNonEmptyString,
  status: Schema.optional(TrimmedNonEmptyString),
  diff: Schema.optional(Schema.String),
});
export type ThreadApprovalGateProposedFile = typeof ThreadApprovalGateProposedFile.Type;

export const ThreadApprovalGateProposedChange = Schema.Struct({
  summary: Schema.optional(TrimmedNonEmptyString),
  command: Schema.optional(TrimmedNonEmptyString),
  cwd: Schema.optional(TrimmedNonEmptyString),
  details: Schema.optional(Schema.String),
  files: Schema.optional(Schema.Array(ThreadApprovalGateProposedFile)),
  raw: Schema.optional(Schema.Unknown),
});
export type ThreadApprovalGateProposedChange = typeof ThreadApprovalGateProposedChange.Type;

export const ThreadApprovalGate = Schema.Struct({
  id: ThreadApprovalGateId,
  threadId: ThreadId,
  turnId: TurnId,
  type: ThreadApprovalGateType,
  description: TrimmedNonEmptyString,
  proposedChange: ThreadApprovalGateProposedChange,
  status: ThreadApprovalGateStatus,
  createdAt: IsoDateTime,
});
export type ThreadApprovalGate = typeof ThreadApprovalGate.Type;

export const CreateThreadApprovalGateInput = Schema.Struct({
  threadId: ThreadId,
  turnId: TurnId,
  type: ThreadApprovalGateType,
  description: TrimmedNonEmptyString,
  proposedChange: ThreadApprovalGateProposedChange,
});
export type CreateThreadApprovalGateInput = typeof CreateThreadApprovalGateInput.Type;

export const ThreadApprovalGateIdInput = Schema.Struct({
  id: ThreadApprovalGateId,
});
export type ThreadApprovalGateIdInput = typeof ThreadApprovalGateIdInput.Type;

export const ListThreadApprovalGatesInput = Schema.Struct({
  threadId: ThreadId,
});
export type ListThreadApprovalGatesInput = typeof ListThreadApprovalGatesInput.Type;

export const ThreadApprovalGateResult = Schema.Struct({
  gate: ThreadApprovalGate,
});
export type ThreadApprovalGateResult = typeof ThreadApprovalGateResult.Type;

export const ListThreadApprovalGatesResult = Schema.Struct({
  gates: Schema.Array(ThreadApprovalGate),
});
export type ListThreadApprovalGatesResult = typeof ListThreadApprovalGatesResult.Type;
