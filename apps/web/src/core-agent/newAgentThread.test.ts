import { describe, expect, it, vi } from "vitest";
import type { CoreAgentMetadata, CoreAgentScope, NativeApi, ProjectId } from "@t3tools/contracts";

import { createInheritedAgentForNewThread } from "./newAgentThread";

const NOW = "2026-05-29T12:00:00.000Z";

function scope(): CoreAgentScope {
  return { type: "project", projectRoot: "/repo/rowl" };
}

function agent(overrides: Partial<CoreAgentMetadata> = {}): CoreAgentMetadata {
  return {
    id: "agent-parent",
    name: "Planner",
    description: "Plans work",
    scope: scope(),
    personality: {
      kind: "preset",
      presetId: "planner",
      instructions: "Plan before editing.",
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("/new core-agent inheritance", () => {
  it("creates a project-scoped child agent, activates it, then opens the new thread", async () => {
    const projectId = "project-rowl" as ProjectId;
    const created = agent({ id: "agent-child", name: "Planner 2" });
    const calls: string[] = [];
    const api = {
      coreAgents: {
        list: vi.fn(async () => {
          calls.push("list");
          return { agents: [agent()], activeAgentId: "agent-parent" };
        }),
        create: vi.fn(async () => {
          calls.push("create");
          return { agent: created };
        }),
        setActive: vi.fn(async () => {
          calls.push("setActive");
          return { activeAgentId: created.id, agent: created };
        }),
      },
      orchestration: {
        dispatchCommand: vi.fn(async () => {
          calls.push("dispatchCommand");
          return {};
        }),
      },
    } as unknown as NativeApi;
    const openNewThread = vi.fn(async () => {
      calls.push("openNewThread");
    });

    await createInheritedAgentForNewThread({
      api,
      projectId,
      projectRoot: "/repo/rowl",
      openNewThread,
    });

    expect(api.coreAgents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: scope(),
        name: "Planner 2",
        description: "Plans work",
        personality: agent().personality,
      }),
    );
    expect(api.coreAgents.setActive).toHaveBeenCalledWith({
      scope: scope(),
      agentId: "agent-child",
    });
    expect(openNewThread).toHaveBeenCalledWith(projectId);
    expect(api.orchestration.dispatchCommand).not.toHaveBeenCalled();
    expect(calls).toEqual(["list", "create", "setActive", "openNewThread"]);
  });
});
