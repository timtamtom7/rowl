import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CoreAgentCreateRequest,
  CoreAgentListResponse,
  CoreAgentMetadata,
  CoreAgentScope,
  NativeApi,
} from "@t3tools/contracts";

import { readNativeApi } from "~/nativeApi";

export type CoreAgentPresetId = "default" | "concise" | "planner" | "reviewer" | "implementer";

export type CoreAgentPresetOption = {
  readonly id: CoreAgentPresetId;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
};

export const CORE_AGENT_PRESETS: ReadonlyArray<CoreAgentPresetOption> = [
  {
    id: "default",
    name: "Rowl",
    description: "Balanced coding agent",
    instructions: "Be direct, pragmatic, and careful. Prefer verified changes over guesses.",
  },
  {
    id: "concise",
    name: "Concise",
    description: "Short, high-signal responses",
    instructions: "Keep responses brief and focus on concrete next steps.",
  },
  {
    id: "planner",
    name: "Planner",
    description: "Decomposes work before editing",
    instructions: "Clarify scope, sequence work carefully, and keep implementation steps explicit.",
  },
  {
    id: "reviewer",
    name: "Reviewer",
    description: "Finds bugs and missing verification",
    instructions: "Prioritize correctness, regressions, edge cases, and missing tests.",
  },
  {
    id: "implementer",
    name: "Implementer",
    description: "Ships focused code changes",
    instructions: "Make scoped edits, follow local patterns, and verify behavior with tests.",
  },
];

export type CoreAgentController = {
  readonly agents: ReadonlyArray<CoreAgentMetadata>;
  readonly activeAgentId: string | null;
  readonly activeAgent: CoreAgentMetadata | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly setActiveAgent: (agentId: string) => Promise<void>;
  readonly createFromPreset: (presetId: CoreAgentPresetId) => Promise<CoreAgentMetadata>;
};

export type CoreAgentActions = {
  readonly load: () => Promise<CoreAgentListResponse>;
  readonly setActiveAgent: (agentId: string) => Promise<CoreAgentMetadata>;
  readonly createFromPreset: (presetId: CoreAgentPresetId) => Promise<CoreAgentMetadata>;
};

export function scopeForProjectRoot(projectRoot?: string | null): CoreAgentScope {
  const trimmed = projectRoot?.trim();
  return trimmed ? { type: "project", projectRoot: trimmed } : { type: "global" };
}

export function createCoreAgentActions(input: {
  readonly api: Pick<NativeApi, "coreAgents">;
  readonly scope: CoreAgentScope;
}): CoreAgentActions {
  return {
    load: () => input.api.coreAgents.list({ scope: input.scope }),
    async setActiveAgent(agentId) {
      const result = await input.api.coreAgents.setActive({ scope: input.scope, agentId });
      return result.agent;
    },
    async createFromPreset(presetId) {
      const preset = CORE_AGENT_PRESETS.find((candidate) => candidate.id === presetId);
      if (!preset) {
        throw new Error(`Unknown core agent preset: ${presetId}`);
      }

      const request: CoreAgentCreateRequest = {
        scope: input.scope,
        name: preset.name,
        description: preset.description,
        personality: {
          kind: "preset",
          presetId,
          instructions: preset.instructions,
        },
      };
      const result = await input.api.coreAgents.create(request);
      return result.agent;
    },
  };
}

export function useCoreAgents(input?: {
  readonly projectRoot?: string | null | undefined;
  readonly api?: NativeApi | undefined;
}): CoreAgentController {
  const api = input?.api ?? readNativeApi();
  const scope = useMemo(() => scopeForProjectRoot(input?.projectRoot), [input?.projectRoot]);
  const actions = useMemo(
    () => (api ? createCoreAgentActions({ api, scope }) : null),
    [api, scope],
  );
  const [agents, setAgents] = useState<ReadonlyArray<CoreAgentMetadata>>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!actions) {
      setAgents([]);
      setActiveAgentId(null);
      setIsLoading(false);
      setError("Native API is unavailable.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await actions.load();
      setAgents(result.agents);
      setActiveAgentId(result.activeAgentId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load agents.");
    } finally {
      setIsLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveAgent = useCallback(
    async (agentId: string) => {
      if (!actions) return;
      setError(null);
      try {
        const agent = await actions.setActiveAgent(agentId);
        setActiveAgentId(agent.id);
        setAgents((current) => current.map((item) => (item.id === agent.id ? agent : item)));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not switch agents.");
      }
    },
    [actions],
  );

  const createFromPreset = useCallback(
    async (presetId: CoreAgentPresetId) => {
      if (!actions) {
        throw new Error("Native API is unavailable.");
      }
      setError(null);
      try {
        const agent = await actions.createFromPreset(presetId);
        setAgents((current) => [...current.filter((item) => item.id !== agent.id), agent]);
        return agent;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not create agent.";
        setError(message);
        throw new Error(message, { cause: caught });
      }
    },
    [actions],
  );

  const activeAgent = agents.find((agent) => agent.id === activeAgentId) ?? null;

  return {
    agents,
    activeAgentId,
    activeAgent,
    isLoading,
    error,
    refresh,
    setActiveAgent,
    createFromPreset,
  };
}
