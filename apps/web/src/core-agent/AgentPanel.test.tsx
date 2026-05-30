import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CoreAgentMetadata, CoreAgentScope, NativeApi } from "@t3tools/contracts";

import { AgentPanel } from "./AgentPanel";
import { createCoreAgentActions } from "./useCoreAgents";

const NOW = "2026-05-29T12:00:00.000Z";

function projectScope(): CoreAgentScope {
  return { type: "project", projectRoot: "/repo/rowl" };
}

function agent(overrides: Partial<CoreAgentMetadata> = {}): CoreAgentMetadata {
  return {
    id: "agent-reviewer",
    name: "Reviewer",
    description: "Careful review agent",
    scope: projectScope(),
    personality: {
      kind: "preset",
      presetId: "reviewer",
      instructions: "Review code carefully.",
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("AgentPanel", () => {
  it("renders the active agent and available project agents", () => {
    const html = renderToStaticMarkup(
      <AgentPanel
        controller={{
          agents: [
            agent(),
            agent({
              id: "agent-implementer",
              name: "Implementer",
              description: "Ships focused changes",
              personality: {
                kind: "preset",
                presetId: "implementer",
                instructions: "Implement focused changes.",
              },
            }),
          ],
          activeAgentId: "agent-reviewer",
          activeAgent: agent(),
          isLoading: false,
          error: null,
          refresh: vi.fn(),
          setActiveAgent: vi.fn(),
          createFromPreset: vi.fn(),
        }}
      />,
    );

    expect(html).toContain("Agents");
    expect(html).toContain("Active");
    expect(html).toContain("Reviewer");
    expect(html).toContain("Implementer");
    expect(html).toContain("Create from preset");
  });

  it("renders the read-only memory tab with note detail", () => {
    const html = renderToStaticMarkup(
      <AgentPanel
        defaultTab="memory"
        controller={{
          agents: [agent()],
          activeAgentId: "agent-reviewer",
          activeAgent: agent(),
          isLoading: false,
          error: null,
          refresh: vi.fn(),
          setActiveAgent: vi.fn(),
          createFromPreset: vi.fn(),
        }}
        memoryController={{
          notes: [
            {
              filename: "api-contracts",
              title: "API contracts",
              tags: ["api"],
              created: NOW,
              updated: NOW,
            },
          ],
          selectedFilename: "api-contracts",
          selectedNote: {
            filename: "api-contracts",
            title: "API contracts",
            tags: ["api"],
            created: NOW,
            updated: NOW,
            content: "# API contracts\n\nKeep shared schemas in contracts.",
          },
          isLoading: false,
          isReading: false,
          error: null,
          refresh: vi.fn(),
          selectNote: vi.fn(),
        }}
      />,
    );

    expect(html).toContain("Memory");
    expect(html).toContain("API contracts");
    expect(html).toContain("Keep shared schemas");
  });

  it("uses core-agent WebSocket API calls for list, switch, and preset creation", async () => {
    const scope = projectScope();
    const created = agent({ id: "agent-created", name: "Planner" });
    const api = {
      coreAgents: {
        list: vi.fn(async () => ({ agents: [agent()], activeAgentId: "agent-reviewer" })),
        create: vi.fn(async () => ({ agent: created })),
        setActive: vi.fn(async () => ({ activeAgentId: created.id, agent: created })),
      },
    } as unknown as NativeApi;

    const actions = createCoreAgentActions({ api, scope });
    await expect(actions.load()).resolves.toEqual({
      agents: [agent()],
      activeAgentId: "agent-reviewer",
    });

    await actions.setActiveAgent("agent-created");
    await actions.createFromPreset("planner");

    expect(api.coreAgents.list).toHaveBeenCalledWith({ scope });
    expect(api.coreAgents.setActive).toHaveBeenCalledWith({
      scope,
      agentId: "agent-created",
    });
    expect(api.coreAgents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scope,
        name: "Planner",
        personality: expect.objectContaining({
          kind: "preset",
          presetId: "planner",
        }),
      }),
    );
  });
});
