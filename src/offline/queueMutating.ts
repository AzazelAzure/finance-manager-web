import type { InternalAxiosRequestConfig } from "axios";

type ConfigWithOfflineEcho = InternalAxiosRequestConfig & { offlineEcho?: unknown };
import { getAccessToken, getRefreshToken } from "../state/auth";
import { isOutboxAllowlisted } from "./allowlist";
import { shouldTreatAsDisconnectedForMutations } from "./connectivity";
import { mergePendingPostIntoTxListCaches } from "./optimisticTxEnqueue";
import { enqueueOutboxEntry } from "./outbox";

function resolveUrlPath(config: InternalAxiosRequestConfig): string {
  const raw = config.url ?? "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      return new URL(raw).pathname;
    } catch {
      return raw;
    }
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function shouldQueueOfflineWrite(config: InternalAxiosRequestConfig): boolean {
  if (typeof navigator === "undefined" || !shouldTreatAsDisconnectedForMutations()) {
    return false;
  }
  const method = (config.method ?? "get").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return false;
  }
  const path = resolveUrlPath(config);
  if (!isOutboxAllowlisted(method, path)) {
    return false;
  }
  // Standalone brain (D): queue whenever we have any session material so the user
  // can record optimistically offline; drain still requires refresh to hit the API.
  return Boolean(getRefreshToken().trim() || getAccessToken().trim());
}

export async function enqueueOfflineAxiosWrite(config: InternalAxiosRequestConfig): Promise<string> {
  const path = resolveUrlPath(config);
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
  const path = resolveUrlPath(config);
  if (!isOutboxAllowlisted(method, path)) {
    return false;
  }
  return Boolean(getRefreshToken().trim() || getAccessToken().trim());
}
