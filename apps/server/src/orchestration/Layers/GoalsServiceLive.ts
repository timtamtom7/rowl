import { randomUUID } from "node:crypto";
import {
  GoalId,
  type Goal,
  type CreateGoalInput,
  type CreateGoalResult,
  type DeleteGoalInput,
  type DeleteGoalResult,
  type GetGoalAncestorsInput,
  type GetGoalAncestorsResult,
  type GetGoalChildrenInput,
  type GetGoalChildrenResult,
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
  type UpdateGoalInput,
  type UpdateGoalResult,
  type UpdateGoalTextInput,
  type UpdateGoalTextResult,
  type ThreadId,
} from "@t3tools/contracts";
import { Effect, Layer, Option } from "effect";

import { ServerConfig } from "../../config.ts";
import { GoalServiceError } from "../Errors.ts";
import { GoalsService, type GoalsServiceShape } from "../Services/GoalsService.ts";
import {
  ProjectionGoalRepository,
  type ProjectionGoal,
} from "../../persistence/Services/ProjectionGoals.ts";
import {
  deleteGoalFiles,
  listGoalMetadata,
  readGoalMetadata,
  writeGoalMetadata,
} from "../goalFileStorage.ts";

function toGoal(row: ProjectionGoal, metadata?: Goal | null): Goal {
  return {
    id: row.goalId,
    projectId: row.projectId,
    text: row.text,
    isMain: row.isMain,
    linkedThreadIds: [...row.linkedThreadIds] as ThreadId[],
    ...(metadata?.parentId ? { parentId: metadata.parentId } : {}),
    status: metadata?.status ?? "active",
    level: metadata?.level ?? "task",
    ...(metadata?.ownerAgentId ? { ownerAgentId: metadata.ownerAgentId } : {}),
    ...(metadata?.description ? { description: metadata.description } : {}),
    createdAt: row.createdAt,
  } as Goal;
}

