import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  FM_API_REACHABLE_EVENT,
  type ApiReachableDetail,
  markApiReachable,
  probeApiReachability,
} from "../offline/connectivity";
import { drainOutbox, invalidateOutboxMutationCaches } from "../offline/drain";
import { deleteQueuedTransactionPost, emitSyncStateForOutboxFailures } from "../offline/outbox";
import { SYNC_STATE_EVENT, type SyncStatePayload } from "../offline/syncEvents";
import { tr, useLocale } from "../lib/i18n";
import { Button } from "./ui/Button";

export function SyncStatusBar(): ReactNode {
  const locale = useLocale();
  const navigate = useNavigate();
  const [sync, setSync] = useState<SyncStatePayload["phase"]>("idle");
  const [syncDetail, setSyncDetail] = useState<string | undefined>();
  const [syncRetryable, setSyncRetryable] = useState(false);
  const [pendingTxId, setPendingTxId] = useState<string | undefined>();
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const discardDialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void emitSyncStateForOutboxFailures();
  }, []);

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
        void (async () => {
          const hasFailure = await emitSyncStateForOutboxFailures();
          if (hasFailure) {
            return;
          }
          setSync((prev) => {
            if (prev === "action_required") {
              return prev;
            }
            if (prev === "error") {
              setSyncRetryable(false);
              return "idle";
            }
            return prev;
          });
        })();
      }
    };
    const onSync = (e: Event): void => {
      const ce = e as CustomEvent<SyncStatePayload>;
      const detail = ce.detail;
      const phase = detail?.phase ?? "idle";
      setSync(phase);
      setSyncDetail(phase === "idle" ? undefined : detail?.detail);
      setSyncRetryable(phase === "error" && detail?.retryable === true);
      setPendingTxId(phase === "idle" ? undefined : detail?.pendingTxId);
      if (phase === "error" || phase === "auth_blocked") {
        setSessionDismissed(false);
      }
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
    if (!discardOpen || !discardDialogRef.current) {
      return;
    }
    const root = discardDialogRef.current;
    const focusables = (): HTMLElement[] =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

    const items = focusables();
    items[0]?.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") {
        return;
      }
      const nodes = focusables();
      if (nodes.length === 0) {
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [discardOpen]);

  if (sync !== "auth_blocked" && sync !== "error" && sync !== "action_required") {
    return null;
  }
  if (sessionDismissed && sync !== "action_required") {
    return null;
  }

  const isRepair = sync === "action_required" && Boolean(pendingTxId);
  const label =
    sync === "auth_blocked"
      ? (syncDetail ?? tr("sync.status.authBlocked", locale))
      : syncRetryable
        ? (syncDetail || tr("sync.status.retryable", locale))
        : (syncDetail ?? tr("sync.status.error", locale));

  async function confirmDiscard(): Promise<void> {
    if (!pendingTxId || discarding) {
      return;
    }
    setDiscarding(true);
    try {
      const ok = await deleteQueuedTransactionPost(pendingTxId);
      if (!ok) {
        return;
      }
      await invalidateOutboxMutationCaches();
      setDiscardOpen(false);
      const hasFailure = await emitSyncStateForOutboxFailures();
      if (!hasFailure) {
        setSync("idle");
        setSyncDetail(undefined);
        setSyncRetryable(false);
        setPendingTxId(undefined);
      }
    } finally {
      setDiscarding(false);
    }
  }

  return (
    <>
      <div
        role={isRepair ? "alert" : "status"}
        aria-live={isRepair ? "assertive" : "polite"}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.4rem 0.75rem",
          fontSize: "var(--font-sm)",
          background:
            sync === "error" ? "rgba(220, 38, 38, 0.1)" : "rgba(234, 179, 8, 0.1)",
          borderBottom: `1px solid ${sync === "error" ? "rgba(220, 38, 38, 0.2)" : "rgba(234, 179, 8, 0.2)"}`,
          color: sync === "error" ? "var(--danger)" : "var(--warning)",
        }}
      >
        <span>{label}</span>
        <span style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {isRepair ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  navigate(`/app/transactions?repairPending=${encodeURIComponent(pendingTxId!)}`);
                }}
              >
                {tr("sync.repair.edit", locale)}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDiscardOpen(true)}>
                {tr("sync.repair.discard", locale)}
              </Button>
            </>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => void drainOutbox()}>
            {tr("sync.action.syncNow", locale)}
          </Button>
          {!isRepair ? (
            <Button
              type="button"
              variant="ghost"
              aria-label={tr("sync.dismiss.aria", locale)}
              onClick={() => setSessionDismissed(true)}
            >
              {tr("sync.dismiss", locale)}
            </Button>
          ) : null}
        </span>
      </div>

      {discardOpen ? (
        <div
          className="ui-modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!discarding) {
              setDiscardOpen(false);
            }
          }}
        >
          <div
            ref={discardDialogRef}
            className="ui-modal-panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sync-discard-title"
            aria-describedby="sync-discard-desc"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="sync-discard-title" style={{ margin: 0, fontSize: "var(--font-lg)" }}>
              {tr("sync.repair.discardTitle", locale)}
            </h2>
            <p id="sync-discard-desc" className="muted-text">
              {tr("sync.repair.discardBody", locale)}
              {syncDetail ? ` ${syncDetail}` : ""}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: 12 }}>
              <Button type="button" variant="secondary" disabled={discarding} onClick={() => setDiscardOpen(false)}>
                {tr("sync.repair.discardCancel", locale)}
              </Button>
              <Button type="button" variant="ghost" disabled={discarding} onClick={() => void confirmDiscard()}>
                {discarding ? tr("sync.repair.discarding", locale) : tr("sync.repair.discardConfirm", locale)}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
