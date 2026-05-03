import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import {
  applyCategoryOutboxToList,
  applySourceOutboxToList,
  applyTagOutboxToList,
} from "../offline/lookupsOutboxOverlay";
import { listTransactions, type TransactionFilters } from "./transactions";
import { api } from "./client";
import type { CategoryRow, SourceRow, TagsListResponse, TransactionRecord } from "./types";

export const TAGS_CACHE_ID = "lookups:tags:all";
export const CATEGORIES_CACHE_ID = "lookups:categories:all";
export const SOURCES_CACHE_ID = "lookups:sources:all";

export async function listTags(opts?: PwaReadBypassOpts): Promise<string[]> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(TAGS_CACHE_ID);
    const base = Array.isArray(raw) ? (raw as string[]) : [];
    return applyTagOutboxToList(base);
  }
  if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(TAGS_CACHE_ID);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (Array.isArray(raw)) {
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(TAGS_CACHE_ID, async () => {
          const { data } = await api.get<TagsListResponse>("/finance/tags/");
          const tags = data.tags ?? [];
          await writeCachePayload(TAGS_CACHE_ID, tags, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["tags", "all"], refetchType: "all" });
        });
      }
      return applyTagOutboxToList(raw as string[]);
    }
  }
  const { data } = await api.get<TagsListResponse>("/finance/tags/");
  const tags = data.tags ?? [];
  await writeCachePayload(TAGS_CACHE_ID, tags, Date.now());
  return applyTagOutboxToList(tags);
}

export async function listCategories(opts?: PwaReadBypassOpts): Promise<string[]> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(CATEGORIES_CACHE_ID);
    const base = Array.isArray(raw) ? (raw as string[]) : [];
    return applyCategoryOutboxToList(base);
  }
  if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(CATEGORIES_CACHE_ID);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (Array.isArray(raw)) {
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(CATEGORIES_CACHE_ID, async () => {
          const { data } = await api.get<CategoryRow[]>("/finance/categories/");
          const names = (data ?? [])
            .map((c) => (typeof c?.name === "string" ? c.name.trim() : ""))
            .filter((name) => Boolean(name));
          await writeCachePayload(CATEGORIES_CACHE_ID, names, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["categories", "all"], refetchType: "all" });
        });
      }
      return applyCategoryOutboxToList(raw as string[]);
    }
  }
  const { data } = await api.get<CategoryRow[]>("/finance/categories/");
  const names = (data ?? [])
    .map((c) => (typeof c?.name === "string" ? c.name.trim() : ""))
    .filter((name) => Boolean(name));
  await writeCachePayload(CATEGORIES_CACHE_ID, names, Date.now());
  return applyCategoryOutboxToList(names);
}

export async function listSourceNames(opts?: PwaReadBypassOpts): Promise<SourceRow[]> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(SOURCES_CACHE_ID);
    const base = Array.isArray(raw) ? (raw as SourceRow[]) : [];
    return applySourceOutboxToList(base);
  }
  if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(SOURCES_CACHE_ID);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (Array.isArray(raw)) {
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(SOURCES_CACHE_ID, async () => {
          const { data } = await api.get<SourceRow[]>("/finance/sources/");
          const rows = (data ?? []).filter((r) => String(r.source ?? "").trim().toLowerCase() !== "unknown");
          await writeCachePayload(SOURCES_CACHE_ID, rows, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["sources", "all"], refetchType: "all" });
        });
      }
      return applySourceOutboxToList(raw as SourceRow[]);
    }
  }
  const { data } = await api.get<SourceRow[]>("/finance/sources/");
  const rows = (data ?? []).filter((r) => String(r.source ?? "").trim().toLowerCase() !== "unknown");
  await writeCachePayload(SOURCES_CACHE_ID, rows, Date.now());
  return applySourceOutboxToList(rows);
}

export async function createCategory(name: string): Promise<CategoryRow> {
  const { data } = await api.post<CategoryRow>("/finance/categories/", { name });
  return data;
}

export async function renameCategory(currentName: string, nextName: string): Promise<void> {
  await api.patch(`/finance/categories/${encodeURIComponent(currentName)}/`, { name: nextName });
}

export async function deleteCategory(name: string): Promise<void> {
  await api.delete(`/finance/categories/${encodeURIComponent(name)}/`);
}

export type SourceMutationPayload = {
  source: string;
  acc_type: string;
  amount: string | number;
  currency: string;
};

export async function createSource(payload: SourceMutationPayload): Promise<void> {
  await api.post("/finance/sources/", payload);
}

export async function updateSource(currentName: string, payload: Partial<SourceMutationPayload>): Promise<void> {
  await api.patch(`/finance/sources/${encodeURIComponent(currentName)}/`, payload);
}

export async function deleteSource(sourceName: string): Promise<void> {
  await api.delete(`/finance/sources/${encodeURIComponent(sourceName)}/`);
}

export async function createTag(name: string): Promise<void> {
  await api.post("/finance/tags/", { tags: [name] });
}

export async function renameTag(currentName: string, nextName: string): Promise<void> {
  await api.patch("/finance/tags/", { tags: { [currentName]: nextName } });
}

export async function deleteTag(name: string): Promise<void> {
  await api.delete("/finance/tags/", { data: { tags: { [name]: "delete" } } });
}

const TOTALS_TX_FILTERS: Record<string, string> = {
  start_date: "2000-01-01",
  end_date: "2100-01-01",
};

export async function listTransactionsForTotals(): Promise<TransactionRecord[]> {
  return listTransactions(TOTALS_TX_FILTERS as TransactionFilters);
}
