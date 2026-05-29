import type { CoreAgentMetadata } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vitest";

import type { CoreAgentService } from "./CoreAgentService.ts";
import {
  assembleAgentTurnMemoryPreamble,
  memoryUpdateCommitMessage,
  resolveActiveAgentForTurn,
} from "./agentIdentityRouting.ts";

const now = "2026-05-29T12:00:00.000Z";

function agent(input?: Partial<CoreAgentMetadata>): CoreAgentMetadata {
  return {
    id: "agent-alpha",
    name: "Alpha",
    scope: { type: "project", projectRoot: "/repo" },
    personality: {
      kind: "custom",
      instructions: "Prefer direct implementation after reading the code.",
    },
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

describe("agent identity routing", () => {
  it("resolves the active project agent for provider turn memory context", async () => {
    const resolveActiveAgent = vi.fn<CoreAgentService["resolveActiveAgent"]>(async (request) => ({
      activeAgentId: "agent-alpha",
      agent: agent({ scope: request.scope }),
    }));
    const service = { resolveActiveAgent } as Pick<CoreAgentService, "resolveActiveAgent">;

    const context = await resolveActiveAgentForTurn({
      service,
      projectRoot: "/repo",
    });

    expect(resolveActiveAgent).toHaveBeenCalledWith({
      scope: { type: "project", projectRoot: "/repo" },
    });
    expect(context.activeAgentId).toBe("agent-alpha");
    expect(context.memoryContext).toEqual({ agentId: "agent-alpha", projectRoot: "/repo" });
  });

  it("resolves the active global agent when no project root is available", async () => {
    const resolveActiveAgent = vi.fn<CoreAgentService["resolveActiveAgent"]>(async (request) => ({
      activeAgentId: "default",
      agent: agent({
        id: "default",
        name: "Default",
        scope: request.scope,
      }),
    }));
    const service = { resolveActiveAgent } as Pick<CoreAgentService, "resolveActiveAgent">;

    const context = await resolveActiveAgentForTurn({ service });

    expect(resolveActiveAgent).toHaveBeenCalledWith({ scope: { type: "global" } });
    expect(context.memoryContext).toEqual({ agentId: "default" });
  });

  it("adds active agent identity and personality without filesystem metadata paths", () => {
    const preamble = assembleAgentTurnMemoryPreamble({
      agent: agent(),
      memoryPreamble: "## persona - stored memory\nRemember TypeScript strictness.",
    });

    expect(preamble).toContain("## active-agent - selected Rowl agent");
    expect(preamble).toContain("Name: Alpha");
    expect(preamble).toContain("ID: agent-alpha");
    expect(preamble).toContain("Scope: project");
    expect(preamble).toContain("Prefer direct implementation");
    expect(preamble).toContain("Remember TypeScript strictness.");
    expect(preamble).not.toContain("/repo");
    expect(preamble).not.toContain("metadata.json");
  });

  it("includes the active agent id in memory update commit messages", () => {
    expect(memoryUpdateCommitMessage("agent-alpha")).toBe(
      "rowl: memory update for agent agent-alpha",
    );
  });
});
