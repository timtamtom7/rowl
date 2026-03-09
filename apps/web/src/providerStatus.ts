import { type ProviderKind, type ServerProviderStatus } from "@t3tools/contracts";

function isProviderKind(value: string | null | undefined): value is ProviderKind {
  return value === "codex" || value === "copilot" || value === "kimi";
}

export function findProviderStatus(
  providerStatuses: ReadonlyArray<ServerProviderStatus>,
  provider: ProviderKind,
): ServerProviderStatus | null {
  return providerStatuses.find((status) => status.provider === provider) ?? null;
}

export function resolveProviderStatusForChat(input: {
  readonly providerStatuses: ReadonlyArray<ServerProviderStatus>;
  readonly selectedProvider: ProviderKind;
  readonly sessionProvider?: string | null;
}): ServerProviderStatus | null {
  const provider = isProviderKind(input.sessionProvider)
    ? input.sessionProvider
    : input.selectedProvider;
  return findProviderStatus(input.providerStatuses, provider);
}

export function shouldBlockUnavailableKimiSend(input: {
  readonly status: ServerProviderStatus | null;
  readonly binaryPath: string;
}): boolean {
  return (
    input.binaryPath.trim().length === 0 &&
    input.status?.provider === "kimi" &&
    input.status.status === "error" &&
    input.status.available === false
  );
}
