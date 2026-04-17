import type { ProviderStartOptions } from "@t3tools/contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export interface PersistedProviderSecretRequirements {
  readonly codex?: {
    readonly openRouterApiKey?: true;
  };
  readonly kimi?: {
    readonly apiKey?: true;
  };
  readonly minimax?: {
    readonly apiKey?: true;
  };
  readonly opencode?: {
    readonly openRouterApiKey?: true;
  };
}

function trimSecret(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function sanitizeProviderOptionsForPersistence(
  providerOptions: ProviderStartOptions | undefined,
): ProviderStartOptions | undefined {
  if (!providerOptions) {
    return undefined;
  }

  const kilocode = providerOptions.kilocode?.binaryPath
    ? { kilocode: { binaryPath: providerOptions.kilocode.binaryPath } }
    : {};
  const kimi = providerOptions.kimi?.binaryPath
    ? { kimi: { binaryPath: providerOptions.kimi.binaryPath } }
    : {};
  const opencode = providerOptions.opencode?.binaryPath
    ? { opencode: { binaryPath: providerOptions.opencode.binaryPath } }
    : {};
  const next = {
    ...(providerOptions.codex
      ? {
          codex: {
            ...(providerOptions.codex.binaryPath
              ? { binaryPath: providerOptions.codex.binaryPath }
              : {}),
            ...(providerOptions.codex.homePath ? { homePath: providerOptions.codex.homePath } : {}),
          },
        }
      : {}),
    ...(providerOptions.copilot ? { copilot: providerOptions.copilot } : {}),
    ...kilocode,
    ...kimi,
    ...opencode,
  } satisfies ProviderStartOptions;

  return Object.keys(next).length > 0 ? next : undefined;
}

export function sanitizeProviderOptionsRecordForPersistence(
  providerOptions: unknown,
): ProviderStartOptions | undefined {
  if (!isRecord(providerOptions)) {
    return undefined;
  }

  const next: Record<string, unknown> = {};

  if (isRecord(providerOptions.codex)) {
    const codex: Record<string, unknown> = {};
    if (typeof providerOptions.codex.binaryPath === "string") {
      codex.binaryPath = providerOptions.codex.binaryPath;
    }
    if (typeof providerOptions.codex.homePath === "string") {
      codex.homePath = providerOptions.codex.homePath;
    }
    if (Object.keys(codex).length > 0) {
      next.codex = codex;
    }
  }

  if (isRecord(providerOptions.copilot)) {
    const copilot: Record<string, unknown> = {};
    if (typeof providerOptions.copilot.binaryPath === "string") {
      copilot.binaryPath = providerOptions.copilot.binaryPath;
    }
    if (Object.keys(copilot).length > 0) {
      next.copilot = copilot;
    }
  }

  if (isRecord(providerOptions.kilocode)) {
    const kilocode: Record<string, unknown> = {};
    if (typeof providerOptions.kilocode.binaryPath === "string") {
      kilocode.binaryPath = providerOptions.kilocode.binaryPath;
    }
    if (Object.keys(kilocode).length > 0) {
      next.kilocode = kilocode;
    }
  }

  if (isRecord(providerOptions.kimi)) {
    const kimi: Record<string, unknown> = {};
    if (typeof providerOptions.kimi.binaryPath === "string") {
      kimi.binaryPath = providerOptions.kimi.binaryPath;
    }
    if (Object.keys(kimi).length > 0) {
      next.kimi = kimi;
    }
  }

  if (isRecord(providerOptions.opencode)) {
    const opencode: Record<string, unknown> = {};
    if (typeof providerOptions.opencode.binaryPath === "string") {
      opencode.binaryPath = providerOptions.opencode.binaryPath;
    }
    if (Object.keys(opencode).length > 0) {
      next.opencode = opencode;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function deriveProviderSecretRequirements(
  providerOptions: ProviderStartOptions | undefined,
): PersistedProviderSecretRequirements | undefined {
  if (!providerOptions) {
    return undefined;
  }

  const next = {
    ...(trimSecret(providerOptions.codex?.openRouterApiKey)
      ? { codex: { openRouterApiKey: true as const } }
      : {}),
    ...(trimSecret(providerOptions.opencode?.openRouterApiKey)
      ? { opencode: { openRouterApiKey: true as const } }
      : {}),
    ...(trimSecret(providerOptions.kimi?.apiKey) ? { kimi: { apiKey: true as const } } : {}),
    ...(trimSecret(providerOptions.minimax?.apiKey) ? { minimax: { apiKey: true as const } } : {}),
  } satisfies PersistedProviderSecretRequirements;

  return Object.keys(next).length > 0 ? next : undefined;
}

export function sanitizeProviderSecretRequirementsRecord(
  value: unknown,
): PersistedProviderSecretRequirements | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const next = {
    ...(isRecord(value.codex) && value.codex.openRouterApiKey === true
      ? { codex: { openRouterApiKey: true as const } }
      : {}),
    ...(isRecord(value.opencode) && value.opencode.openRouterApiKey === true
      ? { opencode: { openRouterApiKey: true as const } }
      : {}),
    ...(isRecord(value.kimi) && value.kimi.apiKey === true
      ? { kimi: { apiKey: true as const } }
      : {}),
    ...(isRecord(value.minimax) && value.minimax.apiKey === true
      ? { minimax: { apiKey: true as const } }
      : {}),
  } satisfies PersistedProviderSecretRequirements;

  return Object.keys(next).length > 0 ? next : undefined;
}

export function hydrateProviderOptionsWithEnvironment(input: {
  readonly providerOptions: ProviderStartOptions | undefined;
  readonly secretRequirements: PersistedProviderSecretRequirements | undefined;
  readonly env?: NodeJS.ProcessEnv;
}): {
  readonly providerOptions: ProviderStartOptions | undefined;
  readonly missingSecrets: ReadonlyArray<string>;
} {
  const env = input.env ?? process.env;
  const openRouterApiKey = trimSecret(env.OPENROUTER_API_KEY);
  const kimiApiKey = trimSecret(env.KIMI_API_KEY);
  const minimaxApiKey = trimSecret(env.MINIMAX_API_KEY);
  const missingSecrets = new Set<string>();
  const providerOptions: Record<string, unknown> = {
    ...(input.providerOptions?.codex ? { codex: { ...input.providerOptions.codex } } : {}),
    ...(input.providerOptions?.copilot ? { copilot: { ...input.providerOptions.copilot } } : {}),
    ...(input.providerOptions?.kilocode ? { kilocode: { ...input.providerOptions.kilocode } } : {}),
    ...(input.providerOptions?.kimi ? { kimi: { ...input.providerOptions.kimi } } : {}),
    ...(input.providerOptions?.minimax ? { minimax: { ...input.providerOptions.minimax } } : {}),
    ...(input.providerOptions?.opencode ? { opencode: { ...input.providerOptions.opencode } } : {}),
  };

  if (input.secretRequirements?.codex?.openRouterApiKey) {
    if (openRouterApiKey) {
      const existingCodex = isRecord(providerOptions.codex) ? providerOptions.codex : {};
      providerOptions.codex = {
        ...existingCodex,
        openRouterApiKey,
      };
    } else {
      missingSecrets.add("OPENROUTER_API_KEY");
    }
  }

  if (input.secretRequirements?.opencode?.openRouterApiKey) {
    if (openRouterApiKey) {
      const existingOpenCode = isRecord(providerOptions.opencode) ? providerOptions.opencode : {};
      providerOptions.opencode = {
        ...existingOpenCode,
        openRouterApiKey,
      };
    } else {
      missingSecrets.add("OPENROUTER_API_KEY");
    }
  }

  if (input.secretRequirements?.kimi?.apiKey) {
    if (kimiApiKey) {
      const existingKimi = isRecord(providerOptions.kimi) ? providerOptions.kimi : {};
      providerOptions.kimi = {
        ...existingKimi,
        apiKey: kimiApiKey,
      };
    } else {
      missingSecrets.add("KIMI_API_KEY");
    }
  }

  if (input.secretRequirements?.minimax?.apiKey) {
    if (minimaxApiKey) {
      const existingMiniMax = isRecord(providerOptions.minimax) ? providerOptions.minimax : {};
      providerOptions.minimax = {
        ...existingMiniMax,
        apiKey: minimaxApiKey,
      };
    } else {
      missingSecrets.add("MINIMAX_API_KEY");
    }
  }

  return {
    providerOptions:
      Object.keys(providerOptions).length > 0
        ? (providerOptions as ProviderStartOptions)
        : undefined,
    missingSecrets: [...missingSecrets],
  };
}
