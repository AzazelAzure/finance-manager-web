import { api } from "./client";
import type {
  CategoryRow,
  SourceRow,
  TagsListResponse,
  TransactionRecord,
  TransactionsListResponse,
} from "./types";

export async function listTags(): Promise<string[]> {
  const { data } = await api.get<TagsListResponse>("/finance/tags/");
  return data.tags ?? [];
}

export async function listCategories(): Promise<string[]> {
  const { data } = await api.get<CategoryRow[]>("/finance/categories/");
  return (data ?? [])
    .map((c) => (typeof c?.name === "string" ? c.name.trim() : ""))
    .filter((name) => Boolean(name));
}

export async function listSourceNames(): Promise<SourceRow[]> {
  const { data } = await api.get<SourceRow[]>("/finance/sources/");
  return (data ?? []).filter((row) => String(row.source ?? "").trim().toLowerCase() !== "unknown");
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
