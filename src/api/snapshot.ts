import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, snapshotParamsCacheKey, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import { applyTransactionOutboxToSnapshot } from "../offline/transactionOutboxOverlay";
import { api } from "./client";
import type { SnapshotResponse } from "./types";

export type FetchAppSnapshotOptions = PwaReadBypassOpts;

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

export async function fetchAppSnapshot(
  params: Record<string, string> = {},
  opts?: FetchAppSnapshotOptions,
): Promise<SnapshotResponse> {
  const cacheId = snapshotParamsCacheKey(params);
  let base: SnapshotResponse;
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(cacheId);
    if (raw && typeof raw === "object" && "flow_series" in raw) {
      base = raw as SnapshotResponse;
    } else {
      base = emptyDashboardSnapshot();
    }
  } else if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(cacheId);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (raw && typeof raw === "object" && "flow_series" in raw) {
      base = raw as SnapshotResponse;
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(cacheId, async () => {
          const { data } = await api.get<SnapshotResponse>("/finance/appprofile/snapshot/", {
            params,
          });
          await writeCachePayload(cacheId, data, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
        });
      }
    } else {
      const { data } = await api.get<SnapshotResponse>("/finance/appprofile/snapshot/", {
        params,
      });
      await writeCachePayload(cacheId, data, Date.now());
      base = data;
    }
  } else {
    const { data } = await api.get<SnapshotResponse>("/finance/appprofile/snapshot/", {
      params,
    });
    await writeCachePayload(cacheId, data, Date.now());
    base = data;
  }
  return applyTransactionOutboxToSnapshot(base, params);
}

/** @deprecated Use fetchAppSnapshot with URL-derived params */
export async function getSnapshotCurrentMonth(): Promise<SnapshotResponse> {
  return fetchAppSnapshot({ current_month: "1" });
}
