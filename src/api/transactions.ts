import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import {
  calendarParamsCacheKey,
  visualizationParamsCacheKey,
  writeCachePayload,
  readTxListCache,
  writeTxListCache,
  txListCacheKey,
} from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import { buildCalendarResponseFromTransactions } from "../offline/calendarOffline";
import { loadCurrencyConverter } from "../offline/exchangeRates";
import { buildVisualizationFromTransactions } from "../offline/visualizationOffline";
import { replacePendingPostInTxListCaches } from "../offline/optimisticTxEnqueue";
import { listOutboxOrdered, parsePendingTransactionIdentity, updateQueuedTransactionPostBody } from "../offline/outbox";
import { findTransactionRecordById, applyTransactionOutboxToList } from "../offline/transactionOutboxOverlay";
import { api } from "./client";
import { listUpcomingExpenses } from "./upcomingExpenses";
import {
  isOfflineQueued,
  type CalendarResponse,
  type OfflineQueuedResult,
  type TransactionCreateRequest,
  type TransactionMutationResult,
  type TransactionPatchRequest,
  type TransactionRecord,
  type TransactionsListResponse,
  type VisualizationResponse,
} from "./types";

export type TransactionFilters = {
  tx_type?: string;
  tag_name?: string;
  category?: string;
  source?: string;
  currency_code?: string;
  start_date?: string;
  end_date?: string;
  date?: string;
  current_month?: string;
  last_month?: string;
  previous_week?: string;
};

export async function listTransactions(
  filters: TransactionFilters = {},
  opts?: PwaReadBypassOpts,
): Promise<TransactionRecord[]> {
  const filterRecord = filters as Record<string, unknown>;
  let rows: TransactionRecord[];
  if (preferOfflineCaches()) {
    const cached = await readTxListCache(filterRecord);
    rows = cached ? (cached as TransactionRecord[]) : [];
  } else if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const cacheId = txListCacheKey(filterRecord);
    const row = await offlineDb.caches.get(cacheId);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (Array.isArray(raw)) {
      rows = raw as TransactionRecord[];
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(cacheId, async () => {
          const { data } = await api.get<TransactionRecord[] | TransactionsListResponse>("/finance/transactions/", {
            params: filters,
          });
          const parsed = Array.isArray(data) ? data : (data.transactions ?? []);
          await writeTxListCache(filterRecord, parsed as unknown[], Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "all" });
        });
      }
    } else {
      const { data } = await api.get<TransactionRecord[] | TransactionsListResponse>("/finance/transactions/", {
        params: filters,
      });
      const parsed = Array.isArray(data) ? data : (data.transactions ?? []);
      rows = parsed;
      void writeTxListCache(filterRecord, rows as unknown[], Date.now()).catch(() => undefined);
    }
  } else {
    const { data } = await api.get<TransactionRecord[] | TransactionsListResponse>("/finance/transactions/", {
      params: filters,
    });
    const parsed = Array.isArray(data) ? data : (data.transactions ?? []);
    rows = parsed;
    void writeTxListCache(filterRecord, rows as unknown[], Date.now()).catch(() => undefined);
  }
  return applyTransactionOutboxToList(rows, filterRecord);
}

export async function getTransaction(txId: string): Promise<TransactionRecord> {
  if (txId.startsWith("pending:") || preferOfflineCaches()) {
    const local = await findTransactionRecordById(txId);
    if (local) {
      return local;
    }
    if (txId.startsWith("pending:")) {
      throw new Error("Queued transaction draft was not found (it may have already synced).");
    }
  }
  if (preferPwaLocalFirstReads()) {
    const local = await findTransactionRecordById(txId);
    if (local) {
      return local;
    }
  }
  const { data } = await api.get<{ transaction?: TransactionRecord } | TransactionRecord>(
    `/finance/transactions/${encodeURIComponent(txId)}/`,
  );
  if ("transaction" in data && data.transaction) {
    return data.transaction;
  }
  return data as TransactionRecord;
}

export async function createTransactions(
  payload: TransactionCreateRequest | TransactionCreateRequest[],
): Promise<TransactionMutationResult | OfflineQueuedResult> {
  const res = await api.post<TransactionMutationResult | OfflineQueuedResult>("/finance/transactions/", payload);
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
  return res.data as TransactionMutationResult;
}

