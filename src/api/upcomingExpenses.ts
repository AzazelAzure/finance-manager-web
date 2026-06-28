import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import { applyUpcomingOutboxToList } from "../offline/upcomingOutboxOverlay";
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

export function normalizeUpcomingRow(row: Partial<UpcomingExpenseRecord>): UpcomingExpenseRecord {
  const isRecur = (row as { is_recurring?: boolean }).is_recurring;
  const billClass = row.bill_class === "volatile" ? "volatile" : "rigid";
  return {
    name: String(row.name ?? "").trim(),
    amount: String(row.amount ?? "0"),
    currency: String(row.currency ?? "USD").toUpperCase(),
    due_date: String(row.due_date ?? ""),
    paid_flag: Boolean(row.paid_flag),
    recurring_flag: Boolean(row.recurring_flag ?? isRecur),
    bill_class: billClass,
    planned_partial_amount: row.planned_partial_amount == null ? null : String(row.planned_partial_amount),
    cycle_residual_amount: row.cycle_residual_amount == null ? null : String(row.cycle_residual_amount),
    remainder_due_date: row.remainder_due_date ? String(row.remainder_due_date) : null,
    source: row.source ? String(row.source) : "",
    start_date: row.start_date ? String(row.start_date) : "",
    end_date: row.end_date ? String(row.end_date) : "",
  };
}

export async function listUpcomingExpenses(opts?: PwaReadBypassOpts): Promise<UpcomingExpenseRecord[]> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(UPCOMING_LIST_CACHE_ID);
    if (Array.isArray(raw)) {
      const base = raw
        .map((r) => normalizeUpcomingRow(r as Partial<UpcomingExpenseRecord>))
        .filter((r) => Boolean(r.name));
      return applyUpcomingOutboxToList(base);
    }
    return applyUpcomingOutboxToList([]);
  }
  if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(UPCOMING_LIST_CACHE_ID);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (Array.isArray(raw)) {
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(UPCOMING_LIST_CACHE_ID, async () => {
          const { data } = await api.get<UpcomingExpenseListResponse>("/finance/upcoming_expenses/");
          const rows = Array.isArray(data) ? data : data.expenses ?? data.items ?? data.results ?? [];
          const normalized = rows
            .map((row) => normalizeUpcomingRow(row))
            .filter((row) => Boolean(row.name));
          await writeCachePayload(UPCOMING_LIST_CACHE_ID, normalized, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"], refetchType: "all" });
        });
      }
      return applyUpcomingOutboxToList(
        raw
          .map((r) => normalizeUpcomingRow(r as Partial<UpcomingExpenseRecord>))
          .filter((r) => Boolean(r.name)),
      );
    }
  }
  const { data } = await api.get<UpcomingExpenseListResponse>("/finance/upcoming_expenses/");
  const rows = Array.isArray(data) ? data : data.expenses ?? data.items ?? data.results ?? [];
  const normalized = rows
    .map((row) => normalizeUpcomingRow(row))
    .filter((row) => Boolean(row.name));
  void writeCachePayload(UPCOMING_LIST_CACHE_ID, normalized, Date.now()).catch(() => undefined);
  return applyUpcomingOutboxToList(normalized);
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

export async function catchUpUpcomingExpense(
  name: string,
  periods?: number,
): Promise<{ periods_advanced?: number; periods_missed?: number }> {
  const safeName = encodeURIComponent(name);
  const res = await api.post<{ periods_advanced?: number; periods_missed?: number }>(
    `/finance/upcoming_expenses/${safeName}/catch-up/`,
    periods != null ? { periods } : {},
  );
  return res.data;
}

export async function deleteUpcomingExpense(name: string): Promise<void | OfflineQueuedResult> {
  const safeName = encodeURIComponent(name);
  const res = await api.delete<OfflineQueuedResult | void>(`/finance/upcoming_expenses/${safeName}/`);
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
}
