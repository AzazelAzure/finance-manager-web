/**
 * v1 mutating paths aligned with API D2 allowlist (same-origin paths under API base are still matched on `url` tail).
 */
const TX_LIST = /^\/finance\/transactions\/?$/;
const TX_DETAIL = /^\/finance\/transactions\/[^/]+\/?$/;
const UE_LIST = /^\/finance\/upcoming_expenses\/?$/;
const UE_DETAIL = /^\/finance\/upcoming_expenses\/[^/]+\/?$/;

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
  return false;
}
