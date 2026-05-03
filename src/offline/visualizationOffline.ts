import type { TransactionRecord, VisualizationResponse } from "../api/types";
import type { CurrencyConverter } from "./exchangeRates";
import { readCachePayload } from "./cache";

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

/** Aligns with server `get_transaction_visualization` magnitudes in base currency. */
export async function buildVisualizationFromTransactions(
  rows: TransactionRecord[],
  params: { start_date: string; end_date: string },
  cv: CurrencyConverter,
): Promise<VisualizationResponse> {
  const baseCurrency = await readBaseCurrency();
  const filtered = rows.filter((r) => {
    const d = (r.date || "").slice(0, 10);
    return d >= params.start_date && d <= params.end_date;
  });

  const dailyMap = new Map<string, { income: number; expense: number; net: number; tx_count: number }>();
  const typeTotals: Record<string, number> = {
    EXPENSE: 0,
    INCOME: 0,
    XFER_OUT: 0,
    XFER_IN: 0,
  };
  const expenseCategories = new Map<string, number>();

  for (const r of filtered) {
    const txDate = (r.date || "").slice(0, 10);
    const tt = String(r.tx_type || "").toUpperCase();
    const signed = signedAmountFromTxLike(String(r.amount ?? ""), tt);
    const absBase = Math.abs(await cv.toBase(signed, (r.currency || baseCurrency).toUpperCase(), baseCurrency));

    const day = dailyMap.get(txDate) ?? { income: 0, expense: 0, net: 0, tx_count: 0 };
    if (tt === "INCOME" || tt === "XFER_IN") {
      day.income += absBase;
    } else {
      day.expense += absBase;
    }
    day.net = round2(day.income - day.expense);
    day.tx_count += 1;
    dailyMap.set(txDate, day);

    if (tt in typeTotals) {
      typeTotals[tt] = round2(typeTotals[tt]! + absBase);
    }
    if (tt === "EXPENSE") {
      const cat = String(r.category || "").trim() || "Uncategorized";
      expenseCategories.set(cat, round2((expenseCategories.get(cat) ?? 0) + absBase));
    }
  }

  const flow_daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      income: round2(v.income),
      expense: round2(v.expense),
      net: v.net,
      tx_count: v.tx_count,
    }));

  const tx_type_totals = (Object.keys(typeTotals) as Array<keyof typeof typeTotals>)
    .map((tx_type) => ({ tx_type, amount: typeTotals[tx_type]! }))
    .filter((x) => x.amount > 0);

  const top_expense_categories = [...expenseCategories.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, amount]) => ({ category, amount }));

  return {
    start_date: params.start_date,
    end_date: params.end_date,
    flow_daily,
    tx_type_totals,
    top_expense_categories,
  };
}
