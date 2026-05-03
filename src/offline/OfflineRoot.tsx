import { useEffect, type ReactNode } from "react";
import { useSessionOptional } from "../state/SessionContext";
import { probeApiReachability } from "./connectivity";
import { drainOutbox } from "./drain";
import { outboxDepth } from "./outbox";
import { seedOfflineWindow } from "./seed";
import { syncMinimalExchangeRates } from "./exchangeRates";

/** Mount-time hooks: seed window, probe API reachability, drain on reconnect/focus. */
export function OfflineRoot(): ReactNode {
  const session = useSessionOptional();

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!session?.isAuthenticated) {
      return;
    }
    void seedOfflineWindow();
  }, [session?.isAuthenticated]);

  useEffect(() => {
    if (!session?.isAuthenticated) {
      return;
    }
    const id = window.setInterval(() => void probeApiReachability(), 25_000);
    return () => window.clearInterval(id);
  }, [session?.isAuthenticated]);

  useEffect(() => {
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
  }, []);

  return null;
}
