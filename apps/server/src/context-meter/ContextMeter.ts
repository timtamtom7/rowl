import {
  type ContextMeterConfig as ContractContextMeterConfig,
  type ContextMeterLevel,
  type ContextMeterSnapshot,
  type ContextMeterTurnUsage,
  type ProviderKind,
  type ThreadId,
  type TurnId,
} from "@t3tools/contracts";
import { getModelContextWindowInfo } from "@t3tools/shared/model";
import { Data, ServiceMap } from "effect";
import type { Effect } from "effect";

export type ContextMeterConfig = ContractContextMeterConfig;

export const DEFAULT_CONTEXT_METER_CONFIG: ContextMeterConfig = {
  defaultContextWindowTokens: 200_000,
  warningThresholdPercent: 70,
  criticalThresholdPercent: 90,
  historyLimit: 20,
  modelContextWindowTokens: {},
};

export class ContextMeterError extends Data.TaggedError("ContextMeterError")<{
  readonly operation: "read" | "write";
  readonly cause: unknown;
}> {}

export interface ContextMeterRecordInput {
  readonly threadId: ThreadId;
  readonly turnId?: TurnId;
  readonly provider?: ProviderKind;
  readonly model?: string;
  readonly usage: unknown;
  readonly contextWindowTokens?: number;
  readonly observedAt?: string;
}

export interface ContextMeterGetInput {
  readonly threadId: ThreadId;
  readonly model?: string;
  readonly provider?: ProviderKind;
  readonly contextWindowTokens?: number;
}

export interface ContextMeterShape {
  readonly getSnapshot: (
    input: ContextMeterGetInput,
  ) => Effect.Effect<ContextMeterSnapshot, ContextMeterError>;
  readonly recordTurnUsage: (
    input: ContextMeterRecordInput,
  ) => Effect.Effect<ContextMeterSnapshot, ContextMeterError>;
}

