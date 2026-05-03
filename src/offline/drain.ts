import axios, { isAxiosError } from "axios";
import { postRefresh } from "../api/refreshClient";
import type { LoginResponse } from "../api/types";
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
  drainInFlight = (async () => {
    const ac = new AbortController();
    const onAuth = (): void => ac.abort();
    window.addEventListener(AUTH_CHANGED_EVENT, onAuth, { once: true });

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
    } catch {
      emitSyncState({ phase: "auth_blocked", detail: "Session expired. Sign in again to sync." });
      return;
    }
    setSession({
      access: login.access,
      refresh: login.refresh ?? refresh,
    });

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
      await queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["sources", "all"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["app-profile"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["tags", "all"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["categories", "all"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["transactions-calendar"], refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: ["transactions-viz"], refetchType: "all" });
      await queryClient.refetchQueries({ type: "active" });
      void syncMinimalExchangeRates(true);
    } catch {
      /* ignore refetch failures after successful upload */
    }
    wantsRetryAfterReachableError = false;
    emitSyncState({ phase: "idle" });
  })().finally(() => {
    drainInFlight = null;
  });
  return drainInFlight;
}

export async function discardOutboxAndClear(): Promise<void> {
  await clearOutbox();
  emitSyncState({ phase: "idle" });
}
