import { describe, it, expect } from "vitest";
import {
  globalAgentsRoot,
  globalAgentMemoryDir,
  projectMemoryDir,
  DEFAULT_AGENT_ID,
} from "./paths.ts";

describe("memory paths", () => {
  it("globalAgentsRoot composes from stateDir", () => {
    expect(globalAgentsRoot("/tmp/state")).toBe("/tmp/state/agents");
  });

  it("globalAgentMemoryDir scopes by agent id", () => {
    expect(globalAgentMemoryDir("/tmp/state", "agent-42")).toBe(
      "/tmp/state/agents/agent-42/memory",
    );
  });

  it("projectMemoryDir lives under {projectRoot}/.rowl/memory", () => {
    expect(projectMemoryDir("/home/x/proj")).toBe("/home/x/proj/.rowl/memory");
  });

  it("DEFAULT_AGENT_ID is a stable constant", () => {
    expect(DEFAULT_AGENT_ID).toBe("default");
  });
});
