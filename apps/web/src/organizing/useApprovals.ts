import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApprovalGate,
  ApprovalGateId,
  CreateApprovalInput,
  GoalId,
  NativeApi,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";

export type ApprovalsController = {
  readonly approvals: ReadonlyArray<ApprovalGate>;
  readonly isApproved: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly listByGoal: (goalId?: GoalId) => Promise<ReadonlyArray<ApprovalGate>>;
  readonly create: (input: Omit<CreateApprovalInput, "goalId">) => Promise<ApprovalGate>;
  readonly approve: (input: {
    readonly approvalId: ApprovalGateId;
    readonly reviewedBy: string;
    readonly reason?: string;
  }) => Promise<ApprovalGate>;
  readonly reject: (input: {
    readonly approvalId: ApprovalGateId;
    readonly reviewedBy: string;
    readonly reason?: string;
  }) => Promise<ApprovalGate>;
  readonly isGoalApproved: (goalId?: GoalId) => Promise<boolean>;
};

export type ApprovalActions = Pick<
  ApprovalsController,
  "listByGoal" | "create" | "approve" | "reject" | "isGoalApproved"
>;

export function createApprovalActions(input: {
  readonly api: Pick<NativeApi, "approvals">;
  readonly goalId: GoalId;
}): ApprovalActions {
  return {
    async listByGoal(nextGoalId) {
      const result = await input.api.approvals.listByGoal({ goalId: nextGoalId ?? input.goalId });
      return result.approvals;
    },
    async create(createInput) {
      const result = await input.api.approvals.create({ goalId: input.goalId, ...createInput });
      return result.approval;
    },
    async approve(approveInput) {
      const result = await input.api.approvals.approve({
        goalId: input.goalId,
        ...approveInput,
      });
      return result.approval;
    },
    async reject(rejectInput) {
      const result = await input.api.approvals.reject({
        goalId: input.goalId,
        ...rejectInput,
      });
      return result.approval;
    },
    async isGoalApproved(nextGoalId) {
      const result = await input.api.approvals.isGoalApproved({
        goalId: nextGoalId ?? input.goalId,
      });
      return result.approved;
    },
  };
}

export function useApprovals(input: {
  readonly goalId: GoalId | null | undefined;
  readonly api?: NativeApi | undefined;
}): ApprovalsController {
  const api = input.api ?? readNativeApi();
  const goalId = input.goalId;
  const actions = useMemo(
    () => (api && goalId ? createApprovalActions({ api, goalId }) : null),
    [api, goalId],
  );
  const [approvals, setApprovals] = useState<ReadonlyArray<ApprovalGate>>([]);
  const [isApproved, setIsApproved] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(goalId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!actions || !goalId) {
      setApprovals([]);
      setIsApproved(false);
      setIsLoading(false);
      setError(api ? null : "Native API is unavailable.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [nextApprovals, approved] = await Promise.all([
        actions.listByGoal(goalId),
        actions.isGoalApproved(goalId),
      ]);
      setApprovals(nextApprovals);
      setIsApproved(approved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load approvals.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, api, goalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!api || !goalId) return;
    return api.approvals.onChanged((event) => {
      if (event.domain !== "approvals") return;
      if (event.goalId && event.goalId !== goalId) return;
      void refresh();
    });
  }, [api, goalId, refresh]);

  const track = useCallback(
    async (operation: () => Promise<ApprovalGate>) => {
      if (!actions) throw new Error("Native API is unavailable.");
      setError(null);
      try {
        const approval = await operation();
        setApprovals((current) => [
          ...current.filter((item) => item.id !== approval.id),
          approval,
        ]);
        setIsApproved(await actions.isGoalApproved(goalId ?? undefined));
        return approval;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not update approval.";
        setError(message);
        throw new Error(message, { cause: caught });
      }
    },
    [actions, goalId],
  );

  return {
    approvals,
    isApproved,
    isLoading,
    error,
    refresh,
    listByGoal: async (nextGoalId) => {
      if (!actions) return [];
      return actions.listByGoal(nextGoalId);
    },
    create: (createInput) => track(() => actions!.create(createInput)),
    approve: (approveInput) => track(() => actions!.approve(approveInput)),
    reject: (rejectInput) => track(() => actions!.reject(rejectInput)),
    isGoalApproved: async (nextGoalId) => {
      if (!actions) return false;
      return actions.isGoalApproved(nextGoalId);
    },
  };
}
