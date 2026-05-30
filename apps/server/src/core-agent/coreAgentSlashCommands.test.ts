import type { CoreAgentMetadata, CoreAgentScope } from "@t3tools/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createCoreAgentService, type CoreAgentStore } from "./CoreAgentService.ts";
import {
  executeCoreAgentSlashCommand,
  parseCoreAgentSlashCommand,
} from "./coreAgentSlashCommands.ts";
import type { MemoryPalaceServiceShape } from "./MemoryPalaceService.ts";

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
  it("parses /agents, /switch, /persona, /init, /doctor, /compact, and /reflect", () => {
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
    expect(parseCoreAgentSlashCommand("/init")).toEqual({ kind: "init" });
    expect(parseCoreAgentSlashCommand("/doctor")).toEqual({ kind: "doctor" });
    expect(parseCoreAgentSlashCommand("/compact")).toEqual({ kind: "compact" });
    expect(parseCoreAgentSlashCommand("/reflect")).toEqual({ kind: "reflect" });
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

  it("compacts current conversation into a memory note", async () => {
    const service = await seededService();
    const writes: Parameters<MemoryPalaceServiceShape["write"]>[0][] = [];
    const memory: Pick<MemoryPalaceServiceShape, "list" | "read" | "write"> = {
      list: () => Effect.succeed({ notes: [] }),
      read: () => Effect.die("compact should not read memory"),
      write: (request) => {
        writes.push(request);
        return Effect.succeed({
          filename: request.filename,
          title: request.title,
          tags: [...(request.tags ?? [])],
          created: now,
          updated: now,
          content: request.content,
        });
      },
    };

    const result = await executeCoreAgentSlashCommand({
      service,
      memory,
      scope,
      text: "/compact",
      now: () => "2026-05-29T12:30:45.000Z",
      conversationMessages: [
        { role: "user", text: "Build a settings panel for model selection." },
        {
          role: "assistant",
          text: "I implemented SettingsPanel.tsx and verified the focused tests.",
        },
        { role: "user", text: "/compact" },
      ],
    });

    expect(result?.response).toBe(
      "Compacted conversation into memory note: conversation-summary-20260529123045",
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      scope,
      agentId: "alpha",
      filename: "conversation-summary-20260529123045",
      title: "Conversation summary",
      tags: ["compacted", "conversation-summary"],
    });
    expect(writes[0]?.content).toContain("Build a settings panel");
    expect(writes[0]?.content).toContain("implemented SettingsPanel.tsx");
    expect(writes[0]?.content).toContain("Messages summarized: 2");
  });

  it("reflects over memory notes without modifying memory", async () => {
    const service = await seededService();
    const readFilenames: string[] = [];
    let writeCalled = false;
    const memory: Pick<MemoryPalaceServiceShape, "list" | "read" | "write"> = {
      list: () =>
        Effect.succeed({
          notes: [
            {
              filename: "project-overview",
              title: "Project overview",
              tags: ["init", "overview"],
              created: now,
              updated: now,
            },
            {
              filename: "conversation-summary-20260529123045",
              title: "Conversation summary",
              tags: ["compacted", "conversation-summary"],
              created: now,
              updated: now,
            },
          ],
        }),
      read: (request) => {
        readFilenames.push(request.filename);
        return Effect.succeed({
          filename: request.filename,
          title:
            request.filename === "project-overview" ? "Project overview" : "Conversation summary",
          tags:
            request.filename === "project-overview"
              ? ["init", "overview"]
              : ["compacted", "conversation-summary"],
          created: now,
          updated: now,
          content:
            request.filename === "project-overview"
              ? "# Project overview\n\nUse Effect services for server dependencies."
              : "# Conversation summary\n\nImplemented settings panel and verified tests.",
        });
      },
      write: () => {
        writeCalled = true;
        return Effect.die("reflect should not write memory");
      },
    };

    const result = await executeCoreAgentSlashCommand({
      service,
      memory,
      scope,
      text: "/reflect",
    });

    expect(readFilenames).toEqual(["project-overview", "conversation-summary-20260529123045"]);
    expect(writeCalled).toBe(false);
    expect(result?.response).toContain("Memory reflection for Alpha (alpha)");
    expect(result?.response).toContain("Patterns:");
    expect(result?.response).toContain("Most common tags:");
    expect(result?.response).toContain("compacted conversation summary");
    expect(result?.response).toContain("Gaps:");
    expect(result?.response).toContain("Contradictions:");
    expect(result?.response).toContain("Suggestions:");
  });
});