export class ContextMeter extends ServiceMap.Service<ContextMeter, ContextMeterShape>()(
  "rowl/context-meter/ContextMeter",
) {}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function firstNumber(
  records: ReadonlyArray<Record<string, unknown> | null>,
  keys: ReadonlyArray<string>,
): number | null {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = nonNegativeNumber(record[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

export function extractTokenUsage(value: unknown): {
  readonly usedTokens: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly contextWindowTokens: number | null;
} {
  const root = asRecord(value);
  const usage = asRecord(root?.usage ?? root?.tokenUsage ?? root?.token_usage ?? value);
  const nested = asRecord(usage?.tokenUsage ?? usage?.token_usage ?? null);
  const last =
    asRecord(usage?.last ?? usage?.lastTokenUsage ?? usage?.last_token_usage ?? null) ??
    asRecord(nested?.last ?? nested?.lastTokenUsage ?? nested?.last_token_usage ?? null);
  const records = [usage, nested, last, root];

  const inputTokens = firstNumber(records, [
    "inputTokens",
    "input_tokens",
    "promptTokens",
    "prompt_tokens",
    "prompt_token_count",
    "lastInputTokens",
    "last_input_tokens",
  ]);
  const outputTokens = firstNumber(records, [
    "outputTokens",
    "output_tokens",
    "completionTokens",
    "completion_tokens",
    "candidates_token_count",
    "lastOutputTokens",
    "last_output_tokens",
  ]);
  const directTotal = firstNumber(records, [
    "usedTokens",
    "used_tokens",
    "totalTokens",
    "total_tokens",
    "totalTokenCount",
    "total_token_count",
    "lastUsedTokens",
    "last_used_tokens",
  ]);
  const summedTotal =
    inputTokens !== null || outputTokens !== null ? (inputTokens ?? 0) + (outputTokens ?? 0) : null;
  const contextWindowTokens = firstNumber(records, [
    "maxTokens",
    "max_tokens",
    "contextWindow",
    "context_window",
    "contextWindowTokens",
    "context_window_tokens",
    "modelContextWindow",
    "model_context_window",
  ]);

  return {
    usedTokens: directTotal ?? summedTotal,
    inputTokens,
    outputTokens,
    contextWindowTokens: positiveNumber(contextWindowTokens),
  };
}

export function resolveContextWindowTokens(input: {
  readonly config: ContextMeterConfig;
  readonly model?: string;
  readonly provider?: ProviderKind;
  readonly explicitTokens?: number | null;
  readonly reportedTokens?: number | null;
}): number {
  const explicitTokens = positiveNumber(input.explicitTokens);
  if (explicitTokens !== null) return Math.round(explicitTokens);

  const reportedTokens = positiveNumber(input.reportedTokens);
  if (reportedTokens !== null) return Math.round(reportedTokens);

  const model = input.model?.trim();
  if (model) {
    const configured = positiveNumber(input.config.modelContextWindowTokens[model]);
    if (configured !== null) return Math.round(configured);
  }

  if (model && input.provider) {
    const documented = getModelContextWindowInfo(model, input.provider)?.totalTokens;
    if (typeof documented === "number" && Number.isFinite(documented) && documented > 0) {
      return Math.round(documented);
    }
  }

  return input.config.defaultContextWindowTokens;
}

export function calculateContextMeterLevel(input: {
  readonly percentUsed: number;
  readonly warningThresholdPercent: number;
  readonly criticalThresholdPercent: number;
}): ContextMeterLevel {
  if (input.percentUsed >= input.criticalThresholdPercent) return "critical";
  if (input.percentUsed >= input.warningThresholdPercent) return "warning";
  return "ok";
}

export function createEmptyContextMeterSnapshot(input: {
  readonly threadId: ThreadId;
  readonly config: ContextMeterConfig;
  readonly model?: string;
  readonly provider?: ProviderKind;
  readonly contextWindowTokens?: number;
}): ContextMeterSnapshot {
  const contextWindowTokens = resolveContextWindowTokens({
    config: input.config,
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.provider !== undefined ? { provider: input.provider } : {}),
    explicitTokens: input.contextWindowTokens ?? null,
  });
  return {
    threadId: input.threadId,
    ...(input.model !== undefined ? { model: input.model } : {}),
    contextWindowTokens,
    usedTokens: 0,
    percentUsed: 0,
    level: "ok",
    warningThresholdPercent: input.config.warningThresholdPercent,
    criticalThresholdPercent: input.config.criticalThresholdPercent,
    updatedAt: null,
    history: [],
  };
}

export function appendContextMeterTurnUsage(input: {
  readonly snapshot: ContextMeterSnapshot;
  readonly config: ContextMeterConfig;
  readonly usage: ContextMeterTurnUsage;
}): ContextMeterSnapshot {
  const history = [...input.snapshot.history, input.usage].slice(-input.config.historyLimit);
  return {
    ...input.snapshot,
    ...(input.usage.model !== undefined ? { model: input.usage.model } : {}),
    contextWindowTokens: input.usage.contextWindowTokens,
    usedTokens: input.usage.usedTokens,
    percentUsed: input.usage.percentUsed,
    level: input.usage.level,
    warningThresholdPercent: input.config.warningThresholdPercent,
    criticalThresholdPercent: input.config.criticalThresholdPercent,
    updatedAt: input.usage.observedAt,
    history,
  };
}

export function createContextMeterTurnUsage(input: {
  readonly config: ContextMeterConfig;
  readonly threadId: ThreadId;
  readonly turnId?: TurnId;
  readonly provider?: ProviderKind;
  readonly model?: string;
  readonly usage: unknown;
  readonly contextWindowTokens?: number;
  readonly observedAt: string;
}): ContextMeterTurnUsage | null {
  const extracted = extractTokenUsage(input.usage);
  if (extracted.usedTokens === null) {
    return null;
  }
  const contextWindowTokens = resolveContextWindowTokens({
    config: input.config,
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.provider !== undefined ? { provider: input.provider } : {}),
    explicitTokens: input.contextWindowTokens ?? null,
    reportedTokens: extracted.contextWindowTokens,
  });
  const usedTokens = Math.max(0, Math.round(extracted.usedTokens));
  const percentUsed = Math.min(100, Math.max(0, (usedTokens / contextWindowTokens) * 100));
  const level = calculateContextMeterLevel({
    percentUsed,
    warningThresholdPercent: input.config.warningThresholdPercent,
    criticalThresholdPercent: input.config.criticalThresholdPercent,
  });

  return {
    ...(input.turnId !== undefined ? { turnId: input.turnId } : {}),
    ...(input.provider !== undefined ? { provider: input.provider } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(extracted.inputTokens !== null ? { inputTokens: Math.round(extracted.inputTokens) } : {}),
    ...(extracted.outputTokens !== null
      ? { outputTokens: Math.round(extracted.outputTokens) }
      : {}),
    usedTokens,
    contextWindowTokens,
    percentUsed,
    level,
    observedAt: input.observedAt,
  };
}
