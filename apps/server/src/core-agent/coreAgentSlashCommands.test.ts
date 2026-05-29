import type { CoreAgentMetadata, CoreAgentScope } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import { createCoreAgentService, type CoreAgentStore } from "./CoreAgentService.ts";
import {
  executeCoreAgentSlashCommand,
  parseCoreAgentSlashCommand,
} from "./coreAgentSlashCommands.ts";

const now = "2026-05-29T12:00:00.000Z";
const scope: CoreAgentScope = { type: "global" };

function createStore(): CoreAgentStore {
  const agents = new Map<string, CoreAgentMetadata>();
  let activeAgentId: string | null = null;
  return {
    async listAgents() {
      return [...agents.values()];
    },
    async readAgent(_scope, agentId) {
      return agents.get(agentId) ?? null;
    },
    async writeAgent(metadata) {
      agents.set(metadata.id, metadata);
    },
    async deleteAgent(_scope, agentId) {
      agents.delete(agentId);
    },
    async readActiveAgentId() {
      return activeAgentId;
    },
    async writeActiveAgentId(_scope, agentId) {
      activeAgentId = agentId;
    },
  };
}

async function seededService() {
  let nextId = 0;
  const service = createCoreAgentService({
    store: createStore(),
    now: () => now,
    generateId: () => ["alpha", "beta"][nextId++] ?? `agent-${nextId}`,
  });
  await service.createAgent({
    name: "Alpha",
    scope,
    personality: { kind: "custom", instructions: "Alpha instructions." },
  });
  await service.createAgent({
    name: "Beta Agent",
    scope,
    personality: { kind: "custom", instructions: "Beta instructions." },
  });
  await service.setActiveAgent({ scope, agentId: "alpha" });
  return service;
}

describe("core agent slash command parsing", () => {
  it("parses /agents, /switch, and /persona", () => {
    expect(parseCoreAgentSlashCommand(" /agents ")).toEqual({ kind: "agents" });
    expect(parseCoreAgentSlashCommand("/switch beta")).toEqual({
      kind: "switch",
      target: "beta",
    });
    expect(parseCoreAgentSlashCommand('/switch "Beta Agent"')).toEqual({
      kind: "switch",
      target: "Beta Agent",
    });
    expect(parseCoreAgentSlashCommand("/persona reviewer")).toEqual({
      kind: "persona",
      value: "reviewer",
    });
    expect(parseCoreAgentSlashCommand("/persona Be terse.")).toEqual({
      kind: "persona",
      value: "Be terse.",
    });
  });

  it("ignores unrelated slash commands", () => {
    expect(parseCoreAgentSlashCommand("/remember use tabs")).toBeNull();
    expect(parseCoreAgentSlashCommand("hello")).toBeNull();
  });
});

describe("core agent slash command execution", () => {
  it("lists agents and marks the active one", async () => {
    const service = await seededService();

    const result = await executeCoreAgentSlashCommand({ service, scope, text: "/agents" });

    expect(result?.handled).toBe(true);
    expect(result?.response).toContain("Active agent: Alpha (alpha)");
    expect(result?.response).toContain("* Alpha (alpha)");
    expect(result?.response).toContain("- Beta Agent (beta)");
  });

  it("switches active agent by name or id", async () => {
    const service = await seededService();

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: '/switch "Beta Agent"',
    });

    expect(result?.response).toContain("Switched active agent to Beta Agent (beta).");
    expect((await service.resolveActiveAgent({ scope })).activeAgentId).toBe("beta");
  });

  it("updates the active agent personality from a preset", async () => {
    const service = await seededService();

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/persona reviewer",
    });

    const active = await service.resolveActiveAgent({ scope });
    expect(result?.response).toContain("Updated Alpha personality to reviewer.");
    expect(active.agent.personality).toMatchObject({
      kind: "preset",
      presetId: "reviewer",
    });
  });

  it("updates the active agent personality with custom instructions", async () => {
    const service = await seededService();

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/persona Always explain risk first.",
    });

    const active = await service.resolveActiveAgent({ scope });
    expect(result?.response).toContain("Updated Alpha personality.");
    expect(active.agent.personality).toEqual({
      kind: "custom",
      instructions: "Always explain risk first.",
    });
  });
});
