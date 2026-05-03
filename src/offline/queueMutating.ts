import type { InternalAxiosRequestConfig } from "axios";

type ConfigWithOfflineEcho = InternalAxiosRequestConfig & { offlineEcho?: unknown };
import { getAccessToken, getRefreshToken } from "../state/auth";
import { isOutboxAllowlisted, resolveUrlPathForAllowlist } from "./allowlist";
import { shouldTreatAsDisconnectedForMutations } from "./connectivity";
import {
  mergeLookupsDexieCachesAfterOutboxEnqueue,
  mergeUpcomingListDexieCacheAfterOutboxEnqueue,
} from "./optimisticLookupsEnqueue";
import { mergeProfileDexieAfterOutboxEnqueue } from "./optimisticProfileEnqueue";
import { mergePendingPostIntoTxListCaches } from "./optimisticTxEnqueue";
import { enqueueOutboxEntry } from "./outbox";

function isLookupOutboxEnqueue(method: string, pathNorm: string): boolean {
  const m = method.toUpperCase();
  if (m === "POST" && /^\/finance\/categories\/?$/.test(pathNorm)) {
    return true;
  }
  if ((m === "PATCH" || m === "DELETE") && /^\/finance\/categories\/[^/]+\/?$/.test(pathNorm)) {
    return true;
  }
  if ((m === "POST" || m === "PATCH" || m === "DELETE") && /^\/finance\/tags\/?$/.test(pathNorm)) {
    return true;
  }
  if (m === "POST" && /^\/finance\/sources\/?$/.test(pathNorm)) {
    return true;
  }
  if ((m === "PATCH" || m === "DELETE") && /^\/finance\/sources\/[^/]+\/?$/.test(pathNorm)) {
    return true;
  }
  return false;
}

function isUpcomingOutboxEnqueue(method: string, pathNorm: string): boolean {
  const m = method.toUpperCase();
  if (m === "POST" && /^\/finance\/upcoming_expenses\/?$/.test(pathNorm)) {
    return true;
  }
  if ((m === "PATCH" || m === "PUT" || m === "DELETE") && /^\/finance\/upcoming_expenses\/[^/]+\/?$/.test(pathNorm)) {
    return true;
  }
  return false;
}

function isProfileOutboxEnqueue(method: string, pathNorm: string): boolean {
  return method.toUpperCase() === "PATCH" && /^\/finance\/appprofile\/?$/.test(pathNorm);
}

export function shouldQueueOfflineWrite(config: InternalAxiosRequestConfig): boolean {
  if (typeof navigator === "undefined" || !shouldTreatAsDisconnectedForMutations()) {
    return false;
  }
  const method = (config.method ?? "get").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return false;
  }
  const path = resolveUrlPathForAllowlist(config);
  if (!isOutboxAllowlisted(method, path)) {
    return false;
  }
  // Standalone brain (D): queue whenever we have any session material so the user
  // can record optimistically offline; drain still requires refresh to hit the API.
  return Boolean(getRefreshToken().trim() || getAccessToken().trim());
}

export async function enqueueOfflineAxiosWrite(config: InternalAxiosRequestConfig): Promise<string> {
  const path = resolveUrlPathForAllowlist(config);
  const echo = (config as ConfigWithOfflineEcho).offlineEcho;
  const method = (config.method ?? "POST").toUpperCase();
  const idempotencyKey = await enqueueOutboxEntry({
    method,
    url: path,
    body: config.data,
    ...(echo !== undefined ? { echo } : {}),
  });
  const norm = path.split("?")[0];
  const pathNorm = norm.endsWith("/") || norm.length === 0 ? norm : `${norm}/`;
  if (method === "POST" && /^\/finance\/transactions\/?$/.test(pathNorm)) {
    await mergePendingPostIntoTxListCaches(config.data, idempotencyKey).catch(() => undefined);
  }
  if (isLookupOutboxEnqueue(method, pathNorm)) {
    await mergeLookupsDexieCachesAfterOutboxEnqueue().catch(() => undefined);
  }
  if (isUpcomingOutboxEnqueue(method, pathNorm)) {
    await mergeUpcomingListDexieCacheAfterOutboxEnqueue().catch(() => undefined);
  }
  if (isProfileOutboxEnqueue(method, pathNorm)) {
    await mergeProfileDexieAfterOutboxEnqueue().catch(() => undefined);
  }
  return idempotencyKey;
}

/**
 * Connectivity-independent check: can this failed request be retroactively queued
 * to the outbox? Used by the response error interceptor when a network failure
 * occurs on a request that was NOT pre-emptively queued (i.e. we thought we were
 * online but the request failed anyway).
 */
export function canRetroactivelyQueue(
  config: InternalAxiosRequestConfig & { _retry?: boolean },
): boolean {
  if (config._retry) {
    return false;
  }
  const method = (config.method ?? "get").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return false;
  }
  const path = resolveUrlPathForAllowlist(config);
  if (!isOutboxAllowlisted(method, path)) {
    return false;
  }
  return Boolean(getRefreshToken().trim() || getAccessToken().trim());
}
