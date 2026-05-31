import fs from "node:fs/promises";
import path from "node:path";

import { ContextMeterSnapshot } from "@t3tools/contracts";
import { Effect, Layer, Schema } from "effect";

import { ServerConfig } from "../config.ts";
import {
  appendContextMeterTurnUsage,
  ContextMeter,
  ContextMeterError,
  createContextMeterTurnUsage,
  createEmptyContextMeterSnapshot,
  DEFAULT_CONTEXT_METER_CONFIG,
  type ContextMeterConfig,
  type ContextMeterRecordInput,
  type ContextMeterShape,
} from "./ContextMeter.ts";

export interface ContextMeterLiveOptions {
  readonly stateDir: string;
  readonly config?: Partial<ContextMeterConfig>;
  readonly now?: () => string;
}

const encodeSnapshot = Schema.encodeUnknownSync(ContextMeterSnapshot);
const decodeSnapshot = Schema.decodeUnknownSync(ContextMeterSnapshot);

function mergeConfig(config: Partial<ContextMeterConfig> | undefined): ContextMeterConfig {
  return {
    ...DEFAULT_CONTEXT_METER_CONFIG,
    ...config,
    modelContextWindowTokens: {
      ...DEFAULT_CONTEXT_METER_CONFIG.modelContextWindowTokens,
      ...config?.modelContextWindowTokens,
    },
  };
}

function threadSnapshotPath(stateDir: string, threadId: string): string {
  return path.join(stateDir, "context-meter", "threads", `${encodeURIComponent(threadId)}.json`);
}

function makeContextMeter(options: ContextMeterLiveOptions): ContextMeterShape {
  const config = mergeConfig(options.config);
  const now = options.now ?? (() => new Date().toISOString());

  const readSnapshot = (
    input: ContextMeterRecordInput | Parameters<ContextMeterShape["getSnapshot"]>[0],
  ) =>
    Effect.tryPromise({
      try: async () => {
        const filePath = threadSnapshotPath(options.stateDir, input.threadId);
        try {
          const raw = await fs.readFile(filePath, "utf8");
          return decodeSnapshot(JSON.parse(raw));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
          return createEmptyContextMeterSnapshot({
            threadId: input.threadId,
            config,
            ...(input.model !== undefined ? { model: input.model } : {}),
            ...(input.provider !== undefined ? { provider: input.provider } : {}),
            ...(input.contextWindowTokens !== undefined
              ? { contextWindowTokens: input.contextWindowTokens }
              : {}),
          });
        }
      },
      catch: (cause) => new ContextMeterError({ operation: "read", cause }),
    });

  const writeSnapshot = (snapshot: ContextMeterSnapshot) =>
    Effect.tryPromise({
      try: async () => {
        const filePath = threadSnapshotPath(options.stateDir, snapshot.threadId);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `${JSON.stringify(encodeSnapshot(snapshot), null, 2)}\n`);
      },
      catch: (cause) => new ContextMeterError({ operation: "write", cause }),
    }).pipe(Effect.as(snapshot));

  return {
    getSnapshot: (input) => readSnapshot(input),
    recordTurnUsage: (input) =>
      Effect.gen(function* () {
        const snapshot = yield* readSnapshot(input);
        const turnUsage = createContextMeterTurnUsage({
          config,
          threadId: input.threadId,
          ...(input.turnId !== undefined ? { turnId: input.turnId } : {}),
          ...(input.provider !== undefined ? { provider: input.provider } : {}),
          ...(input.model !== undefined ? { model: input.model } : {}),
          usage: input.usage,
          ...(input.contextWindowTokens !== undefined
            ? { contextWindowTokens: input.contextWindowTokens }
            : {}),
          observedAt: input.observedAt ?? now(),
        });
        if (!turnUsage) {
          return snapshot;
        }
        return yield* writeSnapshot(
          appendContextMeterTurnUsage({
            snapshot,
            config,
            usage: turnUsage,
          }),
        );
      }),
  };
}

export function makeContextMeterLive(options: ContextMeterLiveOptions) {
  return Layer.succeed(ContextMeter, makeContextMeter(options));
}

export const ContextMeterLive = Layer.effect(
  ContextMeter,
  Effect.gen(function* () {
    const { stateDir } = yield* ServerConfig;
    return makeContextMeter({ stateDir });
  }),
);
