import { fetchAppSnapshot } from "../api/snapshot";
import { getAppProfile } from "../api/profile";
import { listCategories, listSourceNames, listTags } from "../api/lookups";
import { listTransactions } from "../api/transactions";
import { listUpcomingExpenses } from "../api/upcomingExpenses";
import { preferOfflineCaches } from "./connectivity";
import { offlineDb } from "./db";

/** v2: seeds dashboard snapshot + lookups + profile in addition to tx/upcoming lists. */
const SEED_META_KEY = "offline_seed_v2";

/**
 * ~3 month window of list reads + dashboard snapshot for offline UX (D1 seeding doc).
 * Runs once per browser profile (until meta set); new meta key forces a fresh full seed for existing users.
 */
export async function seedOfflineWindow(): Promise<void> {
  if (typeof navigator === "undefined" || preferOfflineCaches()) {
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
    await Promise.all([getAppProfile(), fetchAppSnapshot({}), listTags(), listCategories(), listSourceNames()]);
    await listTransactions(filters);
    await listUpcomingExpenses();
    await offlineDb.meta.put({ key: SEED_META_KEY, value: true });
  } catch {
    // Network or auth — retry on next app mount when online.
  }
}
