import { api } from "./client";
import type { CategoryRow, SourceRow, TagsListResponse } from "./types";

export async function listTags(): Promise<string[]> {
  const { data } = await api.get<TagsListResponse>("/finance/tags/");
  return data.tags ?? [];
}

export async function listCategories(): Promise<string[]> {
  const { data } = await api.get<CategoryRow[]>("/finance/categories/");
  return (data ?? []).map((c) => c.name);
}

export async function listSourceNames(): Promise<SourceRow[]> {
  const { data } = await api.get<SourceRow[]>("/finance/sources/");
  return data ?? [];
}
