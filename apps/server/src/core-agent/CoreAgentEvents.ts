import {
  WS_CHANNELS,
  type CoreAgentActiveChangedEvent,
  type CoreAgentSetActiveRequest,
  type CoreAgentSetActiveResponse,
} from "@t3tools/contracts";
import { Effect } from "effect";

import type { ServerPushBus } from "../wsServer/pushBus.ts";
import type { CoreAgentService } from "./CoreAgentService.ts";

export function publishCoreAgentActiveChanged(input: {
  readonly pushBus: Pick<ServerPushBus, "publishAll">;
  readonly event: CoreAgentActiveChangedEvent;
}): Effect.Effect<void> {
  return input.pushBus.publishAll(WS_CHANNELS.coreAgentActiveChanged, input.event);
}

export function setActiveCoreAgentAndPublish(input: {
  readonly service: Pick<CoreAgentService, "setActiveAgent">;
  readonly pushBus: Pick<ServerPushBus, "publishAll">;
  readonly request: CoreAgentSetActiveRequest;
}): Effect.Effect<CoreAgentSetActiveResponse> {
  return Effect.promise(() => input.service.setActiveAgent(input.request)).pipe(
    Effect.tap((result) =>
      publishCoreAgentActiveChanged({
        pushBus: input.pushBus,
        event: result.event,
      }),
    ),
    Effect.map(({ activeAgentId, agent }) => ({ activeAgentId, agent })),
  );
}
