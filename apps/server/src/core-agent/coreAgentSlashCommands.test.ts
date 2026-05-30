import {
  ApprovalGateId,
  GoalDocumentId,
  GoalId,
  ProjectId,
  type ApprovalGate,
  type CoreAgentMetadata,
  type CoreAgentScope,
  type Goal,
  type GoalDocument,
} from "@t3tools/contracts";
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
const projectId = ProjectId.makeUnsafe("project-1");
const goalId = GoalId.makeUnsafe("goal-1");
const childGoalId = GoalId.makeUnsafe("goal-2");
const documentId = GoalDocumentId.makeUnsafe("doc-1");
const approvalId = ApprovalGateId.makeUnsafe("gate-1");

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

function createGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: goalId,
    projectId,
    text: "Ship organizing layer",
    isMain: false,
    linkedThreadIds: [],
    status: "planned",
    level: "team",
    createdAt: now,
    ...overrides,
  };
}

function createDocument(overrides: Partial<GoalDocument> = {}): GoalDocument {
  return {
    id: documentId,
    goalId,
    title: "Research notes",
    content: "# Research\n\nUse the organizing service layer.",
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createApproval(overrides: Partial<ApprovalGate> = {}): ApprovalGate {
  return {
    id: approvalId,
    goalId,
    status: "pending",
    requestedBy: "rowl",
    createdAt: now,
    ...overrides,
  };
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

  it("parses organizing slash commands", () => {
    expect(parseCoreAgentSlashCommand("/goals")).toEqual({ kind: "goalsList" });
    expect(
      parseCoreAgentSlashCommand(
        '/goals create "Ship organizing layer" --parent parent-1 --level team --agent alpha',
      ),
    ).toEqual({
      kind: "goalsCreate",
      text: "Ship organizing layer",
      parentId: GoalId.makeUnsafe("parent-1"),
      level: "team",
      ownerAgentId: "alpha",
    });
    expect(parseCoreAgentSlashCommand("/goals update goal-1 --status active")).toEqual({
      kind: "goalsUpdateStatus",
      goalId,
      status: "active",
    });
    expect(parseCoreAgentSlashCommand("/doc goal-1")).toEqual({
      kind: "documentsList",
      goalId,
    });
    expect(parseCoreAgentSlashCommand("/doc create goal-1 Research notes\n# Draft")).toEqual({
      kind: "documentsCreate",
      goalId,
      title: "Research notes",
      content: "# Draft",
    });
    expect(parseCoreAgentSlashCommand("/doc read goal-1 doc-1")).toEqual({
      kind: "documentsRead",
      goalId,
      documentId,
    });
    expect(parseCoreAgentSlashCommand("/approve goal-1")).toEqual({
      kind: "approvalsShow",
      goalId,
    });
    expect(parseCoreAgentSlashCommand("/approve create goal-1 Ready for review")).toEqual({
      kind: "approvalsCreate",
      goalId,
      reason: "Ready for review",
    });
    expect(parseCoreAgentSlashCommand("/approve approve goal-1 gate-1 Looks good")).toEqual({
      kind: "approvalsApprove",
      goalId,
      approvalId,
      reason: "Looks good",
    });
    expect(parseCoreAgentSlashCommand("/approve reject goal-1 gate-1 Missing tests")).toEqual({
      kind: "approvalsReject",
      goalId,
      approvalId,
      reason: "Missing tests",
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

  it("lists project goals as an indented hierarchy", async () => {
    const service = await seededService();
    const parent = createGoal();
    const child = createGoal({
      id: childGoalId,
      text: "Write slash commands",
      parentId: goalId,
      status: "active",
      level: "task",
      createdAt: "2026-05-29T12:01:00.000Z",
    });

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/goals",
      organizing: {
        projectId,
        goals: {
          listGoalsByProject: () => Effect.succeed({ goals: [child, parent] }),
          createGoal: () => Effect.die("unused"),
          getGoal: () => Effect.die("unused"),
          updateGoal: () => Effect.die("unused"),
        },
      },
    });

    expect(result?.response).toContain("Goals:");
    expect(result?.response).toContain("- ○ [planned] [team] Ship organizing layer (goal-1)");
    expect(result?.response).toContain("  - ▶ [active] [task] Write slash commands (goal-2)");
  });

  it("creates a project goal", async () => {
    const service = await seededService();
    const calls: unknown[] = [];

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/goals create Ship organizing slash commands --parent goal-parent --level agent --agent alpha",
      organizing: {
        projectId,
        goals: {
          listGoalsByProject: () => Effect.die("unused"),
          createGoal: (input) => {
            calls.push(input);
            return Effect.succeed({
              goal: createGoal({
                id: goalId,
                projectId: input.projectId,
                text: input.text,
                isMain: input.isMain,
                status: input.status ?? "planned",
                level: input.level ?? "task",
                linkedThreadIds: [],
                ...(input.parentId ? { parentId: input.parentId } : {}),
                ...(input.ownerAgentId ? { ownerAgentId: input.ownerAgentId } : {}),
                ...(input.description ? { description: input.description } : {}),
                createdAt: now,
              }),
            });
          },
          getGoal: () => Effect.die("unused"),
          updateGoal: () => Effect.die("unused"),
        },
      },
    });

    expect(calls[0]).toMatchObject({
      projectId,
      text: "Ship organizing slash commands",
      isMain: false,
      status: "planned",
      parentId: GoalId.makeUnsafe("goal-parent"),
      level: "agent",
      ownerAgentId: "alpha",
    });
    expect(result?.response).toContain("Created goal:");
    expect(result?.response).toContain("ID: goal-1");
  });

  it("updates a goal status through the allowed lifecycle", async () => {
    const service = await seededService();
    const updates: unknown[] = [];

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/goals update goal-1 --status active",
      organizing: {
        goals: {
          listGoalsByProject: () => Effect.die("unused"),
          createGoal: () => Effect.die("unused"),
          getGoal: () => Effect.succeed({ goal: createGoal({ status: "planned" }) }),
          updateGoal: (input) => {
            updates.push(input);
            return Effect.succeed({ goal: createGoal({ status: input.status ?? "planned" }) });
          },
        },
      },
    });

    expect(updates[0]).toEqual({ id: goalId, status: "active" });
    expect(result?.response).toContain("Updated goal status:");
    expect(result?.response).toContain("▶ [active]");
  });

  it("lists documents for a goal", async () => {
    const service = await seededService();

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/doc goal-1",
      organizing: {
        documents: {
          listDocumentsByGoal: () => Effect.succeed({ documents: [createDocument()] }),
          createDocument: () => Effect.die("unused"),
          readDocument: () => Effect.die("unused"),
        },
      },
    });

    expect(result?.response).toContain("Documents for goal goal-1:");
    expect(result?.response).toContain("- v1 Research notes (doc-1)");
  });

  it("creates a document for a goal from following markdown lines", async () => {
    const service = await seededService();
    const calls: unknown[] = [];

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/doc create goal-1 Research notes\n# Research\n\nDetails",
      organizing: {
        documents: {
          listDocumentsByGoal: () => Effect.die("unused"),
          createDocument: (input) => {
            calls.push(input);
            return Effect.succeed({ document: createDocument(input) });
          },
          readDocument: () => Effect.die("unused"),
        },
      },
    });

    expect(calls[0]).toEqual({
      goalId,
      title: "Research notes",
      content: "# Research\n\nDetails",
    });
    expect(result?.response).toContain("Created document:");
    expect(result?.response).toContain("Version: v1");
  });

  it("reads a document with metadata and content", async () => {
    const service = await seededService();

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/doc read goal-1 doc-1",
      organizing: {
        documents: {
          listDocumentsByGoal: () => Effect.die("unused"),
          createDocument: () => Effect.die("unused"),
          readDocument: () => Effect.succeed({ document: createDocument() }),
        },
      },
    });

    expect(result?.response).toContain("Research notes (doc-1)");
    expect(result?.response).toContain("Goal: goal-1");
    expect(result?.response).toContain("Version: v1");
    expect(result?.response).toContain("# Research");
  });

  it("shows aggregate approval status for a goal", async () => {
    const service = await seededService();

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/approve goal-1",
      organizing: {
        approvals: {
          listApprovalsByGoal: () =>
            Effect.succeed({
              approvals: [
                createApproval({ status: "approved" }),
                createApproval({ id: ApprovalGateId.makeUnsafe("gate-2") }),
              ],
            }),
          createApproval: () => Effect.die("unused"),
          approve: () => Effect.die("unused"),
          reject: () => Effect.die("unused"),
        },
      },
    });

    expect(result?.response).toContain("Approval status for goal goal-1: pending");
    expect(result?.response).toContain("- ✓ [approved] gate-1");
    expect(result?.response).toContain("- ○ [pending] gate-2");
  });

  it("creates an approval gate", async () => {
    const service = await seededService();
    const calls: unknown[] = [];

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/approve create goal-1 Ready for human review",
      organizing: {
        actorId: "alpha",
        approvals: {
          listApprovalsByGoal: () => Effect.die("unused"),
          createApproval: (input) => {
            calls.push(input);
            return Effect.succeed({ approval: createApproval(input) });
          },
          approve: () => Effect.die("unused"),
          reject: () => Effect.die("unused"),
        },
      },
    });

    expect(calls[0]).toEqual({
      goalId,
      requestedBy: "alpha",
      reason: "Ready for human review",
    });
    expect(result?.response).toContain("Created approval gate:");
    expect(result?.response).toContain("[pending] gate-1");
  });

  it("approves an approval gate", async () => {
    const service = await seededService();
    const calls: unknown[] = [];

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/approve approve goal-1 gate-1 Looks good",
      organizing: {
        actorId: "alpha",
        approvals: {
          listApprovalsByGoal: () => Effect.die("unused"),
          createApproval: () => Effect.die("unused"),
          approve: (input) => {
            calls.push(input);
            return Effect.succeed({
              approval: createApproval({
                status: "approved",
                reviewedBy: input.reviewedBy,
                reason: input.reason,
              }),
            });
          },
          reject: () => Effect.die("unused"),
        },
      },
    });

    expect(calls[0]).toEqual({
      goalId,
      approvalId,
      reviewedBy: "alpha",
      reason: "Looks good",
    });
    expect(result?.response).toContain("Approved gate:");
    expect(result?.response).toContain("[approved] gate-1");
  });

  it("rejects an approval gate with a required reason", async () => {
    const service = await seededService();
    const calls: unknown[] = [];

    const result = await executeCoreAgentSlashCommand({
      service,
      scope,
      text: "/approve reject goal-1 gate-1 Missing tests",
      organizing: {
        actorId: "alpha",
        approvals: {
          listApprovalsByGoal: () => Effect.die("unused"),
          createApproval: () => Effect.die("unused"),
          approve: () => Effect.die("unused"),
          reject: (input) => {
            calls.push(input);
            return Effect.succeed({
              approval: createApproval({
                status: "rejected",
                reviewedBy: input.reviewedBy,
                reason: input.reason,
              }),
            });
          },
        },
      },
    });

    expect(calls[0]).toEqual({
      goalId,
      approvalId,
      reviewedBy: "alpha",
      reason: "Missing tests",
    });
    expect(result?.response).toContain("Rejected gate:");
    expect(result?.response).toContain("[rejected] gate-1");
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
