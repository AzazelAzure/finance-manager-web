import { offlineDb } from "./db";
import {
  buildPendingTransactionRecordsFromPostBody,
  sortLedgerTransactionsByDate,
  transactionMatchesTxListQuery,
} from "./transactionOutboxOverlay";
import type { TransactionRecord } from "../api/types";

const TXLIST_PREFIX = "txlist:";

/**
 * After a queued POST /finance/transactions/, merge synthetic pending rows into every
 * materialized `txlist:*` Dexie cache row so PWA cache-first reads match listTransactions()
 * (outbox overlay) without waiting for a refetch.
 */
export async function mergePendingPostIntoTxListCaches(body: unknown, idempotencyKey: string): Promise<void> {
  const pending = buildPendingTransactionRecordsFromPostBody(body, idempotencyKey);
  if (pending.length === 0) {
    return;
  }
  const rows = await offlineDb.caches.toArray();
  for (const row of rows) {
    if (!row.id.startsWith(TXLIST_PREFIX)) {
      continue;
    }
    let rawFilters: Record<string, unknown>;
    try {
      rawFilters = JSON.parse(row.id.slice(TXLIST_PREFIX.length)) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!Array.isArray(row.payload)) {
      continue;
    }
    const list = row.payload as TransactionRecord[];
    let changed = false;
    for (const rec of pending) {
      if (!transactionMatchesTxListQuery(rec, rawFilters)) {
        continue;
      }
      if (list.some((r) => r.tx_id === rec.tx_id)) {
        continue;
      }
      list.push({ ...rec, tags: [...(rec.tags ?? [])] });
      changed = true;
    }
    if (changed) {
      list.sort(sortLedgerTransactionsByDate);
      await offlineDb.caches.put({ id: row.id, payload: list, fetchedAt: row.fetchedAt });
    }
  }
}
