import { fetchAppSnapshot } from "../api/snapshot";
import { getAppProfile } from "../api/profile";
import { getCurrentUserEmail } from "../api/user";
import { listCategories, listSourceNames, listTags, listTransactionsForTotals } from "../api/lookups";
import {
  getTransactionsCalendar,
  getTransactionsVisualization,
  listTransactions,
  listUnpaidExpenseNames,
} from "../api/transactions";
import { listUpcomingExpenses } from "../api/upcomingExpenses";
import { fetchBalanceHistory } from "../api/balanceHistory";
import { preferOfflineCaches } from "./connectivity";
import { offlineDb } from "./db";
import { syncMinimalExchangeRates } from "./exchangeRates";

/** v3: broad prefetch — snapshots, tx slices, totals, upcoming, calendar/viz windows, FX. */
const SEED_META_KEY = "offline_seed_v3";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * ~3 month window of list reads + dashboard snapshots + lookups + profile + calendar/viz
 * + wide totals list for offline UX (D1 seeding doc).
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
  const rangeFilters = { start_date, end_date };

  const now = new Date();
  const curStart = isoDate(startOfMonth(now));
  const curEnd = isoDate(endOfMonth(now));
  const prevMonthAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const prevStart = isoDate(startOfMonth(prevMonthAnchor));
  const prevEnd = isoDate(endOfMonth(prevMonthAnchor));
  const ytdStart = `${now.getFullYear()}-01-01`;
  const today = isoDate(now);

  const heatModes = ["net", "expense_only", "count"] as const;

  try {
    await Promise.all([
      getAppProfile(),
      getCurrentUserEmail(),
      fetchAppSnapshot({}),
      fetchAppSnapshot({ current_month: "1" }),
      fetchAppSnapshot({ last_month: "1" }),
      fetchAppSnapshot({ previous_week: "1" }),
      listTags(),
      listCategories(),
      listSourceNames(),
    ]);

    await Promise.all([
      listTransactions({}),
      listTransactions({ current_month: "1" }),
      listTransactions({ last_month: "1" }),
      listTransactions({ previous_week: "1" }),
      listTransactions(rangeFilters),
    ]);

    await listTransactionsForTotals();
    await listUpcomingExpenses();
    await listUnpaidExpenseNames();

    for (const heat_metric_mode of heatModes) {
      await getTransactionsCalendar({
        start_date: curStart,
        end_date: curEnd,
        display_currency_mode: "base",
        heat_metric_mode,
      });
    }
    for (const heat_metric_mode of heatModes) {
      await getTransactionsCalendar({
        start_date: prevStart,
        end_date: prevEnd,
        display_currency_mode: "base",
        heat_metric_mode,
      });
    }

    await getTransactionsVisualization({ start_date: curStart, end_date: curEnd });
    await getTransactionsVisualization({ start_date: prevStart, end_date: prevEnd });
    await getTransactionsVisualization({ start_date: ytdStart, end_date: today });

    await Promise.all([
      fetchBalanceHistory({ range: "30d" }),
      fetchBalanceHistory({ range: "90d" }),
    ]);

    await syncMinimalExchangeRates(true);
    await offlineDb.meta.put({ key: SEED_META_KEY, value: true });
  } catch {
    // Network or auth — retry on next app mount when online.
  }
}
