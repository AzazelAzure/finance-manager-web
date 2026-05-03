import { preferOfflineCaches } from "../offline/connectivity";
import { readTxListCache, writeTxListCache } from "../offline/cache";
import { applyTransactionOutboxToList } from "../offline/transactionOutboxOverlay";
import { api } from "./client";
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
): Promise<TransactionMutationResult | OfflineQueuedResult> {
  const res = await api.delete<TransactionMutationResult | OfflineQueuedResult>(`/finance/transactions/${txId}/`);
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
  const { data } = await api.get<CalendarResponse>("/finance/transactions/calendar/", { params });
  return data ?? {};
}

export async function getTransactionsVisualization(params: {
  start_date: string;
  end_date: string;
}): Promise<VisualizationResponse> {
  const { data } = await api.get<VisualizationResponse>("/finance/transactions/visualization/", {
    params,
  });
  return data ?? {};
}

export async function listUnpaidExpenseNames(): Promise<string[]> {
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
