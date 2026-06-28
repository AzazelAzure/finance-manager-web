import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { outboxDepth } from "../offline/outbox";
import axios from "axios";
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
import {
  isOfflineQueued,
  type CategoryRow,
  type OfflineQueuedResult,
  type SourceRow,
  type TagsListResponse,
  type TransactionRecord,
} from "./types";

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

export async function createCategory(name: string): Promise<CategoryRow | OfflineQueuedResult> {
  const res = await api.post<CategoryRow | OfflineQueuedResult>("/finance/categories/", { name });
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
  return res.data as CategoryRow;
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

export async function createSource(payload: SourceMutationPayload): Promise<void | OfflineQueuedResult> {
  const res = await api.post<void | OfflineQueuedResult>("/finance/sources/", payload);
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
  return;
}

export async function updateSource(currentName: string, payload: Partial<SourceMutationPayload>): Promise<void> {
  await api.patch(`/finance/sources/${encodeURIComponent(currentName)}/`, payload);
}

export async function deleteSource(sourceName: string): Promise<void> {
  await api.delete(`/finance/sources/${encodeURIComponent(sourceName)}/`);
}

export async function createTag(name: string): Promise<void | OfflineQueuedResult> {
  const res = await api.post<void | OfflineQueuedResult>("/finance/tags/", { tags: [name] });
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
  return;
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

function exportDateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function parseBlobApiError(error: unknown): Promise<string> {
  if (!axios.isAxiosError(error) || !(error.response?.data instanceof Blob)) {
    return parseApiErrorForExport(error);
  }
  try {
    const text = await error.response.data.text();
    const data = JSON.parse(text) as unknown;
    if (data && typeof data === "object") {
      const parts = Object.entries(data as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`);
      if (parts.length > 0) {
        return `HTTP ${error.response.status}: ${parts.join(" | ")}`;
      }
    }
    if (typeof data === "string" && data.trim()) {
      return `HTTP ${error.response.status}: ${data}`;
    }
  } catch {
    // fall through
  }
  return `HTTP ${error.response.status}: Request rejected.`;
}

function parseApiErrorForExport(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Request failed.";
  }
  const status = error.response?.status;
  const data = error.response?.data;
  if (Array.isArray(data)) {
    const rendered = data.map((item) => String(item)).join(" | ");
    return status ? `HTTP ${status}: ${rendered}` : rendered;
  }
  if (data && typeof data === "object") {
    const parts = Object.entries(data as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`);
    if (parts.length > 0) {
      return status ? `HTTP ${status}: ${parts.join(" | ")}` : parts.join(" | ");
    }
  }
  if (typeof data === "string" && data.trim()) {
    return status ? `HTTP ${status}: ${data}` : data;
  }
  return status ? `HTTP ${status}: Request rejected.` : error.message;
}

async function assertExportOnline(): Promise<void> {
  if (preferOfflineCaches()) {
    throw new Error("Export not available offline");
  }
  const depth = await outboxDepth();
  if (depth > 0) {
    throw new Error("Export not available while offline changes are pending sync");
  }
}

/** Online-only: downloads uid-scoped transaction CSV (F-010 T03). */
export async function downloadCsvExport(dateFrom?: string, dateTo?: string): Promise<void> {
  await assertExportOnline();
  const params: Record<string, string> = {};
  if (dateFrom) {
    params.date_from = dateFrom;
  }
  if (dateTo) {
    params.date_to = dateTo;
  }
  const res = await api.get("/finance/export/transactions/csv/", {
    params,
    responseType: "blob",
  });
  triggerBlobDownload(res.data as Blob, `hfm_transactions_${exportDateStamp()}.csv`);
}

/** Online-only: downloads full JSON backup (F-010 T03). */
export async function downloadFullBackup(): Promise<void> {
  await assertExportOnline();
  const res = await api.get("/finance/export/full/", { responseType: "blob" });
  triggerBlobDownload(res.data as Blob, `hfm_backup_${exportDateStamp()}.json`);
}
