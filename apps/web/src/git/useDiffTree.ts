import { useCallback, useEffect, useMemo, useState } from "react";
import type { DiffTree, GitGetDiffTreeInput, NativeApi } from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";

export type DiffTreeController = {
  readonly diffTree: DiffTree | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
};

export type DiffTreeActions = {
  readonly getDiffTree: () => Promise<DiffTree>;
};

export function createDiffTreeActions(input: {
  readonly api: Pick<NativeApi, "git">;
  readonly request: GitGetDiffTreeInput;
}): DiffTreeActions {
  return {
    getDiffTree() {
      return input.api.git.getDiffTree(input.request);
    },
  };
}

export function useDiffTree(
  request: GitGetDiffTreeInput | null | undefined,
  input: {
    readonly api?: NativeApi | undefined;
    readonly enabled?: boolean | undefined;
  } = {},
): DiffTreeController {
  const api = input.api ?? readNativeApi();
  const enabled = input.enabled ?? true;
  const requestKey = request ? JSON.stringify(request) : "";
  const stableRequest = useMemo(
    () => (requestKey ? (JSON.parse(requestKey) as GitGetDiffTreeInput) : null),
    [requestKey],
  );
  const actions = useMemo(
    () =>
      api && stableRequest && enabled
        ? createDiffTreeActions({
            api,
            request: stableRequest,
          })
        : null,
    [api, enabled, stableRequest],
  );
  const [diffTree, setDiffTree] = useState<DiffTree | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(actions));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!actions) {
      setDiffTree(null);
      setIsLoading(false);
      setError(api ? null : "Native API is unavailable.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setDiffTree(await actions.getDiffTree());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load diff tree.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    diffTree,
    isLoading,
    error,
    refresh,
  };
}
