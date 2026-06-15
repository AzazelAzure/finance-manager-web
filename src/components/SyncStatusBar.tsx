import { useEffect, useState, type ReactNode } from "react";
import {
  FM_API_REACHABLE_EVENT,
  type ApiReachableDetail,
  markApiReachable,
  probeApiReachability,
} from "../offline/connectivity";
import { drainOutbox } from "../offline/drain";
import { SYNC_STATE_EVENT, type SyncStatePayload } from "../offline/syncEvents";
import { tr, useLocale } from "../lib/i18n";
import { Button } from "./ui/Button";

export function SyncStatusBar(): ReactNode {
  const locale = useLocale();
  const [sync, setSync] = useState<SyncStatePayload["phase"]>("idle");
  const [syncDetail, setSyncDetail] = useState<string | undefined>();
  const [sessionDismissed, setSessionDismissed] = useState(false);

  useEffect(() => {
    const onOnline = (): void => {
      void probeApiReachability();
    };
    const onOffline = (): void => {
      markApiReachable(false);
    };
    const onReach = (e: Event): void => {
      const ce = e as CustomEvent<ApiReachableDetail>;
      if (ce.detail.ok) {
        setSync((prev) => (prev === "error" ? "idle" : prev));
      }
    };
    const onSync = (e: Event): void => {
      const ce = e as CustomEvent<SyncStatePayload>;
      setSync(ce.detail?.phase ?? "idle");
      setSyncDetail(ce.detail?.detail);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(FM_API_REACHABLE_EVENT, onReach);
    window.addEventListener(SYNC_STATE_EVENT, onSync);
    
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(FM_API_REACHABLE_EVENT, onReach);
      window.removeEventListener(SYNC_STATE_EVENT, onSync);
    };
  }, []);

  useEffect(() => {
    if (sync === "idle") {
      setSyncDetail(undefined);
    }
  }, [sync]);

  useEffect(() => {
    if (sync === "error" || sync === "auth_blocked") {
      setSessionDismissed(false);
    }
  }, [sync]);

  // ONLY render when there is an actionable error.
  if (sync !== "auth_blocked" && sync !== "error") {
    return null;
  }
  if (sessionDismissed) {
    return null;
  }

  const label =
    sync === "auth_blocked"
      ? syncDetail ?? tr("sync.status.authBlocked", locale)
      : syncDetail ?? tr("sync.status.error", locale);

  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.4rem 0.75rem",
        fontSize: "var(--font-sm)",
        background: sync === "error" ? "rgba(220, 38, 38, 0.1)" : "rgba(234, 179, 8, 0.1)",
        borderBottom: `1px solid ${sync === "error" ? "rgba(220, 38, 38, 0.2)" : "rgba(234, 179, 8, 0.2)"}`,
        color: sync === "error" ? "var(--danger)" : "var(--warning)",
      }}
    >
      <span>{label}</span>
      <span style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <Button type="button" variant="secondary" onClick={() => void drainOutbox()}>
          {tr("sync.action.syncNow", locale)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label={tr("sync.dismiss.aria", locale)}
          onClick={() => setSessionDismissed(true)}
        >
          {tr("sync.dismiss", locale)}
        </Button>
      </span>
    </div>
  );
}
