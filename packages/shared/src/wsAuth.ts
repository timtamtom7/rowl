export const WS_AUTH_TOKEN_QUERY_PARAM = "token";

function redactTokenFromSearchParams(searchParams: URLSearchParams): boolean {
  if (!searchParams.has(WS_AUTH_TOKEN_QUERY_PARAM)) {
    return false;
  }
  searchParams.delete(WS_AUTH_TOKEN_QUERY_PARAM);
  return true;
}

export function getWsAuthToken(value: string | URL): string | null {
  try {
    const url = typeof value === "string" ? new URL(value) : value;
    const token = url.searchParams.get(WS_AUTH_TOKEN_QUERY_PARAM)?.trim() ?? "";
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function withWsAuthToken(urlValue: string | URL, token: string | null | undefined): string {
  const trimmedToken = token?.trim() ?? "";
  if (trimmedToken.length === 0) {
    return typeof urlValue === "string" ? urlValue : urlValue.toString();
  }

  const url = typeof urlValue === "string" ? new URL(urlValue) : new URL(urlValue.toString());
  if (!url.searchParams.has(WS_AUTH_TOKEN_QUERY_PARAM)) {
    url.searchParams.set(WS_AUTH_TOKEN_QUERY_PARAM, trimmedToken);
  }
  return url.toString();
}

export function withoutWsAuthToken(urlValue: string | URL): string {
  const url = typeof urlValue === "string" ? new URL(urlValue) : new URL(urlValue.toString());
  url.searchParams.delete(WS_AUTH_TOKEN_QUERY_PARAM);
  return url.toString();
}

export function redactWsAuthToken(value: string | URL | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof URL) {
    return withoutWsAuthToken(value);
  }

  try {
    return withoutWsAuthToken(value);
  } catch {
    try {
      const relativeUrl = new URL(value, "http://localhost");
      if (!redactTokenFromSearchParams(relativeUrl.searchParams)) {
        return value;
      }
      return `${relativeUrl.pathname}${relativeUrl.search}${relativeUrl.hash}`;
    } catch {
      return value.replace(
        /([?&])token=[^&#]*(&)?/g,
        (_match, prefix: string, suffix: string | undefined) => {
          if (prefix === "?" && suffix) {
            return "?";
          }
          return suffix ? prefix : "";
        },
      );
    }
  }
}
