import { describe, expect, it } from "vitest";

import { type ServerProviderStatus } from "@t3tools/contracts";

import {
  findProviderStatus,
  resolveProviderStatusForChat,
  shouldBlockUnavailableKimiSend,
} from "./providerStatus";

const PROVIDER_STATUSES: ServerProviderStatus[] = [
  {
    provider: "codex",
    status: "ready",
    available: true,
    authStatus: "authenticated",
    checkedAt: "2026-03-08T00:00:00.000Z",
  },
  {
    provider: "copilot",
    status: "warning",
    available: true,
    authStatus: "unknown",
    checkedAt: "2026-03-08T00:00:00.000Z",
    message: "Copilot warning",
  },
  {
    provider: "kimi",
    status: "error",
    available: false,
    authStatus: "unknown",
    checkedAt: "2026-03-08T00:00:00.000Z",
    message: "Kimi Code CLI (`kimi`) is not installed or not on PATH.",
  },
];

describe("findProviderStatus", () => {
  it("returns the matching provider status", () => {
    expect(findProviderStatus(PROVIDER_STATUSES, "kimi")).toEqual(PROVIDER_STATUSES[2]);
  });
});

describe("resolveProviderStatusForChat", () => {
  it("uses the selected provider before a session has started", () => {
    expect(
      resolveProviderStatusForChat({
        providerStatuses: PROVIDER_STATUSES,
        selectedProvider: "kimi",
        sessionProvider: null,
      }),
    ).toEqual(PROVIDER_STATUSES[2]);
  });

  it("prefers the active session provider once a session exists", () => {
    expect(
      resolveProviderStatusForChat({
        providerStatuses: PROVIDER_STATUSES,
        selectedProvider: "kimi",
        sessionProvider: "copilot",
      }),
    ).toEqual(PROVIDER_STATUSES[1]);
  });
});

describe("shouldBlockUnavailableKimiSend", () => {
  it("blocks sends when Kimi is unavailable and no custom binary path is set", () => {
    expect(
      shouldBlockUnavailableKimiSend({
        status: PROVIDER_STATUSES[2] ?? null,
        binaryPath: "",
      }),
    ).toBe(true);
  });

  it("allows sends when a custom binary path is configured", () => {
    expect(
      shouldBlockUnavailableKimiSend({
        status: PROVIDER_STATUSES[2] ?? null,
        binaryPath: "/opt/kimi/bin/kimi",
      }),
    ).toBe(false);
  });

  it("does not block warnings or healthy providers", () => {
    expect(
      shouldBlockUnavailableKimiSend({
        status: PROVIDER_STATUSES[1] ?? null,
        binaryPath: "",
      }),
    ).toBe(false);
    expect(
      shouldBlockUnavailableKimiSend({
        status: PROVIDER_STATUSES[0] ?? null,
        binaryPath: "",
      }),
    ).toBe(false);
  });
});
