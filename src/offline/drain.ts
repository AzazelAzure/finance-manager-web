import axios, { isAxiosError } from "axios";
import { postRefresh } from "../api/refreshClient";
import type { LoginResponse } from "../api/types";
import { dispatchClientBuildUnsupported } from "../lib/clientBuildUpgradeEvents";
import { AUTH_CHANGED_EVENT, getRefreshToken, setSession } from "../state/auth";
import { isApiMarkedUnreachable, probeApiReachability } from "./connectivity";
import { clearOutbox, listOutboxOrdered, removeOutboxEntry } from "./outbox";
import { emitSyncState } from "./syncEvents";

let drainInFlight: Promise<void> | null = null;

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
    emitSyncState({ phase: "syncing" });
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
        emitSyncState({
          phase: "error",
          detail: "Sync hit a network or server error; will retry when online.",
        });
        return;
      }
    }
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
