import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ACCESS_TOKEN_KEY,
  AUTH_CHANGED_EVENT,
  REFRESH_TOKEN_KEY,
  clearSession,
  getEffectiveAccessTokenForSession,
  hasOfflineSession,
} from "./auth";

function subscribeSession(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const onStorage = (e: StorageEvent): void => {
    if (e.key === ACCESS_TOKEN_KEY || e.key === REFRESH_TOKEN_KEY) {
      cb();
    }
  };
  const onChanged = (): void => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_CHANGED_EVENT, onChanged);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTH_CHANGED_EVENT, onChanged);
  };
}

function getSessionAuthenticatedSnapshot(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return hasOfflineSession();
}

type SessionValue = {
  isAuthenticated: boolean;
  accessToken: string;
  logout: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

function CrossTabLogoutHandler(): null {
  const queryClient = useQueryClient();
  const isAuthenticated = useSyncExternalStore(
    subscribeSession,
    getSessionAuthenticatedSnapshot,
    getSessionAuthenticatedSnapshot,
  );
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== ACCESS_TOKEN_KEY && e.key !== REFRESH_TOKEN_KEY) {
        return;
      }
      if (e.key === REFRESH_TOKEN_KEY && !e.newValue) {
        clearSession();
        queryClient.clear();
        return;
      }
      if (e.key === ACCESS_TOKEN_KEY && !e.newValue && !localStorage.getItem(REFRESH_TOKEN_KEY)) {
        clearSession();
        queryClient.clear();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isAuthenticated, queryClient]);
  return null;
}

export function SessionProvider({ children }: { children: ReactNode }): ReactNode {
  /** Effective access for display; may be empty while refresh-only until first lazy refresh. */
  const accessToken = useSyncExternalStore(
    subscribeSession,
    () => (typeof window === "undefined" ? "" : getEffectiveAccessTokenForSession()),
    () => (typeof window === "undefined" ? "" : getEffectiveAccessTokenForSession()),
  );
  const isAuthenticated = useSyncExternalStore(
    subscribeSession,
    getSessionAuthenticatedSnapshot,
    getSessionAuthenticatedSnapshot,
  );
  const queryClient = useQueryClient();

  const logout = useCallback((): void => {
    clearSession();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SessionValue>(
    () => ({ isAuthenticated, accessToken, logout }),
    [isAuthenticated, accessToken, logout],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      <CrossTabLogoutHandler />
    </SessionContext.Provider>
  );
}

/* eslint-disable react-refresh/only-export-components -- session hooks live with provider */
export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) {
    throw new Error("useSession must be used under SessionProvider");
  }
  return v;
}

/** For routes that can render outside provider (e.g. tests) — uses same store. */
export function useSessionOptional(): SessionValue | null {
  return useContext(SessionContext);
}
/* eslint-enable react-refresh/only-export-components */

