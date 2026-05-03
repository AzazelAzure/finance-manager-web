import { preferOfflineCaches } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { api } from "./client";
import type {
  CategoryRow,
  SourceRow,
  TagsListResponse,
  TransactionRecord,
  TransactionsListResponse,
} from "./types";

const TAGS_CACHE_ID = "lookups:tags:all";
const CATEGORIES_CACHE_ID = "lookups:categories:all";
const SOURCES_CACHE_ID = "lookups:sources:all";

export async function listTags(): Promise<string[]> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(TAGS_CACHE_ID);
    return Array.isArray(raw) ? (raw as string[]) : [];
  }
  const { data } = await api.get<TagsListResponse>("/finance/tags/");
  const tags = data.tags ?? [];
  await writeCachePayload(TAGS_CACHE_ID, tags, Date.now());
  return tags;
}

export async function listCategories(): Promise<string[]> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(CATEGORIES_CACHE_ID);
    return Array.isArray(raw) ? (raw as string[]) : [];
  }
  const { data } = await api.get<CategoryRow[]>("/finance/categories/");
  const names = (data ?? [])
    .map((c) => (typeof c?.name === "string" ? c.name.trim() : ""))
    .filter((name) => Boolean(name));
  await writeCachePayload(CATEGORIES_CACHE_ID, names, Date.now());
  return names;
}

export async function listSourceNames(): Promise<SourceRow[]> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(SOURCES_CACHE_ID);
    return Array.isArray(raw) ? (raw as SourceRow[]) : [];
  }
  const { data } = await api.get<SourceRow[]>("/finance/sources/");
  const rows = (data ?? []).filter((row) => String(row.source ?? "").trim().toLowerCase() !== "unknown");
  await writeCachePayload(SOURCES_CACHE_ID, rows, Date.now());
  return rows;
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

export async function listTransactionsForTotals(): Promise<TransactionRecord[]> {
  const params = new URLSearchParams({
    start_date: "2000-01-01",
    end_date: "2100-01-01",
  });
  const { data } = await api.get<TransactionsListResponse>(`/finance/transactions/?${params.toString()}`);
  return data.transactions ?? [];
}
