import { randomUUID } from "node:crypto";
import {
  GoalId,
  type Goal,
  type CreateGoalInput,
  type CreateGoalResult,
  type DeleteGoalInput,
  type DeleteGoalResult,
  type GetGoalInput,
  type GetGoalResult,
  type LinkThreadToGoalInput,
  type LinkThreadToGoalResult,
  type ListGoalsByProjectInput,
  type ListGoalsByProjectResult,
  type SetMainGoalInput,
  type SetMainGoalResult,
  type UnlinkThreadFromGoalInput,
  type UnlinkThreadFromGoalResult,
  type UpdateGoalTextInput,
  type UpdateGoalTextResult,
  type ThreadId,
} from "@t3tools/contracts";
import { Effect, Layer, Option } from "effect";

import { GoalServiceError } from "../Errors.ts";
import { GoalsService, type GoalsServiceShape } from "../Services/GoalsService.ts";
import {
  ProjectionGoalRepository,
  type ProjectionGoal,
} from "../../persistence/Services/ProjectionGoals.ts";

function toGoal(row: ProjectionGoal): Goal {
  return {
    id: row.goalId,
    projectId: row.projectId,
    text: row.text,
    isMain: row.isMain,
    linkedThreadIds: [...row.linkedThreadIds] as ThreadId[],
    createdAt: row.createdAt,
  } as Goal;
}

