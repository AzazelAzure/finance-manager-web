import { useEffect, useState, type ReactNode } from "react";
import { outboxDepth } from "../offline/outbox";
import { drainOutbox } from "../offline/drain";
import { SYNC_STATE_EVENT, type SyncStatePayload } from "../offline/syncEvents";
import { Button } from "./ui/Button";

export function SyncStatusBar(): ReactNode {
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [queued, setQueued] = useState(0);
  const [sync, setSync] = useState<SyncStatePayload["phase"]>("idle");
  const [syncDetail, setSyncDetail] = useState<string | undefined>();

  const refreshDepth = (): void => {
    void outboxDepth().then(setQueued).catch(() => setQueued(0));
  };

  useEffect(() => {
    refreshDepth();
    const onOnline = (): void => {
      setOnline(true);
      void drainOutbox().finally(refreshDepth);
    };
    const onOffline = (): void => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const onQueued = (): void => refreshDepth();
    window.addEventListener("fm-offline-queued", onQueued);
    const onSync = (e: Event): void => {
      const ce = e as CustomEvent<SyncStatePayload>;
      setSync(ce.detail?.phase ?? "idle");
      setSyncDetail(ce.detail?.detail);
      void outboxDepth().then(setQueued);
    };
    window.addEventListener(SYNC_STATE_EVENT, onSync);
    const id = window.setInterval(refreshDepth, 8000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("fm-offline-queued", onQueued);
      window.removeEventListener(SYNC_STATE_EVENT, onSync);
      window.clearInterval(id);
    };
  }, []);

  if (sync === "idle" && online && queued === 0) {
    return null;
  }

  const label = !online
    ? "Offline — queued changes will sync when you reconnect."
    : sync === "syncing"
      ? "Syncing…"
      : sync === "auth_blocked"
        ? syncDetail ?? "Sign in again to sync queued changes."
        : sync === "error"
          ? syncDetail ?? "Sync paused — check connection or update the app."
          : queued > 0
            ? `Queued locally (${queued}) — will sync when online.`
            : "";

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.4rem 0.75rem",
        fontSize: "var(--font-sm)",
        background: "rgba(15, 23, 42, 0.06)",
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
      }}
    >
      <span>{label}</span>
      {online && queued > 0 ? (
        <Button type="button" variant="secondary" onClick={() => void drainOutbox().finally(refreshDepth)}>
          Sync now
        </Button>
      ) : null}
    </div>
  );
}
