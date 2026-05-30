/**
 * GoalsService - Service interface for goal management.
 *
 * Manages project goals including CRUD operations, linking threads,
 * and setting main goals.
 *
 * @module GoalsService
 */
import type {
  CreateGoalInput,
  CreateGoalResult,
  DeleteGoalInput,
  DeleteGoalResult,
  GetGoalAncestorsInput,
  GetGoalAncestorsResult,
  GetGoalChildrenInput,
  GetGoalChildrenResult,
  GetGoalInput,
  GetGoalResult,
  LinkThreadToGoalInput,
  LinkThreadToGoalResult,
  ListGoalsByProjectInput,
  ListGoalsByProjectResult,
  SetMainGoalInput,
  SetMainGoalResult,
  UnlinkThreadFromGoalInput,
  UnlinkThreadFromGoalResult,
  UpdateGoalInput,
  UpdateGoalResult,
  UpdateGoalTextInput,
  UpdateGoalTextResult,
} from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { GoalServiceError } from "../Errors.ts";

export interface GoalsServiceShape {
  readonly createGoal: (
    input: CreateGoalInput,
  ) => Effect.Effect<CreateGoalResult, GoalServiceError>;

  readonly getGoal: (input: GetGoalInput) => Effect.Effect<GetGoalResult, GoalServiceError>;

  readonly listGoalsByProject: (
    input: ListGoalsByProjectInput,
  ) => Effect.Effect<ListGoalsByProjectResult, GoalServiceError>;

  readonly setMainGoal: (
    input: SetMainGoalInput,
  ) => Effect.Effect<SetMainGoalResult, GoalServiceError>;

  readonly updateGoal: (
    input: UpdateGoalInput,
  ) => Effect.Effect<UpdateGoalResult, GoalServiceError>;

  readonly getGoalChildren: (
    input: GetGoalChildrenInput,
  ) => Effect.Effect<GetGoalChildrenResult, GoalServiceError>;

  readonly getGoalAncestors: (
    input: GetGoalAncestorsInput,
  ) => Effect.Effect<GetGoalAncestorsResult, GoalServiceError>;

  readonly linkThreadToGoal: (
    input: LinkThreadToGoalInput,
  ) => Effect.Effect<LinkThreadToGoalResult, GoalServiceError>;

  readonly unlinkThreadFromGoal: (
    input: UnlinkThreadFromGoalInput,
  ) => Effect.Effect<UnlinkThreadFromGoalResult, GoalServiceError>;

  readonly updateGoalText: (
    input: UpdateGoalTextInput,
  ) => Effect.Effect<UpdateGoalTextResult, GoalServiceError>;

  readonly deleteGoal: (
    input: DeleteGoalInput,
  ) => Effect.Effect<DeleteGoalResult, GoalServiceError>;
}

export class GoalsService extends ServiceMap.Service<GoalsService, GoalsServiceShape>()(
  "rowl/orchestration/Services/GoalsService",
) {}
