import { preferOfflineCaches } from "../offline/connectivity";
import {
  calendarParamsCacheKey,
  readCachePayload,
  visualizationParamsCacheKey,
  writeCachePayload,
  readTxListCache,
  writeTxListCache,
} from "../offline/cache";
import { buildCalendarResponseFromTransactions } from "../offline/calendarOffline";
import { loadCurrencyConverter } from "../offline/exchangeRates";
import { buildVisualizationFromTransactions } from "../offline/visualizationOffline";
import { applyTransactionOutboxToList } from "../offline/transactionOutboxOverlay";
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

export async function listTransactions(filters: TransactionFilters = {}): Promise<TransactionRecord[]> {
  const filterRecord = filters as Record<string, unknown>;
  let rows: TransactionRecord[];
  if (preferOfflineCaches()) {
    const cached = await readTxListCache(filterRecord);
    rows = cached ? (cached as TransactionRecord[]) : [];
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
  const { data } = await api.get<{ transaction?: TransactionRecord } | TransactionRecord>(
    `/finance/transactions/${txId}/`,
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
  const res = await api.patch<TransactionRecord | OfflineQueuedResult>(`/finance/transactions/${txId}/`, payload);
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

export async function getTransactionsCalendar(params: {
  start_date: string;
  end_date: string;
  display_currency_mode: "base" | "original";
  heat_metric_mode: "net" | "expense_only" | "count";
}): Promise<CalendarResponse> {
  const cacheId = calendarParamsCacheKey(params as unknown as Record<string, string>);
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(cacheId);
    if (raw && typeof raw === "object" && "daily" in raw) {
      return raw as CalendarResponse;
    }
    const cv = await loadCurrencyConverter();
    const rows = await listTransactions({
      start_date: params.start_date,
      end_date: params.end_date,
    });
    return buildCalendarResponseFromTransactions(rows, params, cv);
  }
  const { data } = await api.get<CalendarResponse>("/finance/transactions/calendar/", { params });
  const payload = data ?? {};
  void writeCachePayload(cacheId, payload, Date.now()).catch(() => undefined);
  return payload;
}

export async function getTransactionsVisualization(params: {
  start_date: string;
  end_date: string;
}): Promise<VisualizationResponse> {
  const cacheId = visualizationParamsCacheKey(params);
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(cacheId);
    if (raw && typeof raw === "object" && "flow_daily" in raw) {
      return raw as VisualizationResponse;
    }
    const cv = await loadCurrencyConverter();
    const rows = await listTransactions({
      start_date: params.start_date,
      end_date: params.end_date,
    });
    return buildVisualizationFromTransactions(rows, params, cv);
  }
  const { data } = await api.get<VisualizationResponse>("/finance/transactions/visualization/", {
    params,
  });
  const payload = data ?? {};
  void writeCachePayload(cacheId, payload, Date.now()).catch(() => undefined);
  return payload;
}

export async function listUnpaidExpenseNames(): Promise<string[]> {
  if (preferOfflineCaches()) {
    const all = await listUpcomingExpenses();
    const names = all
      .filter((row) => !row.paid_flag)
      .map((row) => String(row.name ?? "").trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }
  const { data } = await api.get<{ expenses?: Array<{ name?: string }> } | Array<{ name?: string }>>(
    "/finance/upcoming_expenses/",
    { params: { paid_flag: "false" } },
  );
  const rows = Array.isArray(data) ? data : data.expenses ?? [];
  const names = rows
    .map((row) => String(row?.name ?? "").trim())
    .filter((name) => Boolean(name));
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}
