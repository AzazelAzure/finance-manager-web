import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  clearSession,
  getEffectiveAccessTokenForSession,
  hasOfflineSession,
  setSession,
} from "./auth";

function installMemoryStorage(): void {
  const store: Record<string, string> = {};
  vi.stubGlobal(
    "localStorage",
    {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) {
          delete store[k];
        }
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length;
      },
    } as Storage,
  );
}

describe("hasOfflineSession / offline-first auth", () => {
  beforeEach(() => {
    installMemoryStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is true when refresh token exists even if access is missing", () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, "opaque-refresh");
    expect(hasOfflineSession()).toBe(true);
    expect(getEffectiveAccessTokenForSession()).toBe("");
  });

  it("is true when non-expired access JWT exists", () => {
    const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp }));
    const jwt = `${header}.${payload}.sig`;
    localStorage.setItem(ACCESS_TOKEN_KEY, jwt);
    expect(hasOfflineSession()).toBe(true);
    expect(getEffectiveAccessTokenForSession()).toBe(jwt);
  });

  it("is false after clearSession", () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, "r");
    clearSession();
    expect(hasOfflineSession()).toBe(false);
  });

  it("is true after setSession with both tokens", () => {
    setSession({ access: "a", refresh: "r" });
    expect(hasOfflineSession()).toBe(true);
  });
});
