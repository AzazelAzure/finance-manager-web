import type { InternalAxiosRequestConfig } from "axios";
import { getRefreshToken } from "../state/auth";
import { isOutboxAllowlisted } from "./allowlist";
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
  if (typeof navigator === "undefined" || navigator.onLine) {
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
  // D3: allow queue with refresh even when access JWT is expired in UI.
  return Boolean(getRefreshToken());
}

export async function enqueueOfflineAxiosWrite(config: InternalAxiosRequestConfig): Promise<void> {
  const path = resolveUrlPath(config);
  await enqueueOutboxEntry({
    method: (config.method ?? "POST").toUpperCase(),
    url: path,
    body: config.data,
  });
}
