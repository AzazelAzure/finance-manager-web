import {
  CATEGORIES_CACHE_ID,
  SOURCES_CACHE_ID,
  TAGS_CACHE_ID,
} from "../api/lookups";
import type { SourceRow, UpcomingExpenseRecord } from "../api/types";
import { normalizeUpcomingRow, UPCOMING_LIST_CACHE_ID } from "../api/upcomingExpenses";
import { offlineDb } from "./db";
import {
  applyCategoryOutboxToList,
  applySourceOutboxToList,
  applyTagOutboxToList,
} from "./lookupsOutboxOverlay";
import { applyUpcomingOutboxToList } from "./upcomingOutboxOverlay";

/** Rewrite Dexie lookup caches so queued mutators appear before the next network read. */
export async function mergeLookupsDexieCachesAfterOutboxEnqueue(): Promise<void> {
  const tagRow = await offlineDb.caches.get(TAGS_CACHE_ID);
  if (tagRow && Array.isArray(tagRow.payload)) {
    const merged = await applyTagOutboxToList(tagRow.payload as string[]);
    await offlineDb.caches.put({ id: TAGS_CACHE_ID, payload: merged, fetchedAt: tagRow.fetchedAt });
  }
  const catRow = await offlineDb.caches.get(CATEGORIES_CACHE_ID);
  if (catRow && Array.isArray(catRow.payload)) {
    const merged = await applyCategoryOutboxToList(catRow.payload as string[]);
    await offlineDb.caches.put({ id: CATEGORIES_CACHE_ID, payload: merged, fetchedAt: catRow.fetchedAt });
  }
  const srcRow = await offlineDb.caches.get(SOURCES_CACHE_ID);
  if (srcRow && Array.isArray(srcRow.payload)) {
    const merged = await applySourceOutboxToList(srcRow.payload as SourceRow[]);
    await offlineDb.caches.put({ id: SOURCES_CACHE_ID, payload: merged, fetchedAt: srcRow.fetchedAt });
  }
}

export async function mergeUpcomingListDexieCacheAfterOutboxEnqueue(): Promise<void> {
  const row = await offlineDb.caches.get(UPCOMING_LIST_CACHE_ID);
  if (!row || !Array.isArray(row.payload)) {
    return;
  }
  const base = row.payload
    .map((r) => normalizeUpcomingRow(r as Partial<UpcomingExpenseRecord>))
    .filter((r) => Boolean(r.name));
  const merged = await applyUpcomingOutboxToList(base);
  await offlineDb.caches.put({ id: UPCOMING_LIST_CACHE_ID, payload: merged, fetchedAt: row.fetchedAt });
}
