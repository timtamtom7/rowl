import type { CoreAgentMetadata, NativeApi, ProjectId } from "@t3tools/contracts";

import { CORE_AGENT_PRESETS, scopeForProjectRoot } from "./useCoreAgents";

function inheritedAgentName(
  parent: CoreAgentMetadata | null,
  siblings: ReadonlyArray<CoreAgentMetadata>,
): string {
  const baseName = parent?.name?.trim() || "Rowl";
  const existingNames = new Set(siblings.map((agent) => agent.name.trim().toLowerCase()));
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${baseName} ${index}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return `${baseName} ${Date.now()}`;
}

function fallbackParent(scope: CoreAgentMetadata["scope"]): CoreAgentMetadata {
  const preset = CORE_AGENT_PRESETS[0]!;
  const now = new Date().toISOString();
  return {
    id: "default",
    name: preset.name,
    description: preset.description,
    scope,
    personality: {
      kind: "preset",
      presetId: preset.id,
      instructions: preset.instructions,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export async function createInheritedAgentForNewThread(input: {
  readonly api: Pick<NativeApi, "coreAgents">;
  readonly projectId: ProjectId;
  readonly projectRoot: string;
  readonly openNewThread: (projectId: ProjectId) => Promise<void>;
}): Promise<CoreAgentMetadata> {
  const scope = scopeForProjectRoot(input.projectRoot);
  const list = await input.api.coreAgents.list({ scope });
  const parent =
    list.agents.find((agent) => agent.id === list.activeAgentId) ??
    list.agents[0] ??
    fallbackParent(scope);
  const created = await input.api.coreAgents.create({
    scope,
    name: inheritedAgentName(parent, list.agents),
    description: parent.description,
    personality: parent.personality,
    defaultModel: parent.defaultModel,
    tags: parent.tags,
    pinned: parent.pinned,
  });
  await input.api.coreAgents.setActive({
    scope,
    agentId: created.agent.id,
  });
  await input.openNewThread(input.projectId);
  return created.agent;
}
