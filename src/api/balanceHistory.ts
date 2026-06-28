import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import { api } from "./client";
import type { BalanceHistoryRange, BalanceHistoryResponse } from "./types";

export function balanceHistoryCacheKey(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return `balance-history:${JSON.stringify(Object.fromEntries(entries))}`;
}

export type FetchBalanceHistoryParams = {
  range?: BalanceHistoryRange;
  source?: string;
  start_date?: string;
  end_date?: string;
};

export async function fetchBalanceHistory(
  params: FetchBalanceHistoryParams = {},
  opts?: PwaReadBypassOpts,
): Promise<BalanceHistoryResponse> {
  const query: Record<string, string> = {};
  if (params.range) {
    query.range = params.range;
  }
  if (params.source) {
    query.source = params.source;
  }
  if (params.start_date) {
    query.start_date = params.start_date;
  }
  if (params.end_date) {
    query.end_date = params.end_date;
  }
  const cacheId = balanceHistoryCacheKey(query);

  if (preferOfflineCaches()) {
    const raw = await readCachePayload(cacheId);
    if (raw && typeof raw === "object" && "series" in raw) {
      return raw as BalanceHistoryResponse;
    }
    return { series: [], base_currency: "USD" };
  }

  if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(cacheId);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (raw && typeof raw === "object" && "series" in raw) {
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(cacheId, async () => {
          const { data } = await api.get<BalanceHistoryResponse>("/finance/balance-history/", { params: query });
          await writeCachePayload(cacheId, data, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["balance-history"], refetchType: "all" });
        });
      }
      return raw as BalanceHistoryResponse;
    }
  }

  try {
    const { data } = await api.get<BalanceHistoryResponse>("/finance/balance-history/", { params: query });
    await writeCachePayload(cacheId, data, Date.now());
    return data;
  } catch (err) {
    if (!window.navigator.onLine) {
      const raw = await readCachePayload(cacheId);
      if (raw && typeof raw === "object" && "series" in raw) {
        return raw as BalanceHistoryResponse;
      }
      return { series: [], base_currency: "USD" };
    }
    throw err;
  }
}
