import { describe, it, expect, vi } from "vitest";
import { Effect } from "effect";
import { WS_CHANNELS, type CoreAgentActiveChangedEvent } from "@t3tools/contracts";

import { publishCoreAgentActiveChanged, setActiveCoreAgentAndPublish } from "./CoreAgentEvents.ts";

const event = {
  scope: { type: "global" },
  activeAgentId: "agent-alpha",
  agent: {
    id: "agent-alpha",
    name: "Alpha",
    scope: { type: "global" },
    personality: {
      kind: "custom",
      instructions: "Prefer direct implementation.",
    },
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z",
  },
} satisfies CoreAgentActiveChangedEvent;

describe("CoreAgentEvents", () => {
  it("publishes active-agent changes on the core-agent WebSocket channel", async () => {
    const publishAll = vi.fn(() => Effect.void);

    await Effect.runPromise(
      publishCoreAgentActiveChanged({
        pushBus: { publishAll },
        event,
      }),
    );

    expect(publishAll).toHaveBeenCalledWith(WS_CHANNELS.coreAgentActiveChanged, event);
  });

  it("publishes only after CoreAgentService accepts an active-agent change", async () => {
    const request = {
      scope: { type: "global" },
      agentId: "agent-alpha",
    } as const;
    const setActiveAgent = vi.fn(async () => ({
      activeAgentId: event.activeAgentId,
      agent: event.agent,
      event,
    }));
    const publishAll = vi.fn(() => Effect.void);

    const result = await Effect.runPromise(
      setActiveCoreAgentAndPublish({
        service: { setActiveAgent },
        pushBus: { publishAll },
        request,
      }),
    );

    expect(setActiveAgent).toHaveBeenCalledWith(request);
    expect(publishAll).toHaveBeenCalledWith(WS_CHANNELS.coreAgentActiveChanged, event);
    expect(result).toEqual({
      activeAgentId: event.activeAgentId,
      agent: event.agent,
    });
  });
});
