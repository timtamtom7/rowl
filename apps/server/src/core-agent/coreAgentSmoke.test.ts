import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  CoreAgentMetadata,
  CoreAgentScope,
  WebSocketRequest as WebSocketRequestShape,
} from "@t3tools/contracts";
import { WS_METHODS, WebSocketRequest, WsRpcResultSchemaByMethod } from "@t3tools/contracts";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeBlockToDir } from "../memory/blockFiles.ts";
import { CoreMemoryLive } from "../memory/Layers/CoreMemoryLive.ts";
import { CoreMemoryService } from "../memory/Services/CoreMemoryService.ts";
import {
  createCoreAgentService,
  createFileCoreAgentStore,
  type CoreAgentService,
} from "./CoreAgentService.ts";
import { executeCoreAgentSlashCommand } from "./coreAgentSlashCommands.ts";

const NOW = "2026-05-29T12:00:00.000Z";

let stateDir: string;
let projectRoot: string;
let generatedIds: string[];

beforeEach(async () => {
  stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-core-agent-state-"));
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rowl-core-agent-project-"));
  generatedIds = [];
});

afterEach(async () => {
  await fs.rm(stateDir, { recursive: true, force: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

function projectScope(): CoreAgentScope {
  return { type: "project", projectRoot };
}

function service(): CoreAgentService {
  return createCoreAgentService({
    store: createFileCoreAgentStore({ stateDir }),
    now: () => NOW,
    generateId: () => {
      const id = generatedIds.shift();
      if (!id) throw new Error("Test did not provide a generated agent id");
      return id;
    },
  });
}

async function createProjectAgent(
  coreAgents: CoreAgentService,
  id: string,
  input: {
    readonly name: string;
    readonly instructions: string;
  },
): Promise<CoreAgentMetadata> {
  generatedIds.push(id);
  const created = await coreAgents.createAgent({
    scope: projectScope(),
    name: input.name,
    personality: {
      kind: "custom",
      instructions: input.instructions,
    },
  });
  return created.agent;
}

function agentMemoryDir(agentId: string): string {
  return path.join(stateDir, "memory", agentId);
}

async function writeAgentMemory(agentId: string, body: string): Promise<void> {
  await writeBlockToDir(agentMemoryDir(agentId), {
    label: "persona",
    description: `${agentId} memory`,
    readOnly: false,
    scope: "global",
    version: 1,
    body,
  });
}

async function listGlobalMemoryBodies(agentId?: string): Promise<ReadonlyArray<string>> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const memory = yield* CoreMemoryService;
      const blocks = yield* memory.listGlobal(agentId ? { agentId, projectRoot } : { projectRoot });
      return blocks.map((block) => block.body.trim());
    }).pipe(Effect.provide(CoreMemoryLive({ stateDir }))),
  );
}

function decodeRequest(body: Record<string, unknown>): WebSocketRequestShape {
  return Schema.decodeUnknownSync(WebSocketRequest)({
    id: "request-1",
    body,
  });
}

async function dispatchCoreAgentRoute(
  coreAgents: CoreAgentService,
  request: WebSocketRequestShape,
): Promise<unknown> {
  const { _tag, ...body } = request.body as Record<string, unknown>;
  switch (_tag) {
    case WS_METHODS.coreAgentsList:
      return coreAgents.listAgents(body);
    case WS_METHODS.coreAgentsCreate:
      return coreAgents.createAgent(body as any);
    case WS_METHODS.coreAgentsUpdate:
      return coreAgents.updateAgent(body as any);
    case WS_METHODS.coreAgentsDelete:
      return coreAgents.deleteAgent(body as any);
    case WS_METHODS.coreAgentsSetActive:
      return coreAgents.setActiveAgent(body as any);
    default:
      throw new Error(`Unexpected route in core-agent smoke test: ${String(_tag)}`);
  }
}

function decodeRouteResponse(method: keyof typeof WsRpcResultSchemaByMethod, value: unknown) {
  return Schema.decodeUnknownSync(WsRpcResultSchemaByMethod[method] as any)(value);
}

