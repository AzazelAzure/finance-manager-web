import { useEffect, type ReactNode } from "react";
import { useSessionOptional } from "../state/SessionContext";
import { drainOutbox } from "./drain";
import { outboxDepth } from "./outbox";
import { seedOfflineWindow } from "./seed";

/** Mount-time hooks: seed window, drain on reconnect/focus. */
export function OfflineRoot(): ReactNode {
  const session = useSessionOptional();

  useEffect(() => {
    const onOnline = (): void => {
      void drainOutbox();
    };
    window.addEventListener("online", onOnline);
    void (async () => {
      if (navigator.onLine && (await outboxDepth()) > 0) {
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
    const onVis = (): void => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void drainOutbox();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return null;
}
