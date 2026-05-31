/**
 * Filesystem paths for Rowl memory blocks.
 *
 * Two tiers:
 *   - global:  {stateDir}/memory/{agentId}/
 *   - project: {projectRoot}/.rowl/memory/
 *
 * Phase 1a uses a single implicit agent per installation (DEFAULT_AGENT_ID).
 * Phase 1b introduces multi-agent support.
 */
import path from "node:path";
import { CoreAgentId } from "@t3tools/contracts";
import { Schema } from "effect";

export const DEFAULT_AGENT_ID = "default";

const decodeAgentId = Schema.decodeUnknownSync(CoreAgentId);

export function globalAgentsRoot(stateDir: string): string {
  return path.join(stateDir, "agents");
}

export function globalMemoryRoot(stateDir: string): string {
  return path.join(stateDir, "memory");
}

export function normalizeMemoryAgentId(agentId: string | undefined): string {
  return decodeAgentId(agentId ?? DEFAULT_AGENT_ID);
}

export function globalAgentMemoryDir(stateDir: string, agentId?: string): string {
  return path.join(globalMemoryRoot(stateDir), normalizeMemoryAgentId(agentId));
}

export function projectMemoryDir(projectRoot: string): string {
  return path.join(projectRoot, ".rowl", "memory");
}
