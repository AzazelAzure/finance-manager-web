import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ACCESS_TOKEN_KEY,
  AUTH_CHANGED_EVENT,
  clearSession,
  getEffectiveAccessTokenForSession,
} from "./auth";

function subscribeAccess(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const onStorage = (e: StorageEvent): void => {
    if (e.key === ACCESS_TOKEN_KEY) {
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

function getAccessSnapshot(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return getEffectiveAccessTokenForSession();
}

type SessionValue = {
  isAuthenticated: boolean;
  accessToken: string;
  logout: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

function CrossTabLogoutHandler(): null {
  const { logout, isAuthenticated } = useSession();
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const onStorage = (e: StorageEvent): void => {
      if (e.key === ACCESS_TOKEN_KEY && !e.newValue) {
        logout();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isAuthenticated, logout]);
  return null;
}

export function SessionProvider({ children }: { children: ReactNode }): ReactNode {
  /** Same snapshot on server and client avoids useSyncExternalStore consistency issues in CSR. */
  const accessToken = useSyncExternalStore(subscribeAccess, getAccessSnapshot, getAccessSnapshot);
  const isAuthenticated = Boolean(accessToken);
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

