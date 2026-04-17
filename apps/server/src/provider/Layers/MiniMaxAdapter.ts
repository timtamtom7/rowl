import { type ProviderUserInputAnswers } from "@t3tools/contracts";
import { Effect, Layer, ServiceMap } from "effect";

import { MiniMaxApiManager } from "../../minimaxApiManager.ts";
import { createAcpEventStream, toAcpRequestError } from "../acpAdapterSupport.ts";
import { MiniMaxAdapter, type MiniMaxAdapterShape } from "../Services/MiniMaxAdapter.ts";

const PROVIDER = "minimax" as const;

export interface MiniMaxAdapterLiveOptions {
  readonly manager?: MiniMaxApiManager;
  readonly makeManager?: (services?: ServiceMap.ServiceMap<never>) => MiniMaxApiManager;
}

export const makeMiniMaxAdapterLive = (options?: MiniMaxAdapterLiveOptions) =>
  Layer.effect(
    MiniMaxAdapter,
    Effect.gen(function* () {
      const manager = options?.manager ?? options?.makeManager?.() ?? new MiniMaxApiManager();
      const toRequestError = (threadId: string, method: string, cause: unknown) =>
        toAcpRequestError({
          provider: PROVIDER,
          threadId,
          method,
          cause,
          unknownSessionNeedle: "unknown minimax session",
        });

      const streamEvents = yield* createAcpEventStream(manager);

      const startSession: MiniMaxAdapterShape["startSession"] = (input) =>
        Effect.tryPromise({
          try: () =>
            manager.startSession({
              threadId: input.threadId,
              provider: "minimax",
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

      const sendTurn: MiniMaxAdapterShape["sendTurn"] = (input) =>
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

      const interruptTurn: MiniMaxAdapterShape["interruptTurn"] = (threadId, turnId) =>
        Effect.tryPromise({
          try: () => manager.interruptTurn(threadId, turnId),
          catch: (cause) => toRequestError(threadId, "session/cancel", cause),
        });

      const respondToRequest: MiniMaxAdapterShape["respondToRequest"] = (
        threadId,
        requestId,
        decision,
      ) =>
        Effect.tryPromise({
          try: () => manager.respondToRequest(threadId, requestId, decision),
          catch: (cause) => toRequestError(threadId, "request/respond", cause),
        });

      const respondToUserInput: MiniMaxAdapterShape["respondToUserInput"] = (
        threadId,
        _requestId,
        _answers: ProviderUserInputAnswers,
      ) =>
        Effect.tryPromise({
          try: () => manager.respondToUserInput(),
          catch: (cause) => toRequestError(threadId, "user-input/respond", cause),
        });

      const stopSession: MiniMaxAdapterShape["stopSession"] = (threadId) =>
        Effect.tryPromise({
          try: () => manager.stopSession(threadId),
          catch: (cause) => toRequestError(threadId, "session/stop", cause),
        });

      const listSessions: MiniMaxAdapterShape["listSessions"] = () =>
        Effect.promise(() => manager.listSessions());

      const hasSession: MiniMaxAdapterShape["hasSession"] = (threadId) =>
        Effect.promise(() => manager.hasSession(threadId));

      const readThread: MiniMaxAdapterShape["readThread"] = (threadId) =>
        Effect.tryPromise({
          try: () => manager.readThread(threadId),
          catch: (cause) => toRequestError(threadId, "thread/read", cause),
        });

      const rollbackThread: MiniMaxAdapterShape["rollbackThread"] = (threadId, numTurns) =>
        Effect.tryPromise({
          try: () => manager.rollbackThread(threadId, numTurns),
          catch: (cause) => toRequestError(threadId, "thread/rollback", cause),
        });

      const stopAll: MiniMaxAdapterShape["stopAll"] = () =>
        Effect.tryPromise({
          try: () => manager.stopAll(),
          catch: (cause) => toRequestError("_global", "provider/stopAll", cause),
        });

      return {
        provider: PROVIDER,
        capabilities: {
          sessionModelSwitch: "restart-session",
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
      } satisfies MiniMaxAdapterShape;
    }),
  );
