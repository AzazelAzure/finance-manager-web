import { offlineDb } from "./db";

/** Stable cache row id for snapshot GET params (dashboard URL → API params). */
export function snapshotParamsCacheKey(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return `snapshot:${JSON.stringify(Object.fromEntries(entries))}`;
}

export async function readCachePayload(id: string): Promise<unknown | null> {
  const row = await offlineDb.caches.get(id);
  return row?.payload ?? null;
}

export async function writeCachePayload(id: string, payload: unknown, fetchedAt: number): Promise<void> {
  await offlineDb.caches.put({ id, payload, fetchedAt });
}

function cacheKeyForTxFilters(filters: Record<string, unknown>): string {
  const entries = Object.entries(filters).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return `txlist:${JSON.stringify(Object.fromEntries(entries))}`;
}

export async function writeTxListCache(
  filters: Record<string, unknown>,
  rows: unknown[],
  fetchedAt: number,
): Promise<void> {
  await writeCachePayload(cacheKeyForTxFilters(filters), rows, fetchedAt);
}

export async function readTxListCache(filters: Record<string, unknown>): Promise<unknown[] | null> {
  const raw = await readCachePayload(cacheKeyForTxFilters(filters));
  return Array.isArray(raw) ? raw : null;
}
