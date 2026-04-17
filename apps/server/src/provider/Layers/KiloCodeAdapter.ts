import { type ProviderUserInputAnswers } from "@t3tools/contracts";
import { Effect, Layer, ServiceMap } from "effect";

import { KiloCodeAcpManager } from "../../kilocodeAcpManager.ts";
import { createAcpEventStream, toAcpRequestError } from "../acpAdapterSupport.ts";
import { KiloCodeAdapter, type KiloCodeAdapterShape } from "../Services/KiloCodeAdapter.ts";

const PROVIDER = "kilocode" as const;

export interface KiloCodeAdapterLiveOptions {
  readonly manager?: KiloCodeAcpManager;
  readonly makeManager?: (services?: ServiceMap.ServiceMap<never>) => KiloCodeAcpManager;
}

export const makeKiloCodeAdapterLive = (options?: KiloCodeAdapterLiveOptions) =>
  Layer.effect(
    KiloCodeAdapter,
    Effect.gen(function* () {
      const manager = options?.manager ?? options?.makeManager?.() ?? new KiloCodeAcpManager();
      const toRequestError = (threadId: string, method: string, cause: unknown) =>
        toAcpRequestError({
          provider: PROVIDER,
          threadId,
          method,
          cause,
          unknownSessionNeedle: "unknown kilocode session",
        });

      const streamEvents = yield* createAcpEventStream(manager);

      const startSession: KiloCodeAdapterShape["startSession"] = (input) =>
        Effect.tryPromise({
          try: () =>
            manager.startSession({
              threadId: input.threadId,
              provider: "kilocode",
              ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
              ...(input.model !== undefined ? { model: input.model } : {}),
              ...(input.resumeCursor !== undefined ? { resumeCursor: input.resumeCursor } : {}),
              ...(input.providerOptions !== undefined
                ? { providerOptions: input.providerOptions }
                : {}),
              runtimeMode: input.runtimeMode,
            }),
          catch: (cause) => toRequestError(input.threadId, "session/start", cause),
        });

      const sendTurn: KiloCodeAdapterShape["sendTurn"] = (input) =>
        Effect.tryPromise({
          try: () =>
            manager.sendTurn({
              threadId: input.threadId,
              ...(input.input !== undefined ? { input: input.input } : {}),
              ...(input.attachments !== undefined ? { attachments: input.attachments } : {}),
              ...(input.model !== undefined ? { model: input.model } : {}),
            }),
          catch: (cause) => toRequestError(input.threadId, "session/prompt", cause),
        });

      const interruptTurn: KiloCodeAdapterShape["interruptTurn"] = (threadId, turnId) =>
        Effect.tryPromise({
          try: () => manager.interruptTurn(threadId, turnId),
          catch: (cause) => toRequestError(threadId, "session/cancel", cause),
        });

      const respondToRequest: KiloCodeAdapterShape["respondToRequest"] = (
        threadId,
        requestId,
        decision,
      ) =>
        Effect.tryPromise({
          try: () => manager.respondToRequest(threadId, requestId, decision),
          catch: (cause) => toRequestError(threadId, "request/respond", cause),
        });

      const respondToUserInput: KiloCodeAdapterShape["respondToUserInput"] = (
        threadId,
        _requestId,
        _answers: ProviderUserInputAnswers,
      ) =>
        Effect.tryPromise({
          try: () => manager.respondToUserInput(),
          catch: (cause) => toRequestError(threadId, "user-input/respond", cause),
        });

      const stopSession: KiloCodeAdapterShape["stopSession"] = (threadId) =>
        Effect.tryPromise({
          try: () => manager.stopSession(threadId),
          catch: (cause) => toRequestError(threadId, "session/stop", cause),
        });

      const listSessions: KiloCodeAdapterShape["listSessions"] = () =>
        Effect.promise(() => manager.listSessions());

      const hasSession: KiloCodeAdapterShape["hasSession"] = (threadId) =>
        Effect.promise(() => manager.hasSession(threadId));

      const readThread: KiloCodeAdapterShape["readThread"] = (threadId) =>
        Effect.tryPromise({
          try: () => manager.readThread(threadId),
          catch: (cause) => toRequestError(threadId, "thread/read", cause),
        });

      const rollbackThread: KiloCodeAdapterShape["rollbackThread"] = (threadId, numTurns) =>
        Effect.tryPromise({
          try: () => manager.rollbackThread(threadId, numTurns),
          catch: (cause) => toRequestError(threadId, "thread/rollback", cause),
        });

      const stopAll: KiloCodeAdapterShape["stopAll"] = () =>
        Effect.tryPromise({
          try: () => manager.stopAll(),
          catch: (cause) => toRequestError("_global", "provider/stopAll", cause),
        });

      return {
        provider: PROVIDER,
        capabilities: {
          sessionModelSwitch: "in-session",
        },
        startSession,
        sendTurn,
        interruptTurn,
        respondToRequest,
        respondToUserInput,
        stopSession,
        listSessions,
        hasSession,
        readThread,
        rollbackThread,
        stopAll,
        streamEvents,
      } satisfies KiloCodeAdapterShape;
    }),
  );
