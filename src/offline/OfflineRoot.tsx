import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { isPwaStandaloneDisplay } from "../lib/pwaDisplay";
import { useSessionOptional } from "../state/SessionContext";
import { probeApiReachability } from "./connectivity";
import { drainOutbox } from "./drain";
import { outboxDepth } from "./outbox";
import { seedOfflineWindow } from "./seed";
import { syncMinimalExchangeRates } from "./exchangeRates";

/**
 * Avoid running outbox drain / heavy offline work on public marketing routes: a logged-in
 * user hitting `/` would otherwise trigger sync UI and refetches meant for the app shell.
 */
function allowOfflineLifecycle(pathname: string): boolean {
  return pathname.startsWith("/app") || isPwaStandaloneDisplay();
}

/** Mount-time hooks: seed window, probe API reachability, drain on reconnect/focus. */
export function OfflineRoot(): ReactNode {
  const session = useSessionOptional();
  const { pathname } = useLocation();
  const allow = allowOfflineLifecycle(pathname);

  useEffect(() => {
    if (!allow) {
      return;
    }
    const onOnline = (): void => {
      void probeApiReachability().then((ok) => {
        if (ok) {
          void syncMinimalExchangeRates();
          void drainOutbox();
        }
      });
    };
    window.addEventListener("online", onOnline);
    void (async () => {
      await probeApiReachability();
      void syncMinimalExchangeRates();
      if ((await outboxDepth()) > 0) {
        await drainOutbox();
      }
    })();
    return () => window.removeEventListener("online", onOnline);
  }, [allow]);

  useEffect(() => {
    if (!session?.isAuthenticated || !allow) {
      return;
    }
    void seedOfflineWindow();
  }, [session?.isAuthenticated, allow]);

  useEffect(() => {
    if (!session?.isAuthenticated || !allow) {
      return;
    }
    const id = window.setInterval(() => void probeApiReachability(), 25_000);
    return () => window.clearInterval(id);
  }, [session?.isAuthenticated, allow]);

  useEffect(() => {
    if (!allow) {
      return;
    }
    const onVis = (): void => {
      if (document.visibilityState === "visible") {
        void probeApiReachability().then((ok) => {
          if (ok) {
            void syncMinimalExchangeRates();
            void drainOutbox();
          }
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [allow]);

  return null;
}
