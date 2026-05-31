import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreateWorktreeInput,
  GitCherryPickInput,
  GitMergeBranchInput,
  NativeApi,
  WorktreeInfo,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";

export type WorktreesController = {
  readonly worktrees: ReadonlyArray<WorktreeInfo>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly list: () => Promise<ReadonlyArray<WorktreeInfo>>;
  readonly create: (input: Omit<CreateWorktreeInput, "cwd">) => Promise<WorktreeInfo>;
  readonly remove: (branch: string, force?: boolean) => Promise<void>;
  readonly info: (branch: string) => Promise<WorktreeInfo | null>;
  readonly cherryPick: (input: Omit<GitCherryPickInput, "cwd">) => Promise<void>;
  readonly merge: (input: Omit<GitMergeBranchInput, "cwd">) => Promise<void>;
};

export type WorktreeActions = Pick<
  WorktreesController,
  "list" | "create" | "remove" | "info" | "cherryPick" | "merge"
>;

export function createWorktreeActions(input: {
  readonly api: Pick<NativeApi, "git">;
  readonly cwd: string;
}): WorktreeActions {
  return {
    async list() {
      const result = await input.api.git.worktrees.list({ cwd: input.cwd });
      return result.worktrees;
    },
    async create(createInput) {
      const result = await input.api.git.worktrees.create({ cwd: input.cwd, ...createInput });
      return result.worktree;
    },
    async remove(branch, force) {
      await input.api.git.worktrees.remove({ cwd: input.cwd, branch, force });
    },
    async info(branch) {
      return input.api.git.worktrees.info({ cwd: input.cwd, branch });
    },
    async cherryPick(cherryPickInput) {
      await input.api.git.cherryPick({ cwd: input.cwd, ...cherryPickInput });
    },
    async merge(mergeInput) {
      await input.api.git.mergeBranch({ cwd: input.cwd, ...mergeInput });
    },
  };
}

export function useWorktrees(input: {
  readonly cwd: string | null | undefined;
  readonly api?: NativeApi | undefined;
}): WorktreesController {
  const api = input.api ?? readNativeApi();
  const cwd = input.cwd?.trim() || null;
  const actions = useMemo(
    () => (api && cwd ? createWorktreeActions({ api, cwd }) : null),
    [api, cwd],
  );
  const [worktrees, setWorktrees] = useState<ReadonlyArray<WorktreeInfo>>([]);
  const [isLoading, setIsLoading] = useState(Boolean(cwd));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!actions) {
      setWorktrees([]);
      setIsLoading(false);
      setError(api ? null : "Native API is unavailable.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setWorktrees(await actions.list());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load worktrees.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    worktrees,
    isLoading,
    error,
    refresh,
    list: async () => {
      if (!actions) return [];
      return actions.list();
    },
    async create(createInput) {
      if (!actions) throw new Error("Native API is unavailable.");
      const worktree = await actions.create(createInput);
      setWorktrees((current) => [
        ...current.filter((item) => item.branch !== worktree.branch),
        worktree,
      ]);
      return worktree;
    },
    async remove(branch, force) {
      if (!actions) return;
      await actions.remove(branch, force);
      setWorktrees((current) => current.filter((worktree) => worktree.branch !== branch));
    },
    async info(branch) {
      if (!actions) return null;
      return actions.info(branch);
    },
    async cherryPick(cherryPickInput) {
      if (!actions) return;
      await actions.cherryPick(cherryPickInput);
      await refresh();
    },
    async merge(mergeInput) {
      if (!actions) return;
      await actions.merge(mergeInput);
      await refresh();
    },
  };
}
