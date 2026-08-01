export const SYNC_STATE_EVENT = "fm-sync-state";

export type SyncStatePayload = {
  phase: "idle" | "syncing" | "auth_blocked" | "error" | "action_required";
  detail?: string;
  /** Synthetic `pending:*` id when a queued transaction POST needs repair. */
  pendingTxId?: string;
  retryable?: boolean;
};

export function emitSyncState(payload: SyncStatePayload): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(SYNC_STATE_EVENT, { detail: payload }));
}
