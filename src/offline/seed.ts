import { listTransactions } from "../api/transactions";
import { listUpcomingExpenses } from "../api/upcomingExpenses";
import { writeTxListCache } from "./cache";
import { offlineDb } from "./db";

const SEED_META_KEY = "offline_seed_v1";

/**
 * ~3 month window of list reads for offline UX (D1 seeding doc). Runs once per browser profile.
 */
export async function seedOfflineWindow(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.onLine) {
    return;
  }
  const done = await offlineDb.meta.get(SEED_META_KEY);
  if (done?.value) {
    return;
  }
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 92);
  const start_date = start.toISOString().slice(0, 10);
  const end_date = end.toISOString().slice(0, 10);
  const filters = { start_date, end_date };
  try {
    const txs = await listTransactions(filters);
    await writeTxListCache(filters, txs as unknown[], Date.now());
    const upcoming = await listUpcomingExpenses();
    await offlineDb.caches.put({
      id: "upcoming:list",
      payload: upcoming,
      fetchedAt: Date.now(),
    });
    await offlineDb.meta.put({ key: SEED_META_KEY, value: true });
  } catch {
    // Network or auth — retry on next app mount when online.
  }
}
