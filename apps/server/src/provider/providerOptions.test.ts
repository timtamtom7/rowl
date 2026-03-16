import { describe, expect, it } from "vitest";

import {
  sanitizeProviderOptionsForPersistence,
  sanitizeProviderOptionsRecordForPersistence,
} from "./providerOptions";

describe("sanitizeProviderOptionsForPersistence", () => {
  it("strips OpenRouter API keys before persisting provider options", () => {
    expect(
      sanitizeProviderOptionsForPersistence({
        codex: {
          binaryPath: "/tmp/codex",
          homePath: "/tmp/.codex",
          openRouterApiKey: "sk-or-secret",
        },
      }),
    ).toEqual({
      codex: {
        binaryPath: "/tmp/codex",
        homePath: "/tmp/.codex",
      },
    });
  });
});

describe("sanitizeProviderOptionsRecordForPersistence", () => {
  it("drops untrusted OpenRouter API keys from runtime payloads", () => {
    expect(
      sanitizeProviderOptionsRecordForPersistence({
        codex: {
          binaryPath: "/tmp/codex",
          homePath: "/tmp/.codex",
          openRouterApiKey: "sk-or-secret",
        },
      }),
    ).toEqual({
      codex: {
        binaryPath: "/tmp/codex",
        homePath: "/tmp/.codex",
      },
    });
  });
});
