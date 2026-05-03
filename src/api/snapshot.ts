import { preferOfflineCaches } from "../offline/connectivity";
import { readCachePayload, snapshotParamsCacheKey, writeCachePayload } from "../offline/cache";
import { api } from "./client";
import type { SnapshotResponse } from "./types";

/** Safe shell when no snapshot row exists offline (empty dashboard, no crash). */
export function emptyDashboardSnapshot(): SnapshotResponse {
  return {
    flow_series: [],
    expense_by_category: [],
    source_balances: [],
    daily_spend: [],
    daily_income: [],
    total_expenses_for_month: 0,
    total_income_for_month: 0,
    total_transfer_out_for_month: 0,
    total_transfer_in_for_month: 0,
    total_leaks_for_month: 0,
    transactions_for_month: [],
    snapshot: null,
  };
}

export async function fetchAppSnapshot(params: Record<string, string> = {}): Promise<SnapshotResponse> {
  const cacheId = snapshotParamsCacheKey(params);
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(cacheId);
    if (raw && typeof raw === "object" && "flow_series" in raw) {
      return raw as SnapshotResponse;
    }
    return emptyDashboardSnapshot();
  }
  const { data } = await api.get<SnapshotResponse>("/finance/appprofile/snapshot/", {
    params,
  });
  await writeCachePayload(cacheId, data, Date.now());
  return data;
}

/** @deprecated Use fetchAppSnapshot with URL-derived params */
export async function getSnapshotCurrentMonth(): Promise<SnapshotResponse> {
  return fetchAppSnapshot({ current_month: "1" });
}