export async function updateTransaction(
  txId: string,
  payload: TransactionPatchRequest,
): Promise<TransactionRecord | OfflineQueuedResult> {
  if (txId.startsWith("pending:")) {
    const ok = await updateQueuedTransactionPostBody(txId, payload);
    if (!ok) {
      throw new Error("Could not update queued transaction draft.");
    }
    const ident = parsePendingTransactionIdentity(txId);
    if (ident) {
      const row = (await listOutboxOrdered()).find(
        (r) =>
          r.idempotencyKey === ident.idempotencyKey &&
          r.method.toUpperCase() === "POST" &&
          /^\/finance\/transactions\/?$/.test(
            (() => {
              const p = r.url.split("?")[0];
              return p.endsWith("/") || p.length === 0 ? p : `${p}/`;
            })(),
          ),
      );
      if (row) {
        await replacePendingPostInTxListCaches(ident.idempotencyKey, row.body);
      }
    }
    const rec = await findTransactionRecordById(txId);
    if (!rec) {
      throw new Error("Updated queued draft but could not re-read it locally.");
    }
    return rec;
  }
  const res = await api.patch<TransactionRecord | OfflineQueuedResult>(
    `/finance/transactions/${encodeURIComponent(txId)}/`,
    payload,
  );
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
  return res.data as TransactionRecord;
}

export async function deleteTransaction(
  txId: string,
  opts?: { echo?: TransactionRecord },
): Promise<TransactionMutationResult | OfflineQueuedResult> {
  const res = await api.request<TransactionMutationResult | OfflineQueuedResult>({
    method: "DELETE",
    url: `/finance/transactions/${encodeURIComponent(txId)}/`,
    ...(opts?.echo
      ? { offlineEcho: { kind: "transaction_delete" as const, record: opts.echo } }
      : {}),
  } as Parameters<typeof api.request>[0]);
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
  return res.data as TransactionMutationResult;
}

export async function getTransactionsCalendar(
  params: {
    start_date: string;
    end_date: string;
    display_currency_mode: "base" | "original";
    heat_metric_mode: "net" | "expense_only" | "count";
  },
  opts?: PwaReadBypassOpts,
): Promise<CalendarResponse> {
  const cacheId = calendarParamsCacheKey(params as unknown as Record<string, string>);
  const bypass = shouldBypassPwaDataCache(opts);
  const aggregateFromMergedList =
    !bypass && (preferOfflineCaches() || preferPwaLocalFirstReads());

  if (preferPwaLocalFirstReads() && !bypass) {
    const row = await offlineDb.caches.get(cacheId);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (raw && typeof raw === "object" && "daily" in raw && isPwaBackgroundStale(fetchedAt)) {
      schedulePwaBackgroundWork(cacheId, async () => {
        const { data } = await api.get<CalendarResponse>("/finance/transactions/calendar/", { params });
        const payload = data ?? {};
        await writeCachePayload(cacheId, payload, Date.now());
        const { queryClient } = await import("../lib/queryClient");
        await queryClient.invalidateQueries({ queryKey: ["transactions-calendar"], refetchType: "all" });
      });
    }
  }

  if (aggregateFromMergedList) {
    const cv = await loadCurrencyConverter();
    const rows = await listTransactions(
      {
        start_date: params.start_date,
        end_date: params.end_date,
      },
      opts,
    );
    return buildCalendarResponseFromTransactions(rows, params, cv);
  }

  const { data } = await api.get<CalendarResponse>("/finance/transactions/calendar/", { params });
  const payload = data ?? {};
  void writeCachePayload(cacheId, payload, Date.now()).catch(() => undefined);
  return payload;
}

export async function getTransactionsVisualization(
  params: {
    start_date: string;
    end_date: string;
  },
  opts?: PwaReadBypassOpts,
): Promise<VisualizationResponse> {
  const cacheId = visualizationParamsCacheKey(params);
  const bypass = shouldBypassPwaDataCache(opts);
  const aggregateFromMergedList =
    !bypass && (preferOfflineCaches() || preferPwaLocalFirstReads());

  if (preferPwaLocalFirstReads() && !bypass) {
    const row = await offlineDb.caches.get(cacheId);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (raw && typeof raw === "object" && "flow_daily" in raw && isPwaBackgroundStale(fetchedAt)) {
      schedulePwaBackgroundWork(cacheId, async () => {
        const { data } = await api.get<VisualizationResponse>("/finance/transactions/visualization/", {
          params,
        });
        const payload = data ?? {};
        await writeCachePayload(cacheId, payload, Date.now());
        const { queryClient } = await import("../lib/queryClient");
        await queryClient.invalidateQueries({ queryKey: ["transactions-viz"], refetchType: "all" });
      });
    }
  }

  if (aggregateFromMergedList) {
    const cv = await loadCurrencyConverter();
    const rows = await listTransactions(
      {
        start_date: params.start_date,
        end_date: params.end_date,
      },
      opts,
    );
    return buildVisualizationFromTransactions(rows, params, cv);
  }

  const { data } = await api.get<VisualizationResponse>("/finance/transactions/visualization/", {
    params,
  });
  const payload = data ?? {};
  void writeCachePayload(cacheId, payload, Date.now()).catch(() => undefined);
  return payload;
}

export async function listUnpaidExpenseNames(opts?: PwaReadBypassOpts): Promise<string[]> {
  const all = await listUpcomingExpenses(opts);
  const names = all
    .filter((row) => !row.paid_flag)
    .map((row) => String(row.name ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}
