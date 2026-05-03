import { useEffect, useState, type ReactNode } from "react";
import {
  FM_API_REACHABLE_EVENT,
  type ApiReachableDetail,
  isApiMarkedUnreachable,
  probeApiReachability,
} from "../offline/connectivity";
import { drainOutbox } from "../offline/drain";
import { outboxDepth } from "../offline/outbox";
import { SYNC_STATE_EVENT, type SyncStatePayload } from "../offline/syncEvents";
import { tr, useLocale } from "../lib/i18n";
import { Button } from "./ui/Button";

function computeNavigatorOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function SyncStatusBar(): ReactNode {
  const locale = useLocale();
  const [navigatorOnline, setNavigatorOnline] = useState(computeNavigatorOnline);
  const [apiUnreachable, setApiUnreachable] = useState(() =>
    typeof window !== "undefined" ? isApiMarkedUnreachable() : false,
  );
  const [queued, setQueued] = useState(0);
  const [sync, setSync] = useState<SyncStatePayload["phase"]>("idle");
  const [syncDetail, setSyncDetail] = useState<string | undefined>();
  const [reconnectPrompt, setReconnectPrompt] = useState(false);

  const treatAsOffline = !navigatorOnline || apiUnreachable;

  const refreshDepth = (): void => {
    void outboxDepth().then(setQueued).catch(() => setQueued(0));
  };

  useEffect(() => {
    refreshDepth();
    const onOnline = (): void => {
      setNavigatorOnline(true);
      void probeApiReachability().finally(() => {
        void drainOutbox().finally(refreshDepth);
      });
    };
    const onOffline = (): void => {
      setNavigatorOnline(false);
    };
    const onReach = (e: Event): void => {
      const ce = e as CustomEvent<ApiReachableDetail>;
      const d = ce.detail;
      setApiUnreachable(d.ok === false);
      if (d.ok && d.previous === false) {
        void outboxDepth().then((n) => {
          if (n > 0) {
            setReconnectPrompt(true);
          }
        });
      }
    };
    const onQueued = (): void => refreshDepth();
    const onSync = (e: Event): void => {
      const ce = e as CustomEvent<SyncStatePayload>;
      setSync(ce.detail?.phase ?? "idle");
      setSyncDetail(ce.detail?.detail);
      void outboxDepth().then(setQueued);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(FM_API_REACHABLE_EVENT, onReach);
    window.addEventListener("fm-offline-queued", onQueued);
    window.addEventListener(SYNC_STATE_EVENT, onSync);
    const id = window.setInterval(refreshDepth, 8000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(FM_API_REACHABLE_EVENT, onReach);
      window.removeEventListener("fm-offline-queued", onQueued);
      window.removeEventListener(SYNC_STATE_EVENT, onSync);
      window.clearInterval(id);
    };
  }, []);

  if (sync === "idle" && !treatAsOffline && queued === 0 && !reconnectPrompt) {
    return null;
  }

  const label = treatAsOffline
    ? tr("sync.status.offlineQueued", locale)
    : sync === "syncing"
      ? tr("sync.status.syncing", locale)
      : sync === "auth_blocked"
        ? syncDetail ?? tr("sync.status.authBlocked", locale)
        : sync === "error"
          ? syncDetail ?? tr("sync.status.error", locale)
          : queued > 0
            ? tr("sync.status.queuedWillSync", locale)
            : "";

  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: reconnectPrompt ? "0.5rem" : 0,
        padding: "0.4rem 0.75rem",
        fontSize: "var(--font-sm)",
        background: "rgba(15, 23, 42, 0.06)",
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
      }}
    >
      {reconnectPrompt ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
            padding: "0.35rem 0",
            borderBottom: "1px solid rgba(59, 130, 246, 0.2)",
          }}
        >
          <span>{tr("sync.reconnect.prompt", locale)}</span>
          <span style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setReconnectPrompt(false);
              }}
            >
              {tr("sync.reconnect.later", locale)}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setReconnectPrompt(false);
                void drainOutbox().finally(refreshDepth);
              }}
            >
              {tr("sync.reconnect.syncNow", locale)}
            </Button>
          </span>
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <span>{label}</span>
        {!treatAsOffline && queued > 0 ? (
          <Button type="button" variant="secondary" onClick={() => void drainOutbox().finally(refreshDepth)}>
            {tr("sync.action.syncNow", locale)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
