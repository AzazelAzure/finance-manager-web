import type { CalendarDueEventRow, CalendarResponse } from "../api/types";
import type { TransactionRecord, UpcomingExpenseRecord } from "../api/types";
import type { CurrencyConverter } from "./exchangeRates";
import { readCachePayload } from "./cache";
import { applyUpcomingOutboxToList } from "./upcomingOutboxOverlay";
import { UPCOMING_LIST_CACHE_ID, normalizeUpcomingRow } from "../api/upcomingExpenses";

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function signedAmountFromTxLike(amountStr: string, txType: string): number {
  const raw = parseFloat(String(amountStr).replace(/,/g, ""));
  if (!Number.isFinite(raw)) {
    return 0;
  }
  const tt = (txType || "").toUpperCase();
  if (tt === "EXPENSE" || tt === "XFER_OUT") {
    return raw <= 0 ? raw : -Math.abs(raw);
  }
  if (tt === "INCOME" || tt === "XFER_IN") {
    return raw >= 0 ? raw : Math.abs(raw);
  }
  return raw;
}

async function readBaseCurrency(): Promise<string> {
  const raw = await readCachePayload("appprofile:root");
  if (raw && typeof raw === "object" && "base_currency" in raw) {
    return String((raw as { base_currency?: string }).base_currency || "USD")
      .trim()
      .toUpperCase();
  }
  return "USD";
}

/** Build calendar aggregates from merged transaction rows (offline / cache-miss). */
export async function buildCalendarResponseFromTransactions(
  rows: TransactionRecord[],
  params: {
    start_date: string;
    end_date: string;
    display_currency_mode: "base" | "original";
    heat_metric_mode: "net" | "expense_only" | "count";
  },
  cv: CurrencyConverter,
): Promise<CalendarResponse> {
  const baseCurrency = await readBaseCurrency();
  const inRange = rows.filter((r) => {
    const d = (r.date || "").slice(0, 10);
    return d >= params.start_date && d <= params.end_date;
  });

  const dailyMap = new Map<string, { amount: number; tx_count: number; heat: number }>();
  const weeklyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const heatMetric = params.heat_metric_mode;

  for (const r of inRange) {
    const txDate = (r.date || "").slice(0, 10);
    if (!txDate) {
      continue;
    }
    const signed = signedAmountFromTxLike(String(r.amount ?? ""), String(r.tx_type ?? ""));
    const useOriginal = params.display_currency_mode === "original";
    const amountBase = useOriginal
      ? signed
      : await cv.toBase(signed, (r.currency || baseCurrency).toUpperCase(), baseCurrency);
    const amountRounded = round2(amountBase);

    const cur = dailyMap.get(txDate) ?? { amount: 0, tx_count: 0, heat: 0 };
    cur.amount = round2(cur.amount + amountRounded);
    cur.tx_count += 1;
    const tt = String(r.tx_type || "").toUpperCase();
    if (heatMetric === "count") {
      cur.heat += 1;
    } else if (heatMetric === "expense_only") {
      if (tt === "EXPENSE" || tt === "XFER_OUT") {
        cur.heat += Math.abs(amountRounded);
      }
    } else {
      cur.heat += Math.abs(amountRounded);
    }
    dailyMap.set(txDate, cur);

    const d = new Date(`${txDate}T12:00:00`);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const wk = weekStart.toISOString().slice(0, 10);
    weeklyMap.set(wk, round2((weeklyMap.get(wk) ?? 0) + amountRounded));

    const ms = `${txDate.slice(0, 7)}-01`;
    monthlyMap.set(ms, round2((monthlyMap.get(ms) ?? 0) + amountRounded));
  }

  const heatValues = [...dailyMap.values()].map((v) => v.heat);
  const heatMax = heatValues.length > 0 ? Math.max(...heatValues, 0) : 0;

  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      amount: v.amount,
      tx_count: v.tx_count,
      heat_value: round2(v.heat),
      heat_intensity: heatMax > 0 ? Math.round((v.heat / heatMax) * 100) : 0,
      net: v.amount,
      expense_only: v.heat,
      count: v.tx_count,
    }));

  const weekly = [...weeklyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, amount]) => ({ period, amount }));

  const monthly = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, amount]) => ({ period, amount }));

  const dayDrill = inRange
    .filter((r) => (r.date || "").slice(0, 10) === params.start_date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.tx_id.localeCompare(b.tx_id));

  // Populate due_events from cached upcoming expenses (with outbox overlay)
  let due_events: CalendarDueEventRow[] = [];
  try {
    const rawUe = await readCachePayload(UPCOMING_LIST_CACHE_ID);
    const baseUe = Array.isArray(rawUe)
      ? rawUe
          .map((r) => normalizeUpcomingRow(r as Partial<UpcomingExpenseRecord>))
          .filter((r) => Boolean(r.name))
      : [];
    const mergedUe = await applyUpcomingOutboxToList(baseUe);
    due_events = mergedUe
      .filter((ue) => {
        const d = (ue.due_date || "").slice(0, 10);
        return d >= params.start_date && d <= params.end_date;
      })
      .map((ue) => ({
        date: ue.due_date,
        expense_name: ue.name,
        amount: ue.amount,
        currency: ue.currency,
        paid_flag: ue.paid_flag,
        is_recurring: ue.recurring_flag,
      }));
  } catch {
    // If upcoming cache read fails, leave due_events empty gracefully
  }

  return {
    start_date: params.start_date,
    end_date: params.end_date,
    base_currency: baseCurrency,
    display_currency_mode: params.display_currency_mode,
    heat_metric_mode: params.heat_metric_mode,
    heat_max: round2(heatMax),
    monthly,
    weekly,
    daily,
    due_events,
    day_drill: dayDrill,
  };
}
