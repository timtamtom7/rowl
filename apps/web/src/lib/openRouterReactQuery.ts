import { queryOptions } from "@tanstack/react-query";

import { readOpenRouterFreeModelCatalog } from "./openRouterModels";

export const openRouterFreeModelsQueryKey = ["openrouter", "free-models"] as const;

export function openRouterFreeModelsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: openRouterFreeModelsQueryKey,
    queryFn: () => readOpenRouterFreeModelCatalog(),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}
