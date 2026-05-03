import { preferOfflineCaches } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { api } from "./client";
import {
  isOfflineQueued,
  type OfflineQueuedResult,
  type UpcomingExpenseMutationPayload,
  type UpcomingExpenseRecord,
} from "./types";

type UpcomingExpenseListResponse =
  | UpcomingExpenseRecord[]
  | {
      expenses?: UpcomingExpenseRecord[];
      items?: UpcomingExpenseRecord[];
      results?: UpcomingExpenseRecord[];
    };

export const UPCOMING_LIST_CACHE_ID = "upcoming:list";

function normalizeUpcomingRow(row: Partial<UpcomingExpenseRecord>): UpcomingExpenseRecord {
  const isRecur = (row as { is_recurring?: boolean }).is_recurring;
  return {
    name: String(row.name ?? "").trim(),
    amount: String(row.amount ?? "0"),
    currency: String(row.currency ?? "USD").toUpperCase(),
    due_date: String(row.due_date ?? ""),
    paid_flag: Boolean(row.paid_flag),
    recurring_flag: Boolean(row.recurring_flag ?? isRecur),
    source: row.source ? String(row.source) : "",
    start_date: row.start_date ? String(row.start_date) : "",
    end_date: row.end_date ? String(row.end_date) : "",
  };
}

export async function listUpcomingExpenses(): Promise<UpcomingExpenseRecord[]> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(UPCOMING_LIST_CACHE_ID);
    if (Array.isArray(raw)) {
      return raw
        .map((r) => normalizeUpcomingRow(r as Partial<UpcomingExpenseRecord>))
        .filter((r) => Boolean(r.name));
    }
    return [];
  }
  const { data } = await api.get<UpcomingExpenseListResponse>("/finance/upcoming_expenses/");
  const rows = Array.isArray(data) ? data : data.expenses ?? data.items ?? data.results ?? [];
  const normalized = rows
    .map((row) => normalizeUpcomingRow(row))
    .filter((row) => Boolean(row.name));
  void writeCachePayload(UPCOMING_LIST_CACHE_ID, normalized, Date.now()).catch(() => undefined);
  return normalized;
}

export async function createUpcomingExpense(
  payload: UpcomingExpenseMutationPayload,
): Promise<UpcomingExpenseRecord | OfflineQueuedResult> {
  const res = await api.post<UpcomingExpenseRecord | OfflineQueuedResult>("/finance/upcoming_expenses/", payload);
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
  return normalizeUpcomingRow(res.data as UpcomingExpenseRecord);
}

export async function updateUpcomingExpense(
  originalName: string,
  payload: Partial<UpcomingExpenseMutationPayload>,
): Promise<UpcomingExpenseRecord | OfflineQueuedResult> {
  const safeName = encodeURIComponent(originalName);
  const res = await api.patch<UpcomingExpenseRecord | OfflineQueuedResult>(
    `/finance/upcoming_expenses/${safeName}/`,
    payload,
  );
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
  return normalizeUpcomingRow(res.data as UpcomingExpenseRecord);
}

export async function deleteUpcomingExpense(name: string): Promise<void | OfflineQueuedResult> {
  const safeName = encodeURIComponent(name);
  const res = await api.delete<OfflineQueuedResult | void>(`/finance/upcoming_expenses/${safeName}/`);
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
}