describe("core-agent phase 1b smoke matrix", () => {
  it("creates agents, switches active memory blocks, handles slash commands, and inherits /new child metadata", async () => {
    const coreAgents = service();
    const alpha = await createProjectAgent(coreAgents, "agent-alpha", {
      name: "Alpha",
      instructions: "Alpha instructions.",
    });
    const beta = await createProjectAgent(coreAgents, "agent-beta", {
      name: "Beta",
      instructions: "Beta instructions.",
    });
    await writeAgentMemory(alpha.id, "Alpha global memory");
    await writeAgentMemory(beta.id, "Beta global memory");

    await coreAgents.setActiveAgent({ scope: projectScope(), agentId: alpha.id });
    await expect(listGlobalMemoryBodies()).resolves.toEqual(["Alpha global memory"]);

    await coreAgents.setActiveAgent({ scope: projectScope(), agentId: beta.id });
    await expect(listGlobalMemoryBodies()).resolves.toEqual(["Beta global memory"]);

    const listResult = await executeCoreAgentSlashCommand({
      service: coreAgents,
      scope: projectScope(),
      text: "/agents",
    });
    expect(listResult?.response).toContain("Active agent: Beta (agent-beta)");
    expect(listResult?.response).toContain("- Alpha (agent-alpha)");
    expect(listResult?.response).toContain("* Beta (agent-beta)");

    const switchResult = await executeCoreAgentSlashCommand({
      service: coreAgents,
      scope: projectScope(),
      text: "/switch Alpha",
    });
    expect(switchResult?.response).toBe("Switched active agent to Alpha (agent-alpha).");
    await expect(listGlobalMemoryBodies()).resolves.toEqual(["Alpha global memory"]);

    const personaResult = await executeCoreAgentSlashCommand({
      service: coreAgents,
      scope: projectScope(),
      text: "/persona reviewer",
    });
    expect(personaResult?.response).toBe("Updated Alpha personality to reviewer.");
    const updatedAlpha = await coreAgents.resolveActiveAgent({ scope: projectScope() });
    expect(updatedAlpha.agent.personality).toMatchObject({
      kind: "preset",
      presetId: "reviewer",
    });

    generatedIds.push("agent-alpha-2");
    const child = await coreAgents.createAgent({
      scope: projectScope(),
      name: "Alpha 2",
      description: updatedAlpha.agent.description,
      personality: updatedAlpha.agent.personality,
      defaultModel: updatedAlpha.agent.defaultModel,
      tags: updatedAlpha.agent.tags,
      pinned: updatedAlpha.agent.pinned,
    });
    await coreAgents.setActiveAgent({ scope: projectScope(), agentId: child.agent.id });
    expect(child.agent).toMatchObject({
      id: "agent-alpha-2",
      name: "Alpha 2",
      personality: updatedAlpha.agent.personality,
    });
    await writeAgentMemory(child.agent.id, "Child global memory");
    await expect(listGlobalMemoryBodies()).resolves.toEqual(["Child global memory"]);
    await expect(listGlobalMemoryBodies(alpha.id)).resolves.toEqual(["Alpha global memory"]);
  });

  it("exercises core-agent WebSocket routes with shared request and response schemas", async () => {
    const coreAgents = service();
    const scope = projectScope();

    generatedIds.push("ws-agent");
    const createRequest = decodeRequest({
      _tag: WS_METHODS.coreAgentsCreate,
      scope,
      name: "WS Agent",
      personality: {
        kind: "custom",
        instructions: "Created through the WebSocket smoke route.",
      },
    });
    const created = decodeRouteResponse(
      WS_METHODS.coreAgentsCreate,
      await dispatchCoreAgentRoute(coreAgents, createRequest),
    );
    expect(created.agent.id).toBe("ws-agent");

    const setActiveRequest = decodeRequest({
      _tag: WS_METHODS.coreAgentsSetActive,
      scope,
      agentId: "ws-agent",
    });
    const active = decodeRouteResponse(
      WS_METHODS.coreAgentsSetActive,
      await dispatchCoreAgentRoute(coreAgents, setActiveRequest),
    );
    expect(active.activeAgentId).toBe("ws-agent");

    const updateRequest = decodeRequest({
      _tag: WS_METHODS.coreAgentsUpdate,
      scope,
      agentId: "ws-agent",
      name: "WS Agent Updated",
      personality: {
        kind: "preset",
        presetId: "planner",
        instructions: "Plan first.",
      },
    });
    const updated = decodeRouteResponse(
      WS_METHODS.coreAgentsUpdate,
      await dispatchCoreAgentRoute(coreAgents, updateRequest),
    );
    expect(updated.agent).toMatchObject({
      id: "ws-agent",
      name: "WS Agent Updated",
      personality: {
        kind: "preset",
        presetId: "planner",
      },
    });

    const listRequest = decodeRequest({
      _tag: WS_METHODS.coreAgentsList,
      scope,
    });
    const list = decodeRouteResponse(
      WS_METHODS.coreAgentsList,
      await dispatchCoreAgentRoute(coreAgents, listRequest),
    );
    expect(list).toMatchObject({
      activeAgentId: "ws-agent",
      agents: [{ id: "ws-agent", name: "WS Agent Updated" }],
    });

    generatedIds.push("ws-delete-me");
    const removable = await coreAgents.createAgent({
      scope,
      name: "Delete Me",
      personality: {
        kind: "custom",
        instructions: "Temporary.",
      },
    });
    const deleteRequest = decodeRequest({
      _tag: WS_METHODS.coreAgentsDelete,
      scope,
      agentId: removable.agent.id,
    });
    const deleted = decodeRouteResponse(
      WS_METHODS.coreAgentsDelete,
      await dispatchCoreAgentRoute(coreAgents, deleteRequest),
    );
    expect(deleted).toEqual({});

    const finalList = await coreAgents.listAgents({ scope });
    expect(finalList.agents.map((agent) => agent.id)).toEqual(["ws-agent"]);
  });
});
