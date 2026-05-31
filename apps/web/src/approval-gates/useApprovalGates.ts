import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  NativeApi,
  ThreadApprovalGate,
  ThreadApprovalGateId,
  ThreadId,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";

export type ApprovalGatesController = {
  readonly gates: ReadonlyArray<ThreadApprovalGate>;
  readonly pendingGates: ReadonlyArray<ThreadApprovalGate>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly approve: (id: ThreadApprovalGateId) => Promise<ThreadApprovalGate>;
  readonly reject: (id: ThreadApprovalGateId) => Promise<ThreadApprovalGate>;
};

export function useApprovalGates(input: {
  readonly threadId: ThreadId | null | undefined;
  readonly api?: NativeApi | undefined;
}): ApprovalGatesController {
  const api = input.api ?? readNativeApi();
  const threadId = input.threadId;
  const [gates, setGates] = useState<ReadonlyArray<ThreadApprovalGate>>([]);
  const [isLoading, setIsLoading] = useState(Boolean(threadId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api || !threadId) {
      setGates([]);
      setIsLoading(false);
      setError(api ? null : "Native API is unavailable.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.approvalGates.list({ threadId });
      setGates(result.gates);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load approval gates.");
    } finally {
      setIsLoading(false);
    }
  }, [api, threadId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!threadId) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [refresh, threadId]);

  const track = useCallback(async (operation: () => Promise<{ gate: ThreadApprovalGate }>) => {
    setError(null);
    try {
      const { gate } = await operation();
      setGates((current) => [...current.filter((item) => item.id !== gate.id), gate]);
      return gate;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not update approval gate.";
      setError(message);
      throw new Error(message, { cause: caught });
    }
  }, []);

  return {
    gates,
    pendingGates: useMemo(() => gates.filter((gate) => gate.status === "pending"), [gates]),
    isLoading,
    error,
    refresh,
    approve: (id) => {
      if (!api) throw new Error("Native API is unavailable.");
      return track(() => api.approvalGates.approve({ id }));
    },
    reject: (id) => {
      if (!api) throw new Error("Native API is unavailable.");
      return track(() => api.approvalGates.reject({ id }));
    },
  };
}
