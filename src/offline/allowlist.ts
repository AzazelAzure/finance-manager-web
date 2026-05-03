import type { InternalAxiosRequestConfig } from "axios";

/** Pathname tail for allowlist checks (matches axios `config.url` vs baseURL). */
export function resolveUrlPathForAllowlist(config: Pick<InternalAxiosRequestConfig, "url">): string {
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

/**
 * v1 mutating paths aligned with API D2 (transactions + upcoming_expenses) plus lookup
 * endpoints the UI may call immediately before a dependent write (e.g. Quick add creates
 * a category then posts the transaction). Same-origin paths under the API base are still
 * matched on the `url` pathname tail.
 */
const TX_LIST = /^\/finance\/transactions\/?$/;
const TX_DETAIL = /^\/finance\/transactions\/[^/]+\/?$/;
const UE_LIST = /^\/finance\/upcoming_expenses\/?$/;
const UE_DETAIL = /^\/finance\/upcoming_expenses\/[^/]+\/?$/;
const CAT_LIST = /^\/finance\/categories\/?$/;
const CAT_DETAIL = /^\/finance\/categories\/[^/]+\/?$/;
const TAG_ENDPOINT = /^\/finance\/tags\/?$/;
const SRC_LIST = /^\/finance\/sources\/?$/;
const SRC_DETAIL = /^\/finance\/sources\/[^/]+\/?$/;
const APP_PROFILE = /^\/finance\/appprofile\/?$/;

export function isOutboxAllowlisted(method: string, path: string): boolean {
  const m = method.toUpperCase();
  const p = path.split("?")[0];
  const norm = p.endsWith("/") || p.length === 0 ? p : `${p}/`;
  if (m === "POST" && TX_LIST.test(norm)) return true;
  if (m === "POST" && UE_LIST.test(norm)) return true;
  if (m === "PATCH" && TX_DETAIL.test(norm)) return true;
  if (m === "DELETE" && TX_DETAIL.test(norm)) return true;
  if (m === "PATCH" && UE_DETAIL.test(norm)) return true;
  if (m === "PUT" && UE_DETAIL.test(norm)) return true;
  if (m === "DELETE" && UE_DETAIL.test(norm)) return true;

  if (m === "POST" && CAT_LIST.test(norm)) return true;
  if (m === "PATCH" && CAT_DETAIL.test(norm)) return true;
  if (m === "DELETE" && CAT_DETAIL.test(norm)) return true;

  if ((m === "POST" || m === "PATCH" || m === "DELETE") && TAG_ENDPOINT.test(norm)) return true;

  if (m === "POST" && SRC_LIST.test(norm)) return true;
  if (m === "PATCH" && SRC_DETAIL.test(norm)) return true;
  if (m === "DELETE" && SRC_DETAIL.test(norm)) return true;

  if (m === "PATCH" && APP_PROFILE.test(norm)) return true;
  return false;
}