export const GoalsServiceLive = Layer.effect(
  GoalsService,
  Effect.gen(function* () {
    const goalRepo = yield* ProjectionGoalRepository;
    const { stateDir } = yield* ServerConfig;

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

    const readMetadata = (goalId: GoalId, operation: string) =>
      Effect.tryPromise({
        try: () => readGoalMetadata(stateDir, goalId),
        catch: (cause) =>
          new GoalServiceError({
            operation,
            detail: `Failed to read goal metadata for '${goalId}'.`,
            cause,
          }),
      });

    const persistGoalMetadata = (goal: Goal, operation: string) =>
      Effect.tryPromise({
        try: () => writeGoalMetadata({ stateDir, goal }),
        catch: (cause) =>
          new GoalServiceError({
            operation,
            detail: `Failed to write goal metadata for '${goal.id}'.`,
            cause,
          }),
      });

    const goalFromRow = (row: ProjectionGoal, operation: string) =>
      readMetadata(row.goalId, operation).pipe(Effect.map((metadata) => toGoal(row, metadata)));

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

        const goal = toGoal(row, {
          id: goalId,
          projectId: input.projectId,
          text: input.text,
          isMain: input.isMain,
          linkedThreadIds: [],
          ...(input.parentId ? { parentId: input.parentId } : {}),
          status: input.status ?? "active",
          level: input.level ?? "task",
          ...(input.ownerAgentId ? { ownerAgentId: input.ownerAgentId } : {}),
          ...(input.description ? { description: input.description } : {}),
          createdAt: now,
        } as Goal);
        yield* persistGoalMetadata(goal, "createGoal");

        return { goal } satisfies CreateGoalResult;
      });

    const getGoal: GoalsServiceShape["getGoal"] = (input: GetGoalInput) =>
      Effect.gen(function* () {
        const row = yield* requireGoal(input.id, "getGoal");
        return { goal: yield* goalFromRow(row, "getGoal") } satisfies GetGoalResult;
      });

    const listGoalsByProject: GoalsServiceShape["listGoalsByProject"] = (
      input: ListGoalsByProjectInput,
    ) =>
      Effect.gen(function* () {
        const rows = yield* goalRepo.listByProjectId({ projectId: input.projectId }).pipe(
          Effect.mapError(
            (cause) =>
              new GoalServiceError({
                operation: "listGoalsByProject",
                detail: String(cause),
                cause,
              }),
          ),
        );
        const goals = yield* Effect.forEach(rows, (row) => goalFromRow(row, "listGoalsByProject"));
        return { goals } satisfies ListGoalsByProjectResult;
      });

    const updateGoal: GoalsServiceShape["updateGoal"] = (input: UpdateGoalInput) =>
      Effect.gen(function* () {
        const row = yield* requireGoal(input.id, "updateGoal");
        if (input.parentId === input.id) {
          return yield* new GoalServiceError({
            operation: "updateGoal",
            detail: "A goal cannot be its own parent.",
          });
        }

        if (input.isMain === true) {
          yield* goalRepo
            .clearMainGoalForProject({
              projectId: row.projectId,
              exceptGoalId: row.goalId,
            })
            .pipe(
              Effect.mapError(
                (cause) =>
                  new GoalServiceError({
                    operation: "updateGoal",
                    detail: String(cause),
                    cause,
                  }),
              ),
            );
        }

        const current = yield* goalFromRow(row, "updateGoal");
        const updatedGoal: Goal = {
          ...current,
          ...(input.text ? { text: input.text } : {}),
          ...(input.isMain !== undefined ? { isMain: input.isMain } : {}),
          ...(input.linkedThreadIds ? { linkedThreadIds: input.linkedThreadIds } : {}),
          ...(input.parentId !== undefined && input.parentId !== null
            ? { parentId: input.parentId }
            : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.level ? { level: input.level } : {}),
          ...(input.ownerAgentId !== undefined && input.ownerAgentId !== null
            ? { ownerAgentId: input.ownerAgentId }
            : {}),
          ...(input.description !== undefined && input.description !== null
            ? { description: input.description }
            : {}),
        };
        if (input.parentId === null) delete (updatedGoal as { parentId?: GoalId }).parentId;
        if (input.ownerAgentId === null) {
          delete (updatedGoal as { ownerAgentId?: string }).ownerAgentId;
        }
        if (input.description === null) {
          delete (updatedGoal as { description?: string }).description;
        }

        const updatedRow = {
          ...row,
          text: updatedGoal.text,
          isMain: updatedGoal.isMain,
          linkedThreadIds: updatedGoal.linkedThreadIds,
        } as ProjectionGoal;
        yield* goalRepo.upsert(updatedRow).pipe(
          Effect.mapError(
            (cause) =>
              new GoalServiceError({
                operation: "updateGoal",
                detail: String(cause),
                cause,
              }),
          ),
        );
        yield* persistGoalMetadata(updatedGoal, "updateGoal");

        return { goal: updatedGoal } satisfies UpdateGoalResult;
      });

    const getGoalChildren: GoalsServiceShape["getGoalChildren"] = (input: GetGoalChildrenInput) =>
      Effect.tryPromise({
        try: async () => {
          const metadata = await listGoalMetadata(stateDir);
          const goals = metadata
            .filter((goal) => goal.parentId === input.parentId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          return { goals } satisfies GetGoalChildrenResult;
        },
        catch: (cause) =>
          new GoalServiceError({
            operation: "getGoalChildren",
            detail: `Failed to list child goals for '${input.parentId}'.`,
            cause,
          }),
      });

    const getGoalAncestors: GoalsServiceShape["getGoalAncestors"] = (
      input: GetGoalAncestorsInput,
    ) =>
      Effect.gen(function* () {
        const ancestors: Goal[] = [];
        const visited = new Set<string>();
        let current = (yield* getGoal({ id: input.id })).goal;

        while (current.parentId) {
          if (visited.has(current.parentId)) {
            return yield* new GoalServiceError({
              operation: "getGoalAncestors",
              detail: `Cycle detected while walking ancestors for '${input.id}'.`,
            });
          }
          visited.add(current.parentId);
          current = (yield* getGoal({ id: current.parentId })).goal;
          ancestors.push(current);
        }

        return { goals: ancestors } satisfies GetGoalAncestorsResult;
      });

    const setMainGoal: GoalsServiceShape["setMainGoal"] = (input: SetMainGoalInput) =>
      updateGoal({ id: input.id, isMain: input.isMain }).pipe(
        Effect.map(({ goal }) => ({ goal }) satisfies SetMainGoalResult),
      );

    const linkThreadToGoal: GoalsServiceShape["linkThreadToGoal"] = (
      input: LinkThreadToGoalInput,
    ) =>
      Effect.gen(function* () {
        const goal = (yield* getGoal({ id: input.goalId })).goal;
        const threadIds = new Set(goal.linkedThreadIds);
        threadIds.add(input.threadId);
        const result = yield* updateGoal({
          id: input.goalId,
          linkedThreadIds: [...threadIds] as ThreadId[],
        });
        return { goal: result.goal } satisfies LinkThreadToGoalResult;
      });

    const unlinkThreadFromGoal: GoalsServiceShape["unlinkThreadFromGoal"] = (
      input: UnlinkThreadFromGoalInput,
    ) =>
      Effect.gen(function* () {
        const goal = (yield* getGoal({ id: input.goalId })).goal;
        const result = yield* updateGoal({
          id: input.goalId,
          linkedThreadIds: goal.linkedThreadIds.filter((id) => id !== input.threadId),
        });
        return { goal: result.goal } satisfies UnlinkThreadFromGoalResult;
      });

    const updateGoalText: GoalsServiceShape["updateGoalText"] = (input: UpdateGoalTextInput) =>
      updateGoal({ id: input.id, text: input.text }).pipe(
        Effect.map(({ goal }) => ({ goal }) satisfies UpdateGoalTextResult),
      );

    const deleteGoal: GoalsServiceShape["deleteGoal"] = (input: DeleteGoalInput) =>
      Effect.gen(function* () {
        yield* goalRepo.deleteById({ goalId: input.id }).pipe(
          Effect.mapError(
            (cause) =>
              new GoalServiceError({
                operation: "deleteGoal",
                detail: String(cause),
                cause,
              }),
          ),
        );
        yield* Effect.tryPromise({
          try: () => deleteGoalFiles(stateDir, input.id),
          catch: (cause) =>
            new GoalServiceError({
              operation: "deleteGoal",
              detail: `Failed to delete goal files for '${input.id}'.`,
              cause,
            }),
        });
        return {} satisfies DeleteGoalResult;
      });

    return {
      createGoal,
      getGoal,
      listGoalsByProject,
      setMainGoal,
      updateGoal,
      getGoalChildren,
      getGoalAncestors,
      linkThreadToGoal,
      unlinkThreadFromGoal,
      updateGoalText,
      deleteGoal,
    } satisfies GoalsServiceShape;
  }),
);
