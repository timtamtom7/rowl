import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  CoreAgentId,
  CoreAgentMetadata,
  type CoreAgentMetadata as CoreAgentMetadataShape,
} from "@t3tools/contracts";
import { Schema } from "effect";

export type AgentMetadataFileSystem = {
  readonly existsSync: (filePath: string) => boolean;
  readonly mkdirSync: (filePath: string, options: { readonly recursive: true }) => unknown;
  readonly readFileSync: (filePath: string, encoding: "utf8") => string;
  readonly readdirSync: (filePath: string) => readonly string[];
  readonly renameSync: (from: string, to: string) => void;
  readonly statSync: (filePath: string) => { readonly isDirectory: () => boolean };
  readonly writeFileSync: (filePath: string, contents: string, encoding: "utf8") => void;
};

const nodeFs: AgentMetadataFileSystem = fs;

export class AgentMetadataStoreError extends Error {
  readonly kind: "invalid-metadata";
  readonly filePath: string;

  constructor(input: {
    readonly kind: "invalid-metadata";
    readonly filePath: string;
    readonly cause: unknown;
  }) {
    super(`Invalid core agent metadata at ${input.filePath}`, { cause: input.cause });
    this.name = "AgentMetadataStoreError";
    this.kind = input.kind;
    this.filePath = input.filePath;
  }
}

const decodeAgentId = Schema.decodeUnknownSync(CoreAgentId);
const decodeMetadata = Schema.decodeUnknownSync(CoreAgentMetadata);

export function resolveGlobalAgentMetadataPath(stateDir: string, agentId: string): string {
  return path.join(stateDir, "agents", decodeAgentId(agentId), "metadata.json");
}

export function resolveProjectAgentMetadataPath(projectRoot: string, agentId: string): string {
  return path.join(projectRoot, ".rowl", "agents", decodeAgentId(agentId), "metadata.json");
}

export function readAgentMetadata(
  filePath: string,
  fileSystem: AgentMetadataFileSystem = nodeFs,
): CoreAgentMetadataShape {
  try {
    const raw = fileSystem.readFileSync(filePath, "utf8");
    return decodeMetadata(JSON.parse(raw));
  } catch (cause) {
    throw new AgentMetadataStoreError({ kind: "invalid-metadata", filePath, cause });
  }
}

export function writeAgentMetadata(input: {
  readonly filePath: string;
  readonly metadata: CoreAgentMetadataShape;
  readonly fs?: AgentMetadataFileSystem;
}): void {
  const fileSystem = input.fs ?? nodeFs;
  const metadata = decodeMetadata(input.metadata);
  const dir = path.dirname(input.filePath);
  fileSystem.mkdirSync(dir, { recursive: true });
  const tempPath = `${input.filePath}.${process.pid}.${randomUUID()}.tmp`;
  fileSystem.writeFileSync(
    tempPath,
    `${JSON.stringify(sortJsonValue(metadata), null, 2)}\n`,
    "utf8",
  );
  fileSystem.renameSync(tempPath, input.filePath);
}

export function listAgentMetadata(
  agentsRoot: string,
  fileSystem: AgentMetadataFileSystem = nodeFs,
): CoreAgentMetadataShape[] {
  if (!fileSystem.existsSync(agentsRoot)) {
    return [];
  }

  return fileSystem
    .readdirSync(agentsRoot)
    .flatMap((entry) => {
      const agentDir = path.join(agentsRoot, entry);
      if (!fileSystem.statSync(agentDir).isDirectory()) {
        return [];
      }
      const metadataPath = path.join(agentDir, "metadata.json");
      if (!fileSystem.existsSync(metadataPath)) {
        return [];
      }
      return [readAgentMetadata(metadataPath, fileSystem)];
    })
    .sort(compareAgentMetadata);
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

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, sortJsonValue(nested)]),
  );
}
