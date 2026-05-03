export const ACCESS_TOKEN_KEY = "fm_access_token";
export const REFRESH_TOKEN_KEY = "fm_refresh_token";

export const AUTH_CHANGED_EVENT = "fm-auth-changed";

function emitAuthChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getAccessToken(): string {
  if (typeof localStorage === "undefined") {
    return "";
  }
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
}

const JWT_SKEW_MS = 30_000;

function isLikelyJwt(token: string): boolean {
  return token.split(".").length === 3;
}

/**
 * True if the access token is a JWT and its `exp` is in the past (with skew).
 * Non-JWT or unparseable tokens are treated as not expired (API validates).
 */
export function isAccessJwtExpired(token: string, skewMs = JWT_SKEW_MS): boolean {
  if (!isLikelyJwt(token)) {
    return false;
  }
  try {
    const parts = token.split(".");
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") {
      return false;
    }
    return Date.now() >= payload.exp * 1000 - skewMs;
  } catch {
    return false;
  }
}

/**
 * Access token to use for session / UI auth: empty if missing or JWT is expired.
 * Opaque (non-JWT) tokens are returned as-is.
 */
export function getEffectiveAccessTokenForSession(): string {
  const t = getAccessToken();
  if (!t) {
    return "";
  }
  if (isAccessJwtExpired(t)) {
    return "";
  }
  return t;
}

export function getRefreshToken(): string {
  if (typeof localStorage === "undefined") {
    return "";
  }
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? "";
}

/** True when the user should be treated as signed in for routing / offline shell (refresh may still refresh access lazily). */
export function hasOfflineSession(): boolean {
  return Boolean(getRefreshToken()) || Boolean(getEffectiveAccessTokenForSession());
}

export function setSession(tokens: { access: string; refresh: string }): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  emitAuthChanged();
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  emitAuthChanged();
}

/** @deprecated use getAccessToken */
export function getToken(): string {
  return getAccessToken();
}

/** @deprecated use setSession */
export function setToken(token: string): void {
  const r = getRefreshToken();
  setSession({ access: token, refresh: r });
}

/** @deprecated use clearSession */
export function clearToken(): void {
  clearSession();
}
