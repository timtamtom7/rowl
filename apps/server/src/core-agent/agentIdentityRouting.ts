import type { CoreAgentMetadata, CoreAgentScope } from "@t3tools/contracts";

import type { CoreMemoryAgentContext } from "../memory/Services/CoreMemoryService.ts";
import type { CoreAgentService } from "./CoreAgentService.ts";

export type ActiveAgentTurnContext = {
  readonly scope: CoreAgentScope;
  readonly activeAgentId: string;
  readonly agent: CoreAgentMetadata;
  readonly memoryContext: CoreMemoryAgentContext;
};

export async function resolveActiveAgentForTurn(input: {
  readonly service: Pick<CoreAgentService, "resolveActiveAgent">;
  readonly projectRoot?: string | undefined;
}): Promise<ActiveAgentTurnContext> {
  const scope: CoreAgentScope = input.projectRoot
    ? { type: "project", projectRoot: input.projectRoot }
    : { type: "global" };
  const active = await input.service.resolveActiveAgent({ scope });
  return {
    scope,
    activeAgentId: active.activeAgentId,
    agent: active.agent,
    memoryContext: {
      agentId: active.activeAgentId,
      ...(input.projectRoot ? { projectRoot: input.projectRoot } : {}),
    },
  };
}

export function assembleAgentTurnMemoryPreamble(input: {
  readonly agent: CoreAgentMetadata;
  readonly memoryPreamble: string | null | undefined;
}): string {
  const personalityKind =
    input.agent.personality.kind === "preset"
      ? `preset:${input.agent.personality.presetId}`
      : "custom";
  const identity = [
    "## active-agent - selected Rowl agent",
    `Name: ${input.agent.name}`,
    `ID: ${input.agent.id}`,
    `Scope: ${input.agent.scope.type}`,
    `Personality: ${personalityKind}`,
    "",
    "## personality - active instructions",
    input.agent.personality.instructions.trim(),
  ].join("\n");
  const memory = input.memoryPreamble?.trim();
  return memory && memory.length > 0 ? `${identity}\n\n${memory}` : identity;
}

export function memoryUpdateCommitMessage(agentId: string): string {
  return `rowl: memory update for agent ${agentId}`;
}
