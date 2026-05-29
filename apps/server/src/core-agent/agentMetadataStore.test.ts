import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CoreAgentMetadata } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AgentMetadataStoreError,
  listAgentMetadata,
  readAgentMetadata,
  resolveGlobalAgentMetadataPath,
  resolveProjectAgentMetadataPath,
  writeAgentMetadata,
  type AgentMetadataFileSystem,
} from "./agentMetadataStore.ts";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rowl-agent-metadata-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function agent(overrides: Partial<CoreAgentMetadata> = {}): CoreAgentMetadata {
  return {
    id: "agent-1",
    name: "Rowl",
    scope: { type: "global" },
    personality: {
      kind: "preset",
      presetId: "rowl-default",
      instructions: "Maintain project memory.",
    },
    createdAt: "2026-05-29T12:00:00.000Z",
    updatedAt: "2026-05-29T12:00:00.000Z",
    ...overrides,
  };
}

describe("agent metadata paths", () => {
  it("resolves global metadata under {stateDir}/agents/{agentId}/metadata.json", () => {
    expect(resolveGlobalAgentMetadataPath(tmp, "agent-1")).toBe(
      path.join(tmp, "agents", "agent-1", "metadata.json"),
    );
  });

  it("resolves project metadata under {projectRoot}/.rowl/agents/{agentId}/metadata.json", () => {
    expect(resolveProjectAgentMetadataPath(tmp, "agent-1")).toBe(
      path.join(tmp, ".rowl", "agents", "agent-1", "metadata.json"),
    );
  });
});

describe("writeAgentMetadata", () => {
  it("creates first-run directories and writes pretty JSON with a trailing newline", () => {
    const metadata = agent();
    const filePath = resolveGlobalAgentMetadataPath(tmp, metadata.id);

    writeAgentMetadata({ filePath, metadata });

    expect(fs.existsSync(filePath)).toBe(true);
    const raw = fs.readFileSync(filePath, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('\n  "id": "agent-1",\n');
    expect(readAgentMetadata(filePath)).toEqual(metadata);
  });

  it("writes through a temp file before renaming into place", () => {
    const calls: Array<readonly [string, string, string?]> = [];
    const fakeFs: AgentMetadataFileSystem = {
      mkdirSync: (dir) => calls.push(["mkdir", dir]),
      readFileSync: () => "",
      readdirSync: () => [],
      statSync: () => ({ isDirectory: () => true }),
      writeFileSync: (filePath, contents) => calls.push(["write", filePath, contents]),
      renameSync: (from, to) => calls.push(["rename", from, to]),
      existsSync: () => true,
    };
    const filePath = path.join(tmp, "agents", "agent-1", "metadata.json");

    writeAgentMetadata({ filePath, metadata: agent(), fs: fakeFs });

    const writeCall = calls.find((call) => call[0] === "write");
    const renameCall = calls.find((call) => call[0] === "rename");

    expect(writeCall?.[1]).toMatch(/metadata\.json\..+\.tmp$/);
    expect(renameCall).toEqual(["rename", writeCall?.[1], filePath]);
  });

  it("keeps project metadata in a gitignored .rowl location without creating git state", () => {
    const metadata = agent({
      id: "project-agent",
      scope: { type: "project", projectRoot: tmp },
    });
    const filePath = resolveProjectAgentMetadataPath(tmp, metadata.id);

    writeAgentMetadata({ filePath, metadata });

    expect(filePath).toBe(path.join(tmp, ".rowl", "agents", "project-agent", "metadata.json"));
    expect(fs.existsSync(path.join(tmp, ".rowl", "agents", "project-agent", ".git"))).toBe(false);
  });
});

describe("readAgentMetadata", () => {
  it("throws a typed store error for corrupted JSON", () => {
    const filePath = resolveGlobalAgentMetadataPath(tmp, "agent-1");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "{not-json", "utf8");

    expect(() => readAgentMetadata(filePath)).toThrow(AgentMetadataStoreError);

    try {
      readAgentMetadata(filePath);
    } catch (error) {
      expect(error).toMatchObject({
        kind: "invalid-metadata",
        filePath,
      });
    }
  });
});

describe("listAgentMetadata", () => {
  it("returns an empty list when the agents root does not exist", () => {
    expect(listAgentMetadata(path.join(tmp, "missing"))).toEqual([]);
  });

  it("returns agents sorted by pinned state, name, and id", () => {
    const agentsRoot = path.join(tmp, "agents");
    const beta = agent({ id: "beta", name: "Beta", pinned: false });
    const alpha = agent({ id: "alpha", name: "alpha", pinned: false });
    const pinned = agent({ id: "pinned", name: "Zulu", pinned: true });

    for (const metadata of [beta, pinned, alpha]) {
      writeAgentMetadata({
        filePath: path.join(agentsRoot, metadata.id, "metadata.json"),
        metadata,
      });
    }

    expect(listAgentMetadata(agentsRoot).map((metadata) => metadata.id)).toEqual([
      "pinned",
      "alpha",
      "beta",
    ]);
  });
});
