import type { CoreAgentMetadata, CoreAgentScope } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  CoreAgentServiceError,
  createCoreAgentService,
  type CoreAgentStore,
} from "./CoreAgentService.ts";

const NOW = "2026-05-29T12:00:00.000Z";

function globalScope(): CoreAgentScope {
  return { type: "global" };
}

function projectScope(projectRoot = "/tmp/project"): CoreAgentScope {
  return { type: "project", projectRoot };
}

function agent(overrides: Partial<CoreAgentMetadata> = {}): CoreAgentMetadata {
  return {
    id: "agent-1",
    name: "Agent One",
    scope: globalScope(),
    personality: {
      kind: "preset",
      presetId: "default",
      instructions: "Default instructions.",
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function scopeKey(scope: CoreAgentScope): string {
  return scope.type === "global" ? "global" : `project:${scope.projectRoot}`;
}

function cloneAgent(metadata: CoreAgentMetadata): CoreAgentMetadata {
  return structuredClone(metadata) as CoreAgentMetadata;
}

function createMemoryStore(initialAgents: ReadonlyArray<CoreAgentMetadata> = []): CoreAgentStore & {
  readonly agents: Map<string, CoreAgentMetadata>;
  readonly active: Map<string, string>;
} {
  const agents = new Map<string, CoreAgentMetadata>();
  const active = new Map<string, string>();

  for (const metadata of initialAgents) {
    agents.set(`${scopeKey(metadata.scope)}:${metadata.id}`, cloneAgent(metadata));
  }

  return {
    agents,
    active,
    async listAgents(scope) {
      return [...agents.values()]
        .filter((metadata) => scopeKey(metadata.scope) === scopeKey(scope))
        .map(cloneAgent);
    },
    async readAgent(scope, agentId) {
      const metadata = agents.get(`${scopeKey(scope)}:${agentId}`);
      return metadata ? cloneAgent(metadata) : null;
    },
    async writeAgent(metadata) {
      agents.set(`${scopeKey(metadata.scope)}:${metadata.id}`, cloneAgent(metadata));
    },
    async deleteAgent(scope, agentId) {
      agents.delete(`${scopeKey(scope)}:${agentId}`);
    },
    async readActiveAgentId(scope) {
      return active.get(scopeKey(scope)) ?? null;
    },
    async writeActiveAgentId(scope, agentId) {
      active.set(scopeKey(scope), agentId);
    },
  };
}

function serviceWithStore(store: CoreAgentStore, ids: ReadonlyArray<string> = ["agent-new"]) {
  let index = 0;
  return createCoreAgentService({
    store,
    now: () => NOW,
    generateId: () => ids[index++] ?? `agent-${index}`,
  });
}

describe("CoreAgentService", () => {
  it("lists agents by scope with the active agent id", async () => {
    const globalAgent = agent({ id: "global-agent", name: "Global", scope: globalScope() });
    const projectAgent = agent({
      id: "project-agent",
      name: "Project",
      scope: projectScope(),
    });
    const store = createMemoryStore([globalAgent, projectAgent]);
    store.active.set(scopeKey(globalScope()), "global-agent");
    const service = serviceWithStore(store);

    await expect(service.listAgents({ scope: globalScope() })).resolves.toEqual({
      agents: [globalAgent],
      activeAgentId: "global-agent",
    });
  });

  it("creates an editable agent from a preset", async () => {
    const store = createMemoryStore();
    const service = serviceWithStore(store, ["planner-1"]);

    const result = await service.createAgentFromPreset({
      presetId: "planner",
      scope: globalScope(),
    });

    expect(result.agent).toMatchObject({
      id: "planner-1",
      name: "Planner",
      scope: globalScope(),
      personality: {
        kind: "preset",
        presetId: "planner",
      },
      createdAt: NOW,
      updatedAt: NOW,
    });

    const stored = await store.readAgent(globalScope(), "planner-1");
    expect(stored).toEqual(result.agent);
  });

  it("creates a custom agent", async () => {
    const store = createMemoryStore();
    const service = serviceWithStore(store, ["custom-1"]);

    const result = await service.createAgent({
      name: "Incident Lead",
      description: "Handles production incidents",
      scope: globalScope(),
      personality: {
        kind: "custom",
        instructions: "Prioritize mitigation, diagnosis, and concise status updates.",
      },
      tags: ["ops"],
    });

    expect(result.agent).toMatchObject({
      id: "custom-1",
      name: "Incident Lead",
      description: "Handles production incidents",
      personality: {
        kind: "custom",
        instructions: "Prioritize mitigation, diagnosis, and concise status updates.",
      },
      tags: ["ops"],
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("updates name, personality, and instructions without changing immutable fields", async () => {
    const existing = agent({ id: "reviewer-1", name: "Reviewer" });
    const store = createMemoryStore([existing]);
    const service = serviceWithStore(store);

    const result = await service.updateAgent({
      agentId: "reviewer-1",
      scope: globalScope(),
      name: "Review Lead",
      personality: {
        kind: "custom",
        instructions: "Review behavior, test coverage, and release risk.",
      },
    });

    expect(result.agent).toMatchObject({
      id: "reviewer-1",
      name: "Review Lead",
      personality: {
        kind: "custom",
        instructions: "Review behavior, test coverage, and release risk.",
      },
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("deletes inactive agents", async () => {
    const inactive = agent({ id: "inactive" });
    const store = createMemoryStore([inactive]);
    const service = serviceWithStore(store);

    await expect(
      service.deleteAgent({ scope: globalScope(), agentId: "inactive" }),
    ).resolves.toEqual({});

    await expect(store.readAgent(globalScope(), "inactive")).resolves.toBeNull();
  });

  it("rejects deleting the active agent without a replacement", async () => {
    const active = agent({ id: "active" });
    const store = createMemoryStore([active]);
    store.active.set(scopeKey(globalScope()), "active");
    const service = serviceWithStore(store);

    await expect(service.deleteAgent({ scope: globalScope(), agentId: "active" })).rejects.toThrow(
      CoreAgentServiceError,
    );
  });

  it("sets active global and project agents with stable event payloads", async () => {
    const globalAgent = agent({ id: "global-agent", scope: globalScope() });
    const project = projectScope();
    const projectAgent = agent({ id: "project-agent", scope: project });
    const store = createMemoryStore([globalAgent, projectAgent]);
    const service = serviceWithStore(store);

    await expect(
      service.setActiveAgent({ scope: globalScope(), agentId: "global-agent" }),
    ).resolves.toEqual({
      activeAgentId: "global-agent",
      agent: globalAgent,
      event: {
        scope: globalScope(),
        activeAgentId: "global-agent",
        agent: globalAgent,
      },
    });

    await expect(
      service.setActiveAgent({ scope: project, agentId: "project-agent" }),
    ).resolves.toEqual({
      activeAgentId: "project-agent",
      agent: projectAgent,
      event: {
        scope: project,
        activeAgentId: "project-agent",
        agent: projectAgent,
      },
    });
  });

  it("falls back to a default agent when a scope has no active agent", async () => {
    const store = createMemoryStore();
    const service = serviceWithStore(store, ["ignored-id"]);

    const result = await service.resolveActiveAgent({ scope: projectScope() });

    expect(result.agent).toMatchObject({
      id: "default",
      name: "Default",
      scope: projectScope(),
      personality: {
        kind: "preset",
        presetId: "default",
      },
    });
    await expect(store.readAgent(projectScope(), "default")).resolves.toEqual(result.agent);
    await expect(store.readActiveAgentId(projectScope())).resolves.toBe("default");
  });

  it("serializes concurrent updates to the same agent id", async () => {
    const store = createMemoryStore([agent({ id: "agent-1", tags: ["initial"] })]);
    const service = serviceWithStore(store);

    await Promise.all([
      service.updateAgent({
        scope: globalScope(),
        agentId: "agent-1",
        name: "Updated Name",
      }),
      service.updateAgent({
        scope: globalScope(),
        agentId: "agent-1",
        tags: ["initial", "review"],
      }),
    ]);

    await expect(store.readAgent(globalScope(), "agent-1")).resolves.toMatchObject({
      id: "agent-1",
      name: "Updated Name",
      tags: ["initial", "review"],
    });
  });
});
