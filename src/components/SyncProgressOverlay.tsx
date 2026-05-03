import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SYNC_STATE_EVENT, type SyncStatePayload } from "../offline/syncEvents";
import { tr, useLocale } from "../lib/i18n";

/**
 * Full-screen sync indicator while the outbox is draining and queries are refetching.
 * Complements {@link SyncStatusBar} for visibility when the status bar is off-screen.
 */
export function SyncProgressOverlay(): ReactNode {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | undefined>();

  useEffect(() => {
    const onSync = (e: Event): void => {
      const ce = e as CustomEvent<SyncStatePayload>;
      const p = ce.detail;
      setOpen(p?.phase === "syncing");
      setDetail(p?.detail);
    };
    window.addEventListener(SYNC_STATE_EVENT, onSync);
    return () => window.removeEventListener(SYNC_STATE_EVENT, onSync);
  }, []);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="sync-progress-overlay"
      role="alertdialog"
      aria-busy="true"
      aria-live="assertive"
      aria-labelledby="sync-progress-overlay-title"
    >
      <div className="sync-progress-overlay__panel">
        <div className="sync-progress-overlay__spinner" aria-hidden />
        <h2 id="sync-progress-overlay-title" className="sync-progress-overlay__title">
          {tr("sync.overlay.title", locale)}
        </h2>
        {detail ? <p className="sync-progress-overlay__detail">{detail}</p> : null}
      </div>
    </div>,
    document.body,
  );
}
