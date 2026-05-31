import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ThreadId, TurnId } from "@t3tools/contracts";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import {
  calculateContextMeterLevel,
  ContextMeter,
  createContextMeterTurnUsage,
  DEFAULT_CONTEXT_METER_CONFIG,
  extractTokenUsage,
} from "./ContextMeter.ts";
import { makeContextMeterLive } from "./ContextMeterLive.ts";

const asThreadId = (value: string): ThreadId => ThreadId.makeUnsafe(value);
const asTurnId = (value: string): TurnId => TurnId.makeUnsafe(value);

describe("ContextMeter", () => {
  const tempDirs: string[] = [];

  function makeTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rowl-context-meter-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("extracts token usage from common provider payload shapes", () => {
    expect(extractTokenUsage({ usage: { totalTokens: 12_345 } }).usedTokens).toBe(12_345);
    expect(
      extractTokenUsage({
        tokenUsage: {
          last: {
            total_tokens: 27_800,
            input_tokens: 20_000,
            output_tokens: 7_800,
          },
        },
      }),
    ).toMatchObject({
      usedTokens: 27_800,
      inputTokens: 20_000,
      outputTokens: 7_800,
    });
    expect(
      extractTokenUsage({
        usage: {
          inputTokens: 10_000,
          outputTokens: 2_000,
        },
      }).usedTokens,
    ).toBe(12_000);
  });

  it("calculates percentage and warning thresholds", () => {
    const warning = createContextMeterTurnUsage({
      config: DEFAULT_CONTEXT_METER_CONFIG,
      threadId: asThreadId("thread-1"),
      turnId: asTurnId("turn-1"),
      provider: "codex",
      model: "gpt-5-codex",
      usage: { totalTokens: 280_000 },
      contextWindowTokens: 400_000,
      observedAt: "2026-05-30T00:00:00.000Z",
    });
    const critical = createContextMeterTurnUsage({
      config: DEFAULT_CONTEXT_METER_CONFIG,
      threadId: asThreadId("thread-1"),
      turnId: asTurnId("turn-2"),
      provider: "codex",
      model: "gpt-5-codex",
      usage: { totalTokens: 360_000 },
      contextWindowTokens: 400_000,
      observedAt: "2026-05-30T00:01:00.000Z",
    });

    expect(warning?.percentUsed).toBe(70);
    expect(warning?.level).toBe("warning");
    expect(critical?.percentUsed).toBe(90);
    expect(critical?.level).toBe("critical");
    expect(
      calculateContextMeterLevel({
        percentUsed: 69.9,
        warningThresholdPercent: 70,
        criticalThresholdPercent: 90,
      }),
    ).toBe("ok");
  });

  it("tracks bounded history per thread", async () => {
    const stateDir = makeTempDir();
    const meter = await Effect.runPromise(
      Effect.service(ContextMeter).pipe(
        Effect.provide(
          makeContextMeterLive({
            stateDir,
            config: { historyLimit: 2, defaultContextWindowTokens: 100 },
            now: () => "2026-05-30T00:00:00.000Z",
          }),
        ),
      ),
    );

    await Effect.runPromise(
      meter.recordTurnUsage({
        threadId: asThreadId("thread-a"),
        turnId: asTurnId("turn-1"),
        usage: { totalTokens: 10 },
      }),
    );
    await Effect.runPromise(
      meter.recordTurnUsage({
        threadId: asThreadId("thread-a"),
        turnId: asTurnId("turn-2"),
        usage: { totalTokens: 20 },
      }),
    );
    const snapshot = await Effect.runPromise(
      meter.recordTurnUsage({
        threadId: asThreadId("thread-a"),
        turnId: asTurnId("turn-3"),
        usage: { totalTokens: 30 },
      }),
    );

    expect(snapshot.usedTokens).toBe(30);
    expect(snapshot.percentUsed).toBe(30);
    expect(snapshot.history.map((entry) => entry.turnId)).toEqual([
      asTurnId("turn-2"),
      asTurnId("turn-3"),
    ]);
  });

  it("persists and reloads thread-scoped snapshots", async () => {
    const stateDir = makeTempDir();
    const layer = makeContextMeterLive({
      stateDir,
      config: {
        defaultContextWindowTokens: 100_000,
        modelContextWindowTokens: { custom: 50_000 },
      },
      now: () => "2026-05-30T00:00:00.000Z",
    });
    const first = await Effect.runPromise(Effect.service(ContextMeter).pipe(Effect.provide(layer)));
    await Effect.runPromise(
      first.recordTurnUsage({
        threadId: asThreadId("thread-persist"),
        turnId: asTurnId("turn-1"),
        provider: "codex",
        model: "custom",
        usage: { totalTokens: 25_000 },
      }),
    );

    const second = await Effect.runPromise(
      Effect.service(ContextMeter).pipe(Effect.provide(makeContextMeterLive({ stateDir }))),
    );
    const snapshot = await Effect.runPromise(
      second.getSnapshot({
        threadId: asThreadId("thread-persist"),
        model: "custom",
        provider: "codex",
      }),
    );

    expect(snapshot.contextWindowTokens).toBe(50_000);
    expect(snapshot.usedTokens).toBe(25_000);
    expect(snapshot.percentUsed).toBe(50);
    expect(snapshot.history).toHaveLength(1);
  });
});
