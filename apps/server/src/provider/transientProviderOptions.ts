import type { CommandId, ProviderStartOptions } from "@t3tools/contracts";

const TURN_START_OPTIONS_TTL_MS = 5 * 60 * 1000;

const entries = new Map<
  CommandId,
  {
    readonly providerOptions: ProviderStartOptions;
    readonly expiresAt: number;
  }
>();

function pruneExpired(now = Date.now()) {
  for (const [commandId, entry] of entries) {
    if (entry.expiresAt <= now) {
      entries.delete(commandId);
    }
  }
}

export function putTransientTurnStartProviderOptions(
  commandId: CommandId,
  providerOptions: ProviderStartOptions,
): void {
  const now = Date.now();
  pruneExpired(now);
  entries.set(commandId, {
    providerOptions,
    expiresAt: now + TURN_START_OPTIONS_TTL_MS,
  });
}

export function takeTransientTurnStartProviderOptions(
  commandId: CommandId,
): ProviderStartOptions | undefined {
  const now = Date.now();
  pruneExpired(now);

  const entry = entries.get(commandId);
  if (!entry) {
    return undefined;
  }

  entries.delete(commandId);
  return entry.providerOptions;
}

export function clearTransientTurnStartProviderOptions(): void {
  entries.clear();
}
