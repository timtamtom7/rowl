import { Schema } from "effect";

import {
  IsoDateTime,
  NonNegativeInt,
  PositiveInt,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
} from "./baseSchemas";
import { ProviderKind } from "./orchestration";

const PercentNumber = Schema.Number.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(100),
);

export const ContextMeterLevel = Schema.Literals(["ok", "warning", "critical"]);
export type ContextMeterLevel = typeof ContextMeterLevel.Type;

export const ContextMeterConfig = Schema.Struct({
  defaultContextWindowTokens: PositiveInt,
  warningThresholdPercent: PercentNumber,
  criticalThresholdPercent: PercentNumber,
  historyLimit: PositiveInt,
  modelContextWindowTokens: Schema.Record(TrimmedNonEmptyString, PositiveInt),
});
export type ContextMeterConfig = typeof ContextMeterConfig.Type;

export const ContextMeterTurnUsage = Schema.Struct({
  turnId: Schema.optional(TurnId),
  provider: Schema.optional(ProviderKind),
  model: Schema.optional(TrimmedNonEmptyString),
  inputTokens: Schema.optional(NonNegativeInt),
  outputTokens: Schema.optional(NonNegativeInt),
  usedTokens: NonNegativeInt,
  contextWindowTokens: PositiveInt,
  percentUsed: PercentNumber,
  level: ContextMeterLevel,
  observedAt: IsoDateTime,
});
export type ContextMeterTurnUsage = typeof ContextMeterTurnUsage.Type;

export const ContextMeterSnapshot = Schema.Struct({
  threadId: ThreadId,
  model: Schema.optional(TrimmedNonEmptyString),
  contextWindowTokens: PositiveInt,
  usedTokens: NonNegativeInt,
  percentUsed: PercentNumber,
  level: ContextMeterLevel,
  warningThresholdPercent: PercentNumber,
  criticalThresholdPercent: PercentNumber,
  updatedAt: Schema.NullOr(IsoDateTime),
  history: Schema.Array(ContextMeterTurnUsage),
});
export type ContextMeterSnapshot = typeof ContextMeterSnapshot.Type;

export const ContextMeterGetInput = Schema.Struct({
  threadId: ThreadId,
});
export type ContextMeterGetInput = typeof ContextMeterGetInput.Type;

export const ContextMeterGetResult = Schema.Struct({
  snapshot: ContextMeterSnapshot,
});
export type ContextMeterGetResult = typeof ContextMeterGetResult.Type;
