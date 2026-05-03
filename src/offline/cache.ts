import { offlineDb } from "./db";

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
  await offlineDb.caches.put({
    id: cacheKeyForTxFilters(filters),
    payload: rows,
    fetchedAt,
  });
}

export async function readTxListCache(filters: Record<string, unknown>): Promise<unknown[] | null> {
  const row = await offlineDb.caches.get(cacheKeyForTxFilters(filters));
  if (!row) {
    return null;
  }
  return Array.isArray(row.payload) ? (row.payload as unknown[]) : null;
}
