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

export function getRefreshToken(): string {
  if (typeof localStorage === "undefined") {
    return "";
  }
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? "";
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
