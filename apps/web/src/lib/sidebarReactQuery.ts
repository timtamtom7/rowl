/**
 * Shared React Query hooks for right sidebar data.
 *
 * Replaces the ad-hoc useState + useEffect pattern in each sidebar tab
 * with proper React Query caching, invalidation, and mutation handling.
 *
 * All sidebar queries share the "sidebar" prefix so they can be
 * bulk-invalidated when domain events arrive or when any tab mutates data.
 */
import type {
  ContextBudgetBreakdown,
  ContextBudget,
  ContextNode,
  Feature,
  FeatureStage,
  Goal,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";

// ── Query keys ──────────────────────────────────────────────────

export const sidebarQueryKeys = {
  all: ["sidebar"] as const,
  goals: (projectId: ProjectId) => ["sidebar", "goals", projectId] as const,
  features: (projectId: ProjectId) => ["sidebar", "features", projectId] as const,
  memories: (projectId: ProjectId) => ["sidebar", "memories", projectId] as const,
  memorySearch: (projectId: ProjectId, query: string) =>
    ["sidebar", "memories", projectId, "search", query] as const,
  contextNodes: (projectId: ProjectId) =>
    ["sidebar", "context-nodes", projectId] as const,
  contextBudget: (projectId: ProjectId, threadId: ThreadId | null) =>
    ["sidebar", "context-budget", projectId, threadId] as const,
  health: (projectId: ProjectId) => ["sidebar", "health", projectId] as const,
  agents: (projectId: ProjectId) => ["sidebar", "agents", projectId] as const,
  sourceFiles: (cwd: string) => ["sidebar", "source-files", cwd] as const,
};

const SIDEBAR_STALE_TIME = 5_000;

// ── Goals ───────────────────────────────────────────────────────

export function sidebarGoalsQueryOptions(projectId: ProjectId) {
  return queryOptions({
    queryKey: sidebarQueryKeys.goals(projectId),
    queryFn: async () => {
      const api = ensureNativeApi();
      const result = await api.goals.listByProject({ projectId });
      return result.goals as Goal[];
    },
    staleTime: SIDEBAR_STALE_TIME,
  });
}

export function useSidebarGoals(projectId: ProjectId) {
  const queryClient = useQueryClient();
  const query = useQuery(sidebarGoalsQueryOptions(projectId));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: sidebarQueryKeys.goals(projectId) });

  const createGoal = useMutation({
    mutationFn: async (input: { text: string; isMain: boolean }) => {
      const api = ensureNativeApi();
      return api.goals.create({ projectId, ...input });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sidebarQueryKeys.all });
    },
  });

  const updateGoalText = useMutation({
    mutationFn: async (input: { id: string; text: string }) => {
      const api = ensureNativeApi();
      return api.goals.updateText({ id: input.id as any, text: input.text });
    },
    onSuccess: () => void invalidate(),
  });

  const setMainGoal = useMutation({
    mutationFn: async (input: { id: string; isMain: boolean }) => {
      const api = ensureNativeApi();
      return api.goals.setMain({ id: input.id as any, isMain: input.isMain });
    },
    onSuccess: () => void invalidate(),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const api = ensureNativeApi();
      return api.goals.delete({ id: id as any });
    },
    onSuccess: () => void invalidate(),
  });

  return {
    goals: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createGoal,
    updateGoalText,
    setMainGoal,
    deleteGoal,
  };
}

// ── Features ────────────────────────────────────────────────────

export function sidebarFeaturesQueryOptions(projectId: ProjectId) {
  return queryOptions({
    queryKey: sidebarQueryKeys.features(projectId),
    queryFn: async () => {
      const api = ensureNativeApi();
      const result = await api.features.listByProject({ projectId });
      return result.features as Feature[];
    },
    staleTime: SIDEBAR_STALE_TIME,
  });
}

export function useSidebarFeatures(projectId: ProjectId) {
  const queryClient = useQueryClient();
  const query = useQuery(sidebarFeaturesQueryOptions(projectId));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: sidebarQueryKeys.features(projectId) });

  const createFeature = useMutation({
    mutationFn: async (input: {
      name: string;
      stage: FeatureStage;
      description?: string;
      createdBy?: string;
    }) => {
      const api = ensureNativeApi();
      return api.features.create({
        projectId,
        name: input.name,
        description: input.description ?? "",
        stage: input.stage,
        createdBy: (input.createdBy ?? "user") as any,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sidebarQueryKeys.all });
    },
  });

  const moveFeature = useMutation({
    mutationFn: async (input: { id: string; stage: FeatureStage }) => {
      const api = ensureNativeApi();
      return api.features.updateStage({ id: input.id as any, stage: input.stage });
    },
    onSuccess: () => void invalidate(),
  });

  const deleteFeature = useMutation({
    mutationFn: async (id: string) => {
      const api = ensureNativeApi();
      return api.features.delete({ id: id as any });
    },
    onSuccess: () => void invalidate(),
  });

  return {
    features: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createFeature,
    moveFeature,
    deleteFeature,
  };
}

