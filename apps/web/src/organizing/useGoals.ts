import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreateGoalInput,
  Goal,
  GoalId,
  ListGoalsByProjectInput,
  NativeApi,
  ProjectId,
  UpdateGoalInput,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";

export type GoalsController = {
  readonly goals: ReadonlyArray<Goal>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly listByProject: (input?: ListGoalsByProjectInput) => Promise<ReadonlyArray<Goal>>;
  readonly create: (input: Omit<CreateGoalInput, "projectId">) => Promise<Goal>;
  readonly update: (input: UpdateGoalInput) => Promise<Goal>;
  readonly getChildren: (parentId: GoalId) => Promise<ReadonlyArray<Goal>>;
  readonly getAncestors: (id: GoalId) => Promise<ReadonlyArray<Goal>>;
};

export type GoalActions = Pick<
  GoalsController,
  "listByProject" | "create" | "update" | "getChildren" | "getAncestors"
>;

export function createGoalActions(input: {
  readonly api: Pick<NativeApi, "goals">;
  readonly projectId: ProjectId;
}): GoalActions {
  return {
    async listByProject(nextInput) {
      const result = await input.api.goals.listByProject(nextInput ?? { projectId: input.projectId });
      return result.goals;
    },
    async create(createInput) {
      const result = await input.api.goals.create({ projectId: input.projectId, ...createInput });
      return result.goal;
    },
    async update(updateInput) {
      const result = await input.api.goals.update(updateInput);
      return result.goal;
    },
    async getChildren(parentId) {
      const result = await input.api.goals.getChildren({ parentId });
      return result.goals;
    },
    async getAncestors(id) {
      const result = await input.api.goals.getAncestors({ id });
      return result.goals;
    },
  };
}

export function useGoals(input: {
  readonly projectId: ProjectId | null | undefined;
  readonly api?: NativeApi | undefined;
}): GoalsController {
  const api = input.api ?? readNativeApi();
  const projectId = input.projectId;
  const actions = useMemo(
    () => (api && projectId ? createGoalActions({ api, projectId }) : null),
    [api, projectId],
  );
  const [goals, setGoals] = useState<ReadonlyArray<Goal>>([]);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!actions || !projectId) {
      setGoals([]);
      setIsLoading(false);
      setError(api ? null : "Native API is unavailable.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setGoals(await actions.listByProject({ projectId }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load goals.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, api, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!api || !projectId) return;
    return api.goals.onChanged((event) => {
      if (event.domain !== "goals") return;
      if (event.projectId && event.projectId !== projectId) return;
      void refresh();
    });
  }, [api, projectId, refresh]);

  const create = useCallback(
    async (createInput: Omit<CreateGoalInput, "projectId">) => {
      if (!actions) throw new Error("Native API is unavailable.");
      setError(null);
      try {
        const goal = await actions.create(createInput);
        setGoals((current) => [...current.filter((item) => item.id !== goal.id), goal]);
        return goal;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not create goal.";
        setError(message);
        throw new Error(message, { cause: caught });
      }
    },
    [actions],
  );

  const update = useCallback(
    async (updateInput: UpdateGoalInput) => {
      if (!actions) throw new Error("Native API is unavailable.");
      setError(null);
      try {
        const goal = await actions.update(updateInput);
        setGoals((current) => current.map((item) => (item.id === goal.id ? goal : item)));
        return goal;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not update goal.";
        setError(message);
        throw new Error(message, { cause: caught });
      }
    },
    [actions],
  );

  return {
    goals,
    isLoading,
    error,
    refresh,
    listByProject: async (nextInput) => {
      if (!actions) return [];
      return actions.listByProject(nextInput);
    },
    create,
    update,
    getChildren: async (parentId) => {
      if (!actions) return [];
      return actions.getChildren(parentId);
    },
    getAncestors: async (id) => {
      if (!actions) return [];
      return actions.getAncestors(id);
    },
  };
}
