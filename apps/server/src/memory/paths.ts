/**
 * Filesystem paths for Rowl memory blocks.
 *
 * Two tiers:
 *   - global:  {stateDir}/agents/{agentId}/memory/
 *   - project: {projectRoot}/.rowl/memory/
 *
 * Phase 1a uses a single implicit agent per installation (DEFAULT_AGENT_ID).
 * Phase 1b introduces multi-agent support.
 */
import path from "node:path";

export const DEFAULT_AGENT_ID = "default";

export function globalAgentsRoot(stateDir: string): string {
  return path.join(stateDir, "agents");
}

export function globalAgentMemoryDir(stateDir: string, agentId: string): string {
  return path.join(globalAgentsRoot(stateDir), agentId, "memory");
}

export function projectMemoryDir(projectRoot: string): string {
  return path.join(projectRoot, ".rowl", "memory");
}
