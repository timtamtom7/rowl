import fs from "node:fs";
import path from "node:path";

import {
  CoreAgentId,
  CoreAgentMetadata,
  type CoreAgentActiveChangedEvent,
  type CoreAgentCreateRequest,
  type CoreAgentDeleteRequest,
  type CoreAgentDeleteResponse,
  type CoreAgentListRequest,
  type CoreAgentListResponse,
  type CoreAgentMetadata as CoreAgentMetadataShape,
  type CoreAgentMutationResponse,
  type CoreAgentScope,
  type CoreAgentSetActiveRequest,
  type CoreAgentSetActiveResponse,
  type CoreAgentUpdateRequest,
} from "@t3tools/contracts";
import { Schema } from "effect";

import { globalAgentsRoot } from "../memory/paths.ts";
import {
  listAgentMetadata,
  readAgentMetadata,
  resolveGlobalAgentMetadataPath,
  resolveProjectAgentMetadataPath,
  writeAgentMetadata,
} from "./agentMetadataStore.ts";
import {
  getPersonalityPreset,
  materializePresetAgentMetadata,
  type CoreAgentPersonalityPresetId,
} from "./personalityPresets.ts";

export type CoreAgentStore = {
  readonly listAgents: (scope: CoreAgentScope) => Promise<ReadonlyArray<CoreAgentMetadataShape>>;
  readonly readAgent: (
    scope: CoreAgentScope,
    agentId: string,
  ) => Promise<CoreAgentMetadataShape | null>;
  readonly writeAgent: (metadata: CoreAgentMetadataShape) => Promise<void>;
  readonly deleteAgent: (scope: CoreAgentScope, agentId: string) => Promise<void>;
  readonly readActiveAgentId: (scope: CoreAgentScope) => Promise<string | null>;
  readonly writeActiveAgentId: (scope: CoreAgentScope, agentId: string) => Promise<void>;
};

export type CoreAgentService = {
  readonly listAgents: (request: CoreAgentListRequest) => Promise<CoreAgentListResponse>;
  readonly createAgent: (request: CoreAgentCreateRequest) => Promise<CoreAgentMutationResponse>;
  readonly createAgentFromPreset: (
    request: CreateCoreAgentFromPresetRequest,
  ) => Promise<CoreAgentMutationResponse>;
  readonly updateAgent: (request: CoreAgentUpdateRequest) => Promise<CoreAgentMutationResponse>;
  readonly deleteAgent: (request: CoreAgentDeleteRequest) => Promise<CoreAgentDeleteResponse>;
  readonly setActiveAgent: (request: CoreAgentSetActiveRequest) => Promise<SetActiveAgentResult>;
  readonly resolveActiveAgent: (
    request: ResolveActiveAgentRequest,
  ) => Promise<CoreAgentSetActiveResponse>;
};

export type CreateCoreAgentFromPresetRequest = {
  readonly presetId: CoreAgentPersonalityPresetId;
  readonly scope: CoreAgentScope;
  readonly name?: string;
  readonly description?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly pinned?: boolean;
};

export type ResolveActiveAgentRequest = {
  readonly scope: CoreAgentScope;
};

export type SetActiveAgentResult = CoreAgentSetActiveResponse & {
  readonly event: CoreAgentActiveChangedEvent;
};

export type CoreAgentServiceOptions = {
  readonly store: CoreAgentStore;
  readonly now: () => string;
  readonly generateId: () => string;
};

export class CoreAgentServiceError extends Error {
  readonly kind:
    | "agent-not-found"
    | "active-agent-delete-rejected"
    | "duplicate-agent"
    | "unknown-preset";
  readonly agentId: string | undefined;
  readonly presetId: string | undefined;

  constructor(input: {
    readonly kind: CoreAgentServiceError["kind"];
    readonly message: string;
    readonly agentId?: string;
    readonly presetId?: string;
  }) {
    super(input.message);
    this.name = "CoreAgentServiceError";
    this.kind = input.kind;
    this.agentId = input.agentId;
    this.presetId = input.presetId;
  }
}

const decodeAgentId = Schema.decodeUnknownSync(CoreAgentId);
const decodeMetadata = Schema.decodeUnknownSync(CoreAgentMetadata);

