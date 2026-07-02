import axios, { isAxiosError } from "axios";
import { postRefresh } from "../api/refreshClient";
import type { LoginResponse } from "../api/types";
import { tr } from "../lib/i18n";
import { queryClient } from "../lib/queryClient";
import { dispatchClientBuildUnsupported } from "../lib/clientBuildUpgradeEvents";
import { AUTH_CHANGED_EVENT, getRefreshToken, setSession } from "../state/auth";
import {
  FM_API_REACHABLE_EVENT,
  type ApiReachableDetail,
  isApiMarkedUnreachable,
  probeApiReachability,
} from "./connectivity";
import { clearOutbox, listOutboxOrdered, removeOutboxEntry } from "./outbox";
import { emitSyncState } from "./syncEvents";
import { syncMinimalExchangeRates } from "./exchangeRates";
import { requestPwaReadBypassAfterMutation } from "./pwaReadBypass";
import { runAutoDeductDueTodayCheck } from "./autoDeduct";

let drainInFlight: Promise<void> | null = null;

/** After a transient drain failure, retry once when the API is reachable again. */
let wantsRetryAfterReachableError = false;
let drainRetryListenerInstalled = false;

function ensureDrainRetryOnReachableListener(): void {
  if (drainRetryListenerInstalled || typeof window === "undefined") {
    return;
  }
  drainRetryListenerInstalled = true;
  window.addEventListener(FM_API_REACHABLE_EVENT, (e: Event) => {
    const ce = e as CustomEvent<ApiReachableDetail>;
    const d = ce.detail;
    if (!d?.ok || !wantsRetryAfterReachableError) {
      return;
    }
    wantsRetryAfterReachableError = false;
    void drainOutbox();
  });
}

ensureDrainRetryOnReachableListener();

export async function drainOutbox(): Promise<void> {
  if (drainInFlight) {
    return drainInFlight;
  }
  const ac = new AbortController();
  const onAuth = (): void => ac.abort();
  let authListenerAttached = false;
  drainInFlight = (async () => {
    let canReach = typeof navigator !== "undefined" && navigator.onLine;
    if (!canReach) {
      canReach = await probeApiReachability();
    } else if (isApiMarkedUnreachable()) {
      canReach = await probeApiReachability();
    }
    if (!canReach) {
      emitSyncState({ phase: "idle" });
      return;
    }
    const refresh = getRefreshToken();
    if (!refresh) {
      emitSyncState({ phase: "auth_blocked", detail: "Sign in again to sync queued changes." });
      return;
    }
    emitSyncState({ phase: "syncing", detail: "Uploading queued changes…" });
    let login: LoginResponse;
    try {
      login = await postRefresh(refresh);
    } catch (e: unknown) {
      if (isAxiosError(e) && e.response?.status === 401) {
        emitSyncState({ phase: "auth_blocked", detail: "Session expired. Sign in again to sync." });
        return;
      }
      wantsRetryAfterReachableError = true;
      emitSyncState({
        phase: "error",
        detail: tr("sync.status.refreshNetworkError", "en-US"),
      });
      return;
    }
    setSession({
      access: login.access,
      refresh: login.refresh ?? refresh,
    });
    window.addEventListener(AUTH_CHANGED_EVENT, onAuth);
    authListenerAttached = true;

    const { api } = await import("../api/client");
    const rows = await listOutboxOrdered();
    for (const row of rows) {
      if (ac.signal.aborted) {
        emitSyncState({ phase: "idle" });
        return;
      }
      if (row.id === undefined) {
        continue;
      }
      try {
        await api.request({
          method: row.method,
          url: row.url,
          data: row.body,
          headers: {
            "Idempotency-Key": row.idempotencyKey,
          },
          signal: ac.signal,
        });
        await removeOutboxEntry(row.id);
      } catch (err: unknown) {
        if (axios.isCancel(err) || (err instanceof DOMException && err.name === "AbortError")) {
          emitSyncState({ phase: "idle" });
          return;
        }
        if (isAxiosError(err) && err.response?.status === 409) {
          const data = err.response.data as { code?: string } | undefined;
          if (data && typeof data === "object" && data.code === "CLIENT_BUILD_UNSUPPORTED") {
            dispatchClientBuildUnsupported(data as Parameters<typeof dispatchClientBuildUnsupported>[0]);
          }
          emitSyncState({ phase: "error", detail: "Upgrade required — sync paused." });
          return;
        }
        if (isAxiosError(err) && err.response && err.response.status >= 400 && err.response.status < 500) {
          emitSyncState({ phase: "error", detail: "Transaction failed. Please fix it." });
          return;
        }
        wantsRetryAfterReachableError = true;
        emitSyncState({
          phase: "error",
          detail: "Sync hit a network or server error; will retry when online.",
        });
        return;
      }
    }
    emitSyncState({ phase: "syncing", detail: "Refreshing data from the server…" });
    try {
      requestPwaReadBypassAfterMutation();
      await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["sources", "all"] });
      await queryClient.invalidateQueries({ queryKey: ["app-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["tags", "all"] });
      await queryClient.invalidateQueries({ queryKey: ["categories", "all"] });
      await queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions-calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions-viz"] });
      await queryClient.refetchQueries({ type: "active" });
      void syncMinimalExchangeRates(true);
    } catch {
      /* ignore refetch failures after successful upload */
    }
    wantsRetryAfterReachableError = false;
    emitSyncState({ phase: "idle" });
    void runAutoDeductDueTodayCheck();
  })()
    .finally(() => {
      if (authListenerAttached) {
        window.removeEventListener(AUTH_CHANGED_EVENT, onAuth);
      }
      drainInFlight = null;
    });
  return drainInFlight;
}

export async function discardOutboxAndClear(): Promise<void> {
  await clearOutbox();
  emitSyncState({ phase: "idle" });
}
