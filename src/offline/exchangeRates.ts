import { fetchExchangeRatesMatrix } from "../api/exchangeRates";
import { preferOfflineCaches } from "./connectivity";
import { readCachePayload, snapshotParamsCacheKey } from "./cache";
import { offlineDb } from "./db";
import type { SourceRow } from "../api/types";

const RATES_META_KEY = "offline_exchange_rates_v1";
const RATES_THROTTLE_META_KEY = "offline_exchange_rates_last_fetch_ms";
const RATE_THROTTLE_MS = 4 * 60 * 60 * 1000;

export type StoredExchangeRates = {
  rates: Record<string, number>;
  fetched_at_ms: number;
  currencies: string[];
};

export function ratePairKey(from: string, to: string): string {
  return `${from.trim().toUpperCase().slice(0, 3)}:${to.trim().toUpperCase().slice(0, 3)}`;
}

export async function readStoredExchangeRates(): Promise<StoredExchangeRates | null> {
  const row = await offlineDb.meta.get(RATES_META_KEY);
  const v = row?.value;
  if (!v || typeof v !== "object" || !("rates" in v)) {
    return null;
  }
  return v as StoredExchangeRates;
}

export async function writeStoredExchangeRates(blob: StoredExchangeRates): Promise<void> {
  await offlineDb.meta.put({ key: RATES_META_KEY, value: blob });
}

/** Collect ISO codes from cached profile, sources, default snapshot, and tx list caches. */
export async function collectCurrenciesForMinimalRates(): Promise<string[]> {
  const set = new Set<string>();
  const prof = await readCachePayload("appprofile:root");
  if (prof && typeof prof === "object" && "base_currency" in prof) {
    const bc = String((prof as { base_currency?: string }).base_currency || "").trim().toUpperCase().slice(0, 3);
    if (bc) {
      set.add(bc);
    }
  }
  const srcRaw = await readCachePayload("lookups:sources:all");
  if (Array.isArray(srcRaw)) {
    for (const row of srcRaw as SourceRow[]) {
      const c = String(row.currency ?? "").trim().toUpperCase().slice(0, 3);
      if (c) {
        set.add(c);
      }
    }
  }
  const snap = await readCachePayload(snapshotParamsCacheKey({}));
  if (snap && typeof snap === "object" && "transactions_for_month" in snap) {
    const txs = (snap as { transactions_for_month?: Array<{ currency?: string }> }).transactions_for_month ?? [];
    for (const t of txs) {
      const c = String(t.currency ?? "").trim().toUpperCase().slice(0, 3);
      if (c) {
        set.add(c);
      }
    }
  }
  await offlineDb.caches
    .where("id")
    .startsWith("txlist:")
    .each((row) => {
      const payload = row.payload;
      if (!Array.isArray(payload)) {
        return;
      }
      for (const item of payload) {
        if (item && typeof item === "object" && "currency" in item) {
          const c = String((item as { currency?: string }).currency ?? "")
            .trim()
            .toUpperCase()
            .slice(0, 3);
          if (c) {
            set.add(c);
          }
        }
      }
    });
  return [...set].filter(Boolean).sort();
}

export async function syncMinimalExchangeRates(force = false): Promise<void> {
  if (typeof navigator === "undefined" || preferOfflineCaches()) {
    return;
  }
  const now = Date.now();
  if (!force) {
    const last = await offlineDb.meta.get(RATES_THROTTLE_META_KEY);
    const t = typeof last?.value === "number" ? last.value : 0;
    if (t && now - t < RATE_THROTTLE_MS) {
      return;
    }
  }
  const currencies = await collectCurrenciesForMinimalRates();
  if (currencies.length < 2) {
    await offlineDb.meta.put({ key: RATES_THROTTLE_META_KEY, value: now });
    return;
  }
  try {
    const data = await fetchExchangeRatesMatrix(currencies);
    await writeStoredExchangeRates({
      rates: data.rates ?? {},
      fetched_at_ms: data.fetched_at_ms ?? now,
      currencies: data.currencies?.length ? data.currencies : currencies,
    });
  } catch {
    /* network — retry later */
  } finally {
    await offlineDb.meta.put({ key: RATES_THROTTLE_META_KEY, value: Date.now() });
  }
}

export type CurrencyConverter = {
  toBase: (amount: number, fromCurrency: string, baseCurrency: string) => Promise<number>;
  convert: (amount: number, fromCurrency: string, toCurrency: string) => Promise<number>;
};

export async function loadCurrencyConverter(): Promise<CurrencyConverter> {
  const blob = await readStoredExchangeRates();
  const convert = async (amount: number, from: string, to: string): Promise<number> => {
    const f = from.trim().toUpperCase().slice(0, 3);
    const t = to.trim().toUpperCase().slice(0, 3);
    if (!Number.isFinite(amount) || f === t) {
      return amount;
    }
    const r = blob?.rates?.[ratePairKey(f, t)];
    if (r == null || !Number.isFinite(r)) {
      return amount;
    }
    return amount * r;
  };
  const toBase = async (amount: number, fromCurrency: string, baseCurrency: string): Promise<number> => {
    return convert(amount, fromCurrency, baseCurrency);
  };
  return { toBase, convert };
}
