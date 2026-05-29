import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  CoreAgentCreateRequest,
  CoreAgentDeleteRequest,
  CoreAgentListResponse,
  CoreAgentMetadata,
  CoreAgentSetActiveRequest,
  CoreAgentUpdateRequest,
} from "./core-agent";

const decodeMetadata = Schema.decodeUnknownSync(CoreAgentMetadata);
const encodeMetadata = Schema.encodeSync(CoreAgentMetadata);
const decodeListResponse = Schema.decodeUnknownSync(CoreAgentListResponse);
const decodeCreateRequest = Schema.decodeUnknownSync(CoreAgentCreateRequest);
const decodeUpdateRequest = Schema.decodeUnknownSync(CoreAgentUpdateRequest);
const decodeDeleteRequest = Schema.decodeUnknownSync(CoreAgentDeleteRequest);
const decodeSetActiveRequest = Schema.decodeUnknownSync(CoreAgentSetActiveRequest);

const baseAgent = {
  id: "agent-1",
  name: "Rowl",
  scope: { type: "global" },
  personality: {
    kind: "preset",
    presetId: "rowl-default",
    instructions: "Be direct and maintain project memory.",
  },
  createdAt: "2026-05-29T12:00:00.000Z",
  updatedAt: "2026-05-29T12:00:00.000Z",
};

describe("CoreAgentMetadata", () => {
  it("round-trips global preset-backed agents", () => {
    const parsed = decodeMetadata({
      ...baseAgent,
      name: " Rowl ",
      tags: ["default", "coding"],
      pinned: true,
      defaultModel: {
        provider: "codex",
        model: "gpt-5.4",
        modelOptions: {
          codex: {
            reasoningEffort: "high",
            fastMode: true,
          },
        },
      },
    });

    expect(parsed.name).toBe("Rowl");
    expect(parsed.scope).toEqual({ type: "global" });
    expect(parsed.personality.kind).toBe("preset");
    expect(encodeMetadata(parsed)).toEqual(parsed);
  });

  it("round-trips project custom agents", () => {
    const parsed = decodeMetadata({
      ...baseAgent,
      id: "project-agent-1",
      name: "Reviewer",
      description: "Project-specific review agent",
      scope: {
        type: "project",
        projectRoot: " /Users/example/project ",
      },
      personality: {
        kind: "custom",
        instructions: "Focus on regressions and missing tests.",
      },
      pinned: false,
    });

    expect(parsed.scope).toEqual({
      type: "project",
      projectRoot: "/Users/example/project",
    });
    expect(parsed.personality.kind).toBe("custom");
    expect(encodeMetadata(parsed)).toEqual(parsed);
  });

  it("rejects invalid agent ids, names, and personalities", () => {
    expect(() => decodeMetadata({ ...baseAgent, id: "../agent" })).toThrow();
    expect(() => decodeMetadata({ ...baseAgent, name: "   " })).toThrow();
    expect(() =>
      decodeMetadata({
        ...baseAgent,
        personality: {
          kind: "preset",
          instructions: "Missing preset id.",
        },
      }),
    ).toThrow();
  });
});

describe("CoreAgent WebSocket payloads", () => {
  it("accepts list responses with an active agent", () => {
    const parsed = decodeListResponse({
      agents: [baseAgent],
      activeAgentId: "agent-1",
    });

    expect(parsed.agents).toHaveLength(1);
    expect(parsed.activeAgentId).toBe("agent-1");
  });

  it("accepts create, update, delete, and set-active requests", () => {
    expect(
      decodeCreateRequest({
        name: "Planner",
        scope: { type: "global" },
        personality: {
          kind: "preset",
          presetId: "planner",
          instructions: "Plan before editing.",
        },
      }),
    ).toMatchObject({ name: "Planner" });

    expect(
      decodeUpdateRequest({
        agentId: "agent-1",
        scope: { type: "global" },
        name: "Reviewer",
        personality: {
          kind: "custom",
          instructions: "Review only.",
        },
      }),
    ).toMatchObject({ agentId: "agent-1", name: "Reviewer" });

    expect(decodeDeleteRequest({ agentId: "agent-1", scope: { type: "global" } })).toMatchObject({
      agentId: "agent-1",
    });

    expect(decodeSetActiveRequest({ agentId: "agent-1", scope: { type: "global" } })).toMatchObject(
      {
        agentId: "agent-1",
      },
    );
  });

  it("rejects invalid active-agent requests", () => {
    expect(() =>
      decodeSetActiveRequest({
        agentId: "../agent",
        scope: { type: "global" },
      }),
    ).toThrow();
  });
});