export function createCoreAgentService(options: CoreAgentServiceOptions): CoreAgentService {
  const locks = new Map<string, Promise<unknown>>();

  const withAgentLock = async <T>(
    scope: CoreAgentScope,
    agentId: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const key = `${scopeKey(scope)}:${agentId}`;
    const previous = locks.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    locks.set(
      key,
      current.catch(() => undefined),
    );

    try {
      return await current;
    } finally {
      if (locks.get(key) === current) {
        locks.delete(key);
      }
    }
  };

  const readRequiredAgent = async (
    scope: CoreAgentScope,
    agentId: string,
  ): Promise<CoreAgentMetadataShape> => {
    const metadata = await options.store.readAgent(scope, agentId);
    if (!metadata) {
      throw new CoreAgentServiceError({
        kind: "agent-not-found",
        agentId,
        message: `Core agent not found: ${agentId}`,
      });
    }
    return metadata;
  };

  return {
    async listAgents(request) {
      const scope = request.scope ?? { type: "global" };
      const agents = (await options.store.listAgents(scope)).toSorted(compareAgentMetadata);
      const activeAgentId = await options.store.readActiveAgentId(scope);
      return {
        agents,
        activeAgentId,
      };
    },

    async createAgent(request) {
      const id = decodeAgentId(options.generateId());
      const existing = await options.store.readAgent(request.scope, id);
      if (existing) {
        throw new CoreAgentServiceError({
          kind: "duplicate-agent",
          agentId: id,
          message: `Core agent already exists: ${id}`,
        });
      }

      const now = options.now();
      const agent = decodeMetadata({
        ...request,
        id,
        createdAt: now,
        updatedAt: now,
      });
      await options.store.writeAgent(agent);
      return { agent };
    },

    async createAgentFromPreset(request) {
      if (!getPersonalityPreset(request.presetId)) {
        throw new CoreAgentServiceError({
          kind: "unknown-preset",
          presetId: request.presetId,
          message: `Unknown core agent personality preset: ${request.presetId}`,
        });
      }

      const id = decodeAgentId(options.generateId());
      const existing = await options.store.readAgent(request.scope, id);
      if (existing) {
        throw new CoreAgentServiceError({
          kind: "duplicate-agent",
          agentId: id,
          message: `Core agent already exists: ${id}`,
        });
      }

      const agent = materializePresetAgentMetadata({
        ...request,
        id,
        now: options.now(),
      });
      await options.store.writeAgent(agent);
      return { agent };
    },

    async updateAgent(request) {
      return withAgentLock(request.scope, request.agentId, async () => {
        const existing = await readRequiredAgent(request.scope, request.agentId);
        const agent = decodeMetadata({
          ...existing,
          name: request.name ?? existing.name,
          description: request.description ?? existing.description,
          personality: request.personality ?? existing.personality,
          defaultModel: request.defaultModel ?? existing.defaultModel,
          tags: request.tags ?? existing.tags,
          pinned: request.pinned ?? existing.pinned,
          updatedAt: options.now(),
        });
        await options.store.writeAgent(agent);
        return { agent };
      });
    },

    async deleteAgent(request) {
      const activeAgentId = await options.store.readActiveAgentId(request.scope);
      if (activeAgentId === request.agentId) {
        throw new CoreAgentServiceError({
          kind: "active-agent-delete-rejected",
          agentId: request.agentId,
          message: `Cannot delete active core agent without a replacement: ${request.agentId}`,
        });
      }

      await readRequiredAgent(request.scope, request.agentId);
      await options.store.deleteAgent(request.scope, request.agentId);
      return {};
    },

    async setActiveAgent(request) {
      const agent = await readRequiredAgent(request.scope, request.agentId);
      await options.store.writeActiveAgentId(request.scope, request.agentId);
      return {
        activeAgentId: request.agentId,
        agent,
        event: {
          scope: request.scope,
          activeAgentId: request.agentId,
          agent,
        },
      };
    },

    async resolveActiveAgent(request) {
      const activeAgentId = await options.store.readActiveAgentId(request.scope);
      if (activeAgentId) {
        const activeAgent = await options.store.readAgent(request.scope, activeAgentId);
        if (activeAgent) {
          return { activeAgentId, agent: activeAgent };
        }
      }

      const fallbackId = "default";
      const existingDefault = await options.store.readAgent(request.scope, fallbackId);
      if (existingDefault) {
        await options.store.writeActiveAgentId(request.scope, fallbackId);
        return { activeAgentId: fallbackId, agent: existingDefault };
      }

      const agent = materializePresetAgentMetadata({
        presetId: "default",
        id: fallbackId,
        scope: request.scope,
        now: options.now(),
      });
      await options.store.writeAgent(agent);
      await options.store.writeActiveAgentId(request.scope, fallbackId);
      return { activeAgentId: fallbackId, agent };
    },
  };
}

export function createFileCoreAgentStore(input: { readonly stateDir: string }): CoreAgentStore {
  return {
    async listAgents(scope) {
      return listAgentMetadata(agentsRootForScope(input.stateDir, scope));
    },
    async readAgent(scope, agentId) {
      const filePath = metadataPathForScope(input.stateDir, scope, agentId);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return readAgentMetadata(filePath);
    },
    async writeAgent(metadata) {
      writeAgentMetadata({
        filePath: metadataPathForScope(input.stateDir, metadata.scope, metadata.id),
        metadata,
      });
    },
    async deleteAgent(scope, agentId) {
      fs.rmSync(path.dirname(metadataPathForScope(input.stateDir, scope, agentId)), {
        recursive: true,
        force: true,
      });
    },
    async readActiveAgentId(scope) {
      const filePath = activeAgentPathForScope(input.stateDir, scope);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
        readonly activeAgentId?: unknown;
      };
      return parsed.activeAgentId ? decodeAgentId(parsed.activeAgentId) : null;
    },
    async writeActiveAgentId(scope, agentId) {
      const activeAgentId = decodeAgentId(agentId);
      const filePath = activeAgentPathForScope(input.stateDir, scope);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify({ activeAgentId }, null, 2)}\n`, "utf8");
    },
  };
}

function metadataPathForScope(stateDir: string, scope: CoreAgentScope, agentId: string): string {
  return scope.type === "global"
    ? resolveGlobalAgentMetadataPath(stateDir, agentId)
    : resolveProjectAgentMetadataPath(scope.projectRoot, agentId);
}

function agentsRootForScope(stateDir: string, scope: CoreAgentScope): string {
  return scope.type === "global"
    ? globalAgentsRoot(stateDir)
    : path.join(scope.projectRoot, ".rowl", "agents");
}

function activeAgentPathForScope(stateDir: string, scope: CoreAgentScope): string {
  return path.join(agentsRootForScope(stateDir, scope), "active-agent.json");
}

function scopeKey(scope: CoreAgentScope): string {
  return scope.type === "global" ? "global" : `project:${scope.projectRoot}`;
}

function compareAgentMetadata(a: CoreAgentMetadataShape, b: CoreAgentMetadataShape): number {
  const pinned = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  if (pinned !== 0) {
    return pinned;
  }

  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (byName !== 0) {
    return byName;
  }

  return a.id.localeCompare(b.id);
}
