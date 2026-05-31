import type {
  ApprovalGateResult,
  ApproveInput,
  CreateApprovalInput,
  IsGoalApprovedInput,
  IsGoalApprovedResult,
  ListApprovalsByGoalInput,
  ListApprovalsByGoalResult,
  RejectInput,
} from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ApprovalServiceError } from "../Errors.ts";

export interface ApprovalServiceShape {
  readonly createApproval: (
    input: CreateApprovalInput,
  ) => Effect.Effect<ApprovalGateResult, ApprovalServiceError>;

  readonly approve: (
    input: ApproveInput,
  ) => Effect.Effect<ApprovalGateResult, ApprovalServiceError>;

  readonly reject: (input: RejectInput) => Effect.Effect<ApprovalGateResult, ApprovalServiceError>;

  readonly listApprovalsByGoal: (
    input: ListApprovalsByGoalInput,
  ) => Effect.Effect<ListApprovalsByGoalResult, ApprovalServiceError>;

  readonly isGoalApproved: (
    input: IsGoalApprovedInput,
  ) => Effect.Effect<IsGoalApprovedResult, ApprovalServiceError>;
}

export class ApprovalService extends ServiceMap.Service<ApprovalService, ApprovalServiceShape>()(
  "rowl/orchestration/Services/ApprovalService",
) {}
