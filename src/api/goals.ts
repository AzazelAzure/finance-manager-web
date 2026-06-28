import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import { api } from "./client";

export const GOALS_LIST_CACHE_ID = "goals:list";

export type SavingsGoal = {
  id: number;
  name: string;
  target_amount: string;
  currency: string;
  target_date: string;
  current_amount: string;
  source: string | null;
  per_cycle_required: string;
};

export type SavingsGoalWritePayload = {
  name: string;
  target_amount: string;
  currency: string;
  target_date: string;
  current_amount: string;
  source?: string | null;
};

function normalizeGoal(row: Partial<SavingsGoal>): SavingsGoal {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    target_amount: String(row.target_amount ?? "0"),
    currency: String(row.currency ?? "USD"),
    target_date: String(row.target_date ?? ""),
    current_amount: String(row.current_amount ?? "0"),
    source: row.source == null || row.source === "" ? null : String(row.source),
    per_cycle_required: String(row.per_cycle_required ?? "0"),
  };
}

export async function listGoals(opts?: PwaReadBypassOpts): Promise<SavingsGoal[]> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(GOALS_LIST_CACHE_ID);
    if (Array.isArray(raw)) {
      return raw.map((row) => normalizeGoal(row as Partial<SavingsGoal>));
    }
    return [];
  }
  if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(GOALS_LIST_CACHE_ID);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (Array.isArray(raw)) {
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(GOALS_LIST_CACHE_ID, async () => {
          const { data } = await api.get<SavingsGoal[]>("/finance/savings-goals/");
          const normalized = (data ?? []).map((item) => normalizeGoal(item));
          await writeCachePayload(GOALS_LIST_CACHE_ID, normalized, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["goals"], refetchType: "all" });
        });
      }
      return (raw as Partial<SavingsGoal>[]).map((item) => normalizeGoal(item));
    }
  }
  try {
    const { data } = await api.get<SavingsGoal[]>("/finance/savings-goals/");
    const normalized = (data ?? []).map((item) => normalizeGoal(item));
    await writeCachePayload(GOALS_LIST_CACHE_ID, normalized, Date.now());
    return normalized;
  } catch (err) {
    if (!window.navigator.onLine) {
      const raw = await readCachePayload(GOALS_LIST_CACHE_ID);
      if (Array.isArray(raw)) {
        return raw.map((row) => normalizeGoal(row as Partial<SavingsGoal>));
      }
      return [];
    }
    throw err;
  }
}

export async function createGoal(
  data: Omit<SavingsGoalWritePayload, never>,
): Promise<SavingsGoal> {
  const res = await api.post<SavingsGoal>("/finance/savings-goals/", data);
  return normalizeGoal(res.data);
}

export async function updateGoal(
  id: number,
  data: Partial<Omit<SavingsGoalWritePayload, never>>,
): Promise<SavingsGoal> {
  const res = await api.patch<SavingsGoal>(`/finance/savings-goals/${id}/`, data);
  return normalizeGoal(res.data);
}

export async function deleteGoal(id: number): Promise<void> {
  await api.delete(`/finance/savings-goals/${id}/`);
}
