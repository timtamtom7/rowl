import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  CoreAgentCreateRequest,
  CoreAgentDeleteRequest,
  CoreAgentListResponse,
  CoreAgentMetadata,
  CoreAgentSetActiveRequest,
  CoreAgentUpdateRequest,
  MemoryChangedEvent,
  MemoryNote,
  MemoryNoteListRequest,
  MemoryNoteListResponse,
  MemoryNoteReadRequest,
  MemoryNoteWriteRequest,
} from "./core-agent";

const decodeMetadata = Schema.decodeUnknownSync(CoreAgentMetadata);
const encodeMetadata = Schema.encodeSync(CoreAgentMetadata);
const decodeListResponse = Schema.decodeUnknownSync(CoreAgentListResponse);
const decodeCreateRequest = Schema.decodeUnknownSync(CoreAgentCreateRequest);
const decodeUpdateRequest = Schema.decodeUnknownSync(CoreAgentUpdateRequest);
const decodeDeleteRequest = Schema.decodeUnknownSync(CoreAgentDeleteRequest);
const decodeSetActiveRequest = Schema.decodeUnknownSync(CoreAgentSetActiveRequest);
const decodeMemoryNote = Schema.decodeUnknownSync(MemoryNote);
const decodeMemoryNoteListRequest = Schema.decodeUnknownSync(MemoryNoteListRequest);
const decodeMemoryNoteReadRequest = Schema.decodeUnknownSync(MemoryNoteReadRequest);
const decodeMemoryNoteWriteRequest = Schema.decodeUnknownSync(MemoryNoteWriteRequest);
const decodeMemoryNoteListResponse = Schema.decodeUnknownSync(MemoryNoteListResponse);
const decodeMemoryChangedEvent = Schema.decodeUnknownSync(MemoryChangedEvent);

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

  it("accepts built-in preset-backed metadata materialized by the server", () => {
    const parsed = decodeMetadata({
      ...baseAgent,
      id: "reviewer-1",
      name: "Reviewer",
      description: "Find regressions before code is shipped.",
      personality: {
        kind: "preset",
        presetId: "reviewer",
        instructions: "Review behavior, tests, and operational risk.",
      },
    });

    expect(parsed.personality).toEqual({
      kind: "preset",
      presetId: "reviewer",
      instructions: "Review behavior, tests, and operational risk.",
    });
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

describe("Memory note contracts", () => {
  it("accepts read-only memory note payloads", () => {
    const note = decodeMemoryNote({
      filename: "api-contracts",
      title: "API contracts",
      tags: ["api", "contracts"],
      created: "2026-05-29T12:00:00.000Z",
      updated: "2026-05-29T12:10:00.000Z",
      content: "# API contracts\n\nKeep schemas shared.",
    });

    expect(note.filename).toBe("api-contracts");
    expect(
      decodeMemoryNoteListResponse({
        notes: [
          {
            filename: note.filename,
            title: note.title,
            tags: note.tags,
            created: note.created,
            updated: note.updated,
          },
        ],
      }),
    ).toMatchObject({
      notes: [{ filename: "api-contracts", title: "API contracts" }],
    });
  });

  it("accepts memory note requests and change events", () => {
    expect(
      decodeMemoryNoteListRequest({
        scope: { type: "global" },
        agentId: "agent-1",
      }),
    ).toMatchObject({ agentId: "agent-1" });

    expect(
      decodeMemoryNoteReadRequest({
        scope: { type: "project", projectRoot: "/repo" },
        agentId: "agent-project",
        filename: "architecture",
      }),
    ).toMatchObject({ filename: "architecture" });

    expect(
      decodeMemoryNoteWriteRequest({
        scope: { type: "global" },
        agentId: "agent-1",
        filename: "review-style",
        title: "Review style",
        tags: ["review"],
        content: "# Review style",
      }),
    ).toMatchObject({ title: "Review style" });

    expect(
      decodeMemoryChangedEvent({
        scope: { type: "global" },
        agentId: "agent-1",
        filename: "review-style",
        operation: "updated",
      }),
    ).toMatchObject({ operation: "updated" });
  });

  it("rejects unsafe memory note filenames", () => {
    expect(() =>
      decodeMemoryNoteReadRequest({
        scope: { type: "global" },
        agentId: "agent-1",
        filename: "../secrets",
      }),
    ).toThrow();
  });
});
