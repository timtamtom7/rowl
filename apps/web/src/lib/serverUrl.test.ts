import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  vi.resetModules();
});

describe("deriveHttpUrlFromWsUrl", () => {
  it("preserves path prefixes and only forwards the auth token", async () => {
    const { deriveHttpUrlFromWsUrl } = await import("./serverUrl");

    expect(
      deriveHttpUrlFromWsUrl({
        wsUrl: "wss://example.com/t3?token=secret-token&view=settings",
        routePath: "/attachments/abc",
      }),
    ).toBe("https://example.com/t3/attachments/abc?token=secret-token");
  });

  it("preserves route query params while appending the auth token", async () => {
    const { deriveHttpUrlFromWsUrl } = await import("./serverUrl");

    expect(
      deriveHttpUrlFromWsUrl({
        wsUrl: "ws://127.0.0.1:3773/base/?token=secret-token&view=settings",
        routePath: "/api/project-favicon?cwd=%2Ftmp%2Fproject",
      }),
    ).toBe(
      "http://127.0.0.1:3773/base/api/project-favicon?cwd=%2Ftmp%2Fproject&token=secret-token",
    );
  });
});

describe("resolveConfiguredWsUrl", () => {
  it("strips the page token from the visible URL while keeping it for future websocket requests", async () => {
    const replaceState = vi.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          href: "http://localhost:3020/chat?token=secret-token&view=settings#plans",
          protocol: "http:",
          hostname: "localhost",
          port: "3020",
          pathname: "/chat",
          search: "?token=secret-token&view=settings",
          hash: "#plans",
        },
        history: {
          state: null,
          replaceState,
        },
        desktopBridge: {
          getWsUrl: () => "ws://127.0.0.1:3773/base/",
        },
      },
    });

    const { resolveConfiguredWsUrl } = await import("./serverUrl");

    expect(resolveConfiguredWsUrl({ stripLocationToken: true })).toBe(
      "ws://127.0.0.1:3773/base/?token=secret-token",
    );
    expect(resolveConfiguredWsUrl()).toBe("ws://127.0.0.1:3773/base/?token=secret-token");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/chat?view=settings#plans");
  });
});
