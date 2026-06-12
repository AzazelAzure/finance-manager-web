import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, snapshotParamsCacheKey, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import { applyTransactionOutboxToSnapshot } from "../offline/transactionOutboxOverlay";
import { api } from "./client";
import type { SnapshotResponse, SourceRow } from "./types";
import { buildFallbackTxList } from "./transactions";

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
      base = await buildFallbackSnapshot(params);
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

async function buildFallbackSnapshot(params: Record<string, string>): Promise<SnapshotResponse> {
  const txRecords = await buildFallbackTxList(params);
  const snapRows = txRecords.map((r) => ({
    tx_id: r.tx_id,
    amount: r.amount,
    currency: r.currency,
    tx_type: r.tx_type,
    category: r.category,
    date: r.date,
    created_on: r.date,
    source: r.source,
    description: r.description,
  }));
  
  let source_balances: SourceRow[] = [];
  const srcCache = await offlineDb.caches.get("lookups:sources:all");
  if (srcCache && Array.isArray(srcCache.payload)) {
    source_balances = srcCache.payload as SourceRow[];
  }

  return {
    ...emptyDashboardSnapshot(),
    transactions_for_month: snapRows,
    source_balances,
  };
}

/** @deprecated Use fetchAppSnapshot with URL-derived params */
export async function getSnapshotCurrentMonth(): Promise<SnapshotResponse> {
  return fetchAppSnapshot({ current_month: "1" });
}
