import { getWsAuthToken, withoutWsAuthToken, withWsAuthToken } from "@t3tools/shared/wsAuth";

let cachedLocationAuthToken: string | null | undefined;
let cachedLocationAuthSearch = "";
let hasStrippedLocationAuthToken = false;

export function resolveWindowUrl(): URL | null {
  if (typeof window === "undefined") {
    return null;
  }

  const href = window.location.href;
  if (typeof href === "string" && href.length > 0) {
    try {
      return new URL(href);
    } catch {
      // Fall through to the structured location fields below.
    }
  }

  const protocol = window.location.protocol ?? "http:";
  const hostname = window.location.hostname ?? "localhost";
  const port = window.location.port ? `:${window.location.port}` : "";
  const pathname = window.location.pathname ?? "/";
  const search = window.location.search ?? "";
  const hash = window.location.hash ?? "";

  try {
    return new URL(`${protocol}//${hostname}${port}${pathname}${search}${hash}`);
  } catch {
    return null;
  }
}

export function resolveLocationAuthToken(options?: { stripFromLocation?: boolean }): string | null {
  const stripFromLocation = options?.stripFromLocation === true;
  const windowUrl = resolveWindowUrl();
  const currentSearch = windowUrl?.search ?? "";
  const currentAuthToken = windowUrl ? getWsAuthToken(windowUrl) : null;

  if (cachedLocationAuthSearch !== currentSearch) {
    if (currentAuthToken !== null || !hasStrippedLocationAuthToken) {
      cachedLocationAuthToken = currentAuthToken;
    }
    cachedLocationAuthSearch = currentSearch;
    if (currentAuthToken !== null) {
      hasStrippedLocationAuthToken = false;
    }
  } else if (cachedLocationAuthToken === undefined) {
    cachedLocationAuthToken = currentAuthToken;
  }

  if (
    !stripFromLocation ||
    cachedLocationAuthToken === null ||
    !windowUrl ||
    typeof window === "undefined" ||
    hasStrippedLocationAuthToken
  ) {
    return cachedLocationAuthToken ?? null;
  }

  try {
    const sanitizedUrl = new URL(withoutWsAuthToken(windowUrl));
    const replacement = `${sanitizedUrl.pathname}${sanitizedUrl.search}${sanitizedUrl.hash}`;
    window.history.replaceState(window.history.state, "", replacement);
    hasStrippedLocationAuthToken = true;
  } catch {
    // Best-effort cleanup only.
  }

  return cachedLocationAuthToken ?? null;
}

export function resolveConfiguredWsUrl(options?: { stripLocationToken?: boolean }): string {
  if (typeof window === "undefined") {
    return "";
  }

  const authToken = resolveLocationAuthToken({
    stripFromLocation: options?.stripLocationToken === true,
  });
  const bridgeUrl = window.desktopBridge?.getWsUrl();
  if (bridgeUrl && bridgeUrl.length > 0) {
    return withWsAuthToken(bridgeUrl, authToken);
  }

  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl && envUrl.length > 0) {
    return withWsAuthToken(envUrl, authToken);
  }

  const windowUrl = resolveWindowUrl();
  const protocol = windowUrl?.protocol ?? window.location.protocol ?? "http:";
  const hostname = windowUrl?.hostname ?? window.location.hostname ?? "localhost";
  const port = windowUrl?.port
    ? `:${windowUrl.port}`
    : window.location.port
      ? `:${window.location.port}`
      : "";
  return withWsAuthToken(`${protocol === "https:" ? "wss" : "ws"}://${hostname}${port}`, authToken);
}

function normalizeRoutePath(routePath: string): URL {
  return new URL(routePath, "http://localhost");
}

export function deriveHttpUrlFromWsUrl(input: {
  wsUrl: string | URL;
  routePath: string;
  preserveAuthToken?: boolean;
}): string {
  const wsUrl = typeof input.wsUrl === "string" ? new URL(input.wsUrl) : new URL(input.wsUrl);
  const httpUrl = new URL(wsUrl);
  httpUrl.protocol =
    httpUrl.protocol === "wss:"
      ? "https:"
      : httpUrl.protocol === "ws:"
        ? "http:"
        : httpUrl.protocol;

  const routeUrl = normalizeRoutePath(input.routePath);
  const basePath = httpUrl.pathname === "/" ? "" : httpUrl.pathname.replace(/\/$/, "");
  httpUrl.pathname = `${basePath}${routeUrl.pathname}` || "/";

  const searchParams = new URLSearchParams(routeUrl.search);
  if (input.preserveAuthToken !== false) {
    const authToken = getWsAuthToken(wsUrl);
    if (authToken && !searchParams.has("token")) {
      searchParams.set("token", authToken);
    }
  }
  httpUrl.search = searchParams.toString() ? `?${searchParams.toString()}` : "";
  httpUrl.hash = "";
  return httpUrl.toString();
}

export function resolveServerHttpUrl(
  routePath: string,
  options?: { preserveAuthToken?: boolean },
): string {
  const wsUrl = resolveConfiguredWsUrl();
  if (!wsUrl) {
    return routePath;
  }
  return deriveHttpUrlFromWsUrl(
    options?.preserveAuthToken === undefined
      ? { wsUrl, routePath }
      : { wsUrl, routePath, preserveAuthToken: options.preserveAuthToken },
  );
}
