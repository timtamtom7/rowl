import type { CoreAgentMetadata, CoreAgentScope } from "@t3tools/contracts";

import type { CoreAgentService } from "./CoreAgentService.ts";
import {
  CORE_AGENT_PERSONALITY_PRESETS,
  getPersonalityPreset,
} from "./personalityPresets.ts";

export type CoreAgentSlashCommand =
  | { readonly kind: "agents" }
  | { readonly kind: "switch"; readonly target: string }
  | { readonly kind: "persona"; readonly value: string };

export type CoreAgentSlashCommandResult = {
  readonly handled: true;
  readonly response: string;
};

export function parseCoreAgentSlashCommand(text: string): CoreAgentSlashCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const match = /^\/([A-Za-z][A-Za-z0-9_-]*)(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (!match) return null;

  const command = (match[1] ?? "").toLowerCase();
  const rest = unquote((match[2] ?? "").trim());
  if (command === "agents" && rest.length === 0) {
    return { kind: "agents" };
  }
  if (command === "switch" && rest.length > 0) {
    return { kind: "switch", target: rest };
  }
  if (command === "persona" && rest.length > 0) {
    return { kind: "persona", value: rest };
  }
  return null;
}

export async function executeCoreAgentSlashCommand(input: {
  readonly service: Pick<
    CoreAgentService,
    "listAgents" | "resolveActiveAgent" | "setActiveAgent" | "updateAgent"
  >;
  readonly scope: CoreAgentScope;
  readonly text: string;
}): Promise<CoreAgentSlashCommandResult | null> {
  const command = parseCoreAgentSlashCommand(input.text);
  if (!command) return null;

  if (command.kind === "agents") {
    const active = await input.service.resolveActiveAgent({ scope: input.scope });
    const list = await input.service.listAgents({ scope: input.scope });
    return {
      handled: true,
      response: formatAgentList(list.agents, active.activeAgentId),
    };
  }

  if (command.kind === "switch") {
    const list = await input.service.listAgents({ scope: input.scope });
    const match = findAgentByNameOrId(list.agents, command.target);
    if (!match) {
      return {
        handled: true,
        response: `No agent matched "${command.target}". Run /agents to see available agents.`,
      };
    }
    const active = await input.service.setActiveAgent({
      scope: input.scope,
      agentId: match.id,
    });
    return {
      handled: true,
      response: `Switched active agent to ${active.agent.name} (${active.activeAgentId}).`,
    };
  }

  const active = await input.service.resolveActiveAgent({ scope: input.scope });
  const preset = findPreset(command.value);
  if (preset) {
    await input.service.updateAgent({
      scope: input.scope,
      agentId: active.activeAgentId,
      personality: {
        kind: "preset",
        presetId: preset.id,
        instructions: preset.defaultInstructions,
      },
    });
    return {
      handled: true,
      response: `Updated ${active.agent.name} personality to ${preset.id}.`,
    };
  }

  await input.service.updateAgent({
    scope: input.scope,
    agentId: active.activeAgentId,
    personality: {
      kind: "custom",
      instructions: command.value,
    },
  });
  return {
    handled: true,
    response: `Updated ${active.agent.name} personality.`,
  };
}

function unquote(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function formatAgentList(
  agents: ReadonlyArray<CoreAgentMetadata>,
  activeAgentId: string,
): string {
  const active = agents.find((agent) => agent.id === activeAgentId);
  const lines = [
    `Active agent: ${active ? `${active.name} (${active.id})` : activeAgentId}`,
    "",
    "Agents:",
  ];
  for (const agent of agents) {
    const marker = agent.id === activeAgentId ? "*" : "-";
    lines.push(`${marker} ${agent.name} (${agent.id})`);
  }
  return lines.join("\n");
}

function findAgentByNameOrId(
  agents: ReadonlyArray<CoreAgentMetadata>,
  target: string,
): CoreAgentMetadata | undefined {
  const normalized = target.trim().toLowerCase();
  return agents.find(
    (agent) => agent.id.toLowerCase() === normalized || agent.name.toLowerCase() === normalized,
  );
}

function findPreset(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    getPersonalityPreset(normalized) ??
    CORE_AGENT_PERSONALITY_PRESETS.find(
      (preset) => preset.displayName.toLowerCase() === normalized,
    )
  );
}