export const GoalsServiceLive = Layer.effect(
  GoalsService,
  Effect.gen(function* () {
    const goalRepo = yield* ProjectionGoalRepository;

    const requireGoal = (goalId: GoalId, operation: string) =>
      goalRepo.getById({ goalId }).pipe(
        Effect.mapError(
          (cause) => new GoalServiceError({ operation, detail: String(cause), cause }),
        ),
        Effect.flatMap((opt) =>
          Option.match(opt, {
            onNone: () =>
              Effect.fail(
                new GoalServiceError({
                  operation,
                  detail: `Goal '${goalId}' not found.`,
                }),
              ),
            onSome: Effect.succeed,
          }),
        ),
      );

    const createGoal: GoalsServiceShape["createGoal"] = (input: CreateGoalInput) =>
      Effect.gen(function* () {
        const goalId = GoalId.makeUnsafe(randomUUID());
        const now = new Date().toISOString();

        if (input.isMain) {
          yield* goalRepo
            .clearMainGoalForProject({
              projectId: input.projectId,
              exceptGoalId: goalId,
            })
            .pipe(
              Effect.mapError(
                (cause) =>
                  new GoalServiceError({
                    operation: "createGoal",
                    detail: String(cause),
                    cause,
                  }),
              ),
            );
        }

        const row: ProjectionGoal = {
          goalId,
          projectId: input.projectId,
          text: input.text,
          isMain: input.isMain,
          linkedThreadIds: [],
          createdAt: now,
        } as ProjectionGoal;

        yield* goalRepo.upsert(row).pipe(
          Effect.mapError(
            (cause) =>
              new GoalServiceError({
                operation: "createGoal",
                detail: String(cause),
                cause,
              }),
          ),
        );

        return { goal: toGoal(row) } satisfies CreateGoalResult;
      });

    const getGoal: GoalsServiceShape["getGoal"] = (input: GetGoalInput) =>
      Effect.gen(function* () {
        const row = yield* requireGoal(input.id, "getGoal");
        return { goal: toGoal(row) } satisfies GetGoalResult;
      });

    const listGoalsByProject: GoalsServiceShape["listGoalsByProject"] = (
      input: ListGoalsByProjectInput,
    ) =>
      goalRepo.listByProjectId({ projectId: input.projectId }).pipe(
        Effect.map((rows) => ({
          goals: rows.map(toGoal),
        })),
        Effect.mapError(
          (cause) =>
            new GoalServiceError({
              operation: "listGoalsByProject",
              detail: String(cause),
              cause,
            }),
        ),
      ) as Effect.Effect<ListGoalsByProjectResult, GoalServiceError>;

    const setMainGoal: GoalsServiceShape["setMainGoal"] = (input: SetMainGoalInput) =>
      Effect.gen(function* () {
        const row = yield* requireGoal(input.id, "setMainGoal");

        if (input.isMain) {
          yield* goalRepo
            .clearMainGoalForProject({
              projectId: row.projectId,
              exceptGoalId: row.goalId,
            })
            .pipe(
              Effect.mapError(
                (cause) =>
                  new GoalServiceError({
                    operation: "setMainGoal",
                    detail: String(cause),
                    cause,
                  }),
              ),
            );
        }

        const updated = { ...row, isMain: input.isMain } as ProjectionGoal;
        yield* goalRepo.upsert(updated).pipe(
          Effect.mapError(
            (cause) =>
              new GoalServiceError({
                operation: "setMainGoal",
                detail: String(cause),
                cause,
              }),
          ),
        );

        return { goal: toGoal(updated) } satisfies SetMainGoalResult;
      });

    const linkThreadToGoal: GoalsServiceShape["linkThreadToGoal"] = (
      input: LinkThreadToGoalInput,
    ) =>
      Effect.gen(function* () {
        const row = yield* requireGoal(input.goalId, "linkThreadToGoal");
        const threadIds = new Set(row.linkedThreadIds);
        threadIds.add(input.threadId);

        const updated = {
          ...row,
          linkedThreadIds: [...threadIds],
        } as ProjectionGoal;
        yield* goalRepo.upsert(updated).pipe(
          Effect.mapError(
            (cause) =>
              new GoalServiceError({
                operation: "linkThreadToGoal",
                detail: String(cause),
                cause,
              }),
          ),
        );

        return { goal: toGoal(updated) } satisfies LinkThreadToGoalResult;
      });

    const unlinkThreadFromGoal: GoalsServiceShape["unlinkThreadFromGoal"] = (
      input: UnlinkThreadFromGoalInput,
    ) =>
      Effect.gen(function* () {
        const row = yield* requireGoal(input.goalId, "unlinkThreadFromGoal");
        const updated = {
          ...row,
          linkedThreadIds: row.linkedThreadIds.filter((id) => id !== input.threadId),
        } as ProjectionGoal;
        yield* goalRepo.upsert(updated).pipe(
          Effect.mapError(
            (cause) =>
              new GoalServiceError({
                operation: "unlinkThreadFromGoal",
                detail: String(cause),
                cause,
              }),
          ),
        );

        return { goal: toGoal(updated) } satisfies UnlinkThreadFromGoalResult;
      });

    const updateGoalText: GoalsServiceShape["updateGoalText"] = (input: UpdateGoalTextInput) =>
      Effect.gen(function* () {
        const row = yield* requireGoal(input.id, "updateGoalText");
        const updated = { ...row, text: input.text } as ProjectionGoal;
        yield* goalRepo.upsert(updated).pipe(
          Effect.mapError(
            (cause) =>
              new GoalServiceError({
                operation: "updateGoalText",
                detail: String(cause),
                cause,
              }),
          ),
        );

        return { goal: toGoal(updated) } satisfies UpdateGoalTextResult;
      });

    const deleteGoal: GoalsServiceShape["deleteGoal"] = (input: DeleteGoalInput) =>
      goalRepo.deleteById({ goalId: input.id }).pipe(
        Effect.map(() => ({}) satisfies DeleteGoalResult),
        Effect.mapError(
          (cause) =>
            new GoalServiceError({
              operation: "deleteGoal",
              detail: String(cause),
              cause,
            }),
        ),
      );

    return {
      createGoal,
      getGoal,
      listGoalsByProject,
      setMainGoal,
      linkThreadToGoal,
      unlinkThreadFromGoal,
      updateGoalText,
      deleteGoal,
    } satisfies GoalsServiceShape;
  }),
);
