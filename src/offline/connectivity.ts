import type { AxiosError } from "axios";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";

/** `null` = unknown (assume reachable until a probe or request proves otherwise). */
let lastReachable: boolean | null = null;

export type ApiReachableDetail = { ok: boolean; previous: boolean | null };

export const FM_API_REACHABLE_EVENT = "fm-api-reachable";

export function markApiReachable(ok: boolean): void {
  const previous = lastReachable;
  lastReachable = ok;
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<ApiReachableDetail>(FM_API_REACHABLE_EVENT, { detail: { ok, previous } }));
}

export function isApiMarkedUnreachable(): boolean {
  return lastReachable === false;
}

/** True when we should read IndexedDB caches instead of hitting the network. */
export function preferOfflineCaches(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  if (!navigator.onLine) {
    return true;
  }
  return lastReachable === false;
}

/** True when allowlisted writes should go to the outbox instead of the network adapter. */
export function shouldTreatAsDisconnectedForMutations(): boolean {
  return preferOfflineCaches();
}

/** No HTTP response from server (typical for DNS, TCP, CORS, or offline). */
export function isLikelyNetworkFailure(err: AxiosError): boolean {
  if (err.response) {
    return false;
  }
  if (!err.request) {
    return false;
  }
  return true;
}

/**
 * Lightweight reachability check (no auth). Updates {@link lastReachable}.
 * Uses the same API base URL as the SPA (including staging host split).
 */
export async function probeApiReachability(): Promise<boolean> {
  const base = resolveApiBaseUrl().replace(/\/$/, "");
  try {
    const ac = new AbortController();
    const tid = window.setTimeout(() => ac.abort(), 4500);
    const res = await fetch(`${base}/api/health/`, {
      method: "GET",
      signal: ac.signal,
      credentials: "omit",
      cache: "no-store",
    });
    window.clearTimeout(tid);
    const ok = res.ok;
    markApiReachable(ok);
    return ok;
  } catch {
    markApiReachable(false);
    return false;
  }
}