// ── Memories ────────────────────────────────────────────────────

export function useSidebarMemories(projectId: ProjectId) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: sidebarQueryKeys.memories(projectId),
    queryFn: async () => {
      const api = ensureNativeApi();
      const result = await api.memory.listByProject({ projectId });
      return result.memories;
    },
    staleTime: SIDEBAR_STALE_TIME,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: sidebarQueryKeys.memories(projectId) });

  const createMemory = useMutation({
    mutationFn: async (input: {
      type: string;
      content: string;
      summary: string;
      importance?: number;
    }) => {
      const api = ensureNativeApi();
      return api.memory.create({
        projectId,
        threadId: null,
        type: input.type as any,
        content: input.content,
        summary: input.summary,
        importance: input.importance,
      });
    },
    onSuccess: () => void invalidate(),
  });

  const deleteMemory = useMutation({
    mutationFn: async (id: string) => {
      const api = ensureNativeApi();
      return api.memory.delete({ id });
    },
    onSuccess: () => void invalidate(),
  });

  const search = async (query: string) => {
    const api = ensureNativeApi();
    const result = await api.memory.search({ query, projectId, limit: 20 });
    return result.memories;
  };

  return {
    memories: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,
    createMemory,
    deleteMemory,
    search,
  };
}

// ── Context Nodes + Budget ──────────────────────────────────────

export function useSidebarContext(projectId: ProjectId, activeThreadId?: ThreadId | null) {
  const queryClient = useQueryClient();

  const nodesQuery = useQuery({
    queryKey: sidebarQueryKeys.contextNodes(projectId),
    queryFn: async () => {
      const api = ensureNativeApi();
      const result = await api.context.listByProject({ projectId });
      return {
        nodes: result.nodes as ContextNode[],
        budget: result.budget as ContextBudget,
      };
    },
    staleTime: SIDEBAR_STALE_TIME,
  });

  const budgetQuery = useQuery({
    queryKey: sidebarQueryKeys.contextBudget(projectId, activeThreadId ?? null),
    queryFn: async () => {
      if (!activeThreadId) return null;
      const api = ensureNativeApi();
      const result = await api.context.getBudget({ threadId: activeThreadId, projectId });
      return result.breakdown as unknown as ContextBudgetBreakdown;
    },
    staleTime: SIDEBAR_STALE_TIME,
    enabled: !!activeThreadId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: sidebarQueryKeys.contextNodes(projectId) });

  const compressNode = useMutation({
    mutationFn: async (id: string) => {
      const api = ensureNativeApi();
      return api.context.compressNode({ id: id as any });
    },
    onSuccess: () => void invalidate(),
  });

  const restoreNode = useMutation({
    mutationFn: async (id: string) => {
      const api = ensureNativeApi();
      return api.context.restoreNode({ id: id as any });
    },
    onSuccess: () => void invalidate(),
  });

  const deleteNode = useMutation({
    mutationFn: async (id: string) => {
      const api = ensureNativeApi();
      return api.context.deleteNode({ id: id as any });
    },
    onSuccess: () => void invalidate(),
  });

  return {
    nodes: nodesQuery.data?.nodes ?? [],
    budget: nodesQuery.data?.budget ?? null,
    breakdown: budgetQuery.data ?? null,
    isLoading: nodesQuery.isLoading,
    error: nodesQuery.error,
    compressNode,
    restoreNode,
    deleteNode,
  };
}

// ── Agents ──────────────────────────────────────────────────────

export function useSidebarAgents(projectId: ProjectId) {
  const query = useQuery({
    queryKey: sidebarQueryKeys.agents(projectId),
    queryFn: async () => {
      const api = ensureNativeApi();
      const result = await api.agents.getOverview({ projectId });
      return result.overview as any;
    },
    staleTime: 3_000, // Agents poll faster
    refetchInterval: 5_000, // Auto-refresh every 5s
  });

  return {
    overview: query.data ?? null,
    agents: (query.data?.agents ?? []) as any[],
    conflicts: (query.data?.conflicts ?? []) as any[],
    runningCount: (query.data?.runningAgents ?? 0) as number,
    isLoading: query.isLoading,
  };
}

// ── Codebase Health ─────────────────────────────────────────────

export function useSidebarHealth(projectId: ProjectId) {
  const query = useQuery({
    queryKey: sidebarQueryKeys.health(projectId),
    queryFn: async () => {
      const api = ensureNativeApi();
      const result = await api.codebaseHealth.getSummary({ projectId });
      return result.summary as any;
    },
    staleTime: 30_000, // Health changes slowly
  });

  return {
    summary: query.data ?? null,
    isLoading: query.isLoading,
  };
}

// ── Bulk invalidation helper ────────────────────────────────────

/**
 * Call this from __root.tsx when domain events arrive to refresh all sidebar data.
 */
export function invalidateAllSidebarQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: sidebarQueryKeys.all });
}
