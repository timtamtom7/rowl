import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreateWorktreeCheckpointInput,
  NativeApi,
  WorktreeCheckpoint,
  WorktreeCheckpointResult,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";

const REFRESH_INTERVAL_MS = 15_000;

export type WorktreeCheckpointsController = {
  readonly checkpoints: ReadonlyArray<WorktreeCheckpoint>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly listByWorktree: () => Promise<ReadonlyArray<WorktreeCheckpoint>>;
  readonly createCheckpointInWorktree: (
    input?: Pick<CreateWorktreeCheckpointInput, "checkpointRef" | "message">,
  ) => Promise<WorktreeCheckpointResult>;
};

export type WorktreeCheckpointActions = Pick<
  WorktreeCheckpointsController,
  "listByWorktree" | "createCheckpointInWorktree"
>;

export function createWorktreeCheckpointActions(input: {
  readonly api: Pick<NativeApi, "checkpoints">;
  readonly cwd: string;
  readonly worktreeBranch: string;
}): WorktreeCheckpointActions {
  return {
    async listByWorktree() {
      const result = await input.api.checkpoints.listByWorktree({
        cwd: input.cwd,
        worktreeBranch: input.worktreeBranch,
      });
      return result.checkpoints;
    },
    async createCheckpointInWorktree(createInput = {}) {
      return input.api.checkpoints.createInWorktree({
        cwd: input.cwd,
        worktreeBranch: input.worktreeBranch,
        ...createInput,
      });
    },
  };
}

export function useWorktreeCheckpoints(
  worktreeBranch: string | null | undefined,
  input: {
    readonly cwd: string | null | undefined;
    readonly api?: NativeApi | undefined;
    readonly autoRefreshMs?: number | false | undefined;
  },
): WorktreeCheckpointsController {
  const api = input.api ?? readNativeApi();
  const cwd = input.cwd?.trim() || null;
  const branch = worktreeBranch?.trim() || null;
  const actions = useMemo(
    () =>
      api && cwd && branch
        ? createWorktreeCheckpointActions({ api, cwd, worktreeBranch: branch })
        : null,
    [api, branch, cwd],
  );
  const [checkpoints, setCheckpoints] = useState<ReadonlyArray<WorktreeCheckpoint>>([]);
  const [isLoading, setIsLoading] = useState(Boolean(cwd && branch));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!actions) {
      setCheckpoints([]);
      setIsLoading(false);
      setError(api ? null : "Native API is unavailable.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setCheckpoints(await actions.listByWorktree());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load checkpoints.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!actions || input.autoRefreshMs === false) return;
    const intervalMs = input.autoRefreshMs ?? REFRESH_INTERVAL_MS;
    const interval = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [actions, input.autoRefreshMs, refresh]);

  return {
    checkpoints,
    isLoading,
    error,
    refresh,
    listByWorktree: async () => {
      if (!actions) return [];
      return actions.listByWorktree();
    },
    async createCheckpointInWorktree(createInput) {
      if (!actions) throw new Error("Native API is unavailable.");
      const result = await actions.createCheckpointInWorktree(createInput);
      setCheckpoints((current) => [
        result.checkpoint,
        ...current.filter(
          (checkpoint) => checkpoint.checkpointRef !== result.checkpoint.checkpointRef,
        ),
      ]);
      return result;
    },
  };
}
