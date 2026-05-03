import { api } from "./client";

export type ExchangeRatesApiResponse = {
  rates: Record<string, number>;
  fetched_at_ms: number;
  currencies: string[];
};

/** Pairwise ECB-backed factors among the given ISO codes (same engine as server tx math). */
export async function fetchExchangeRatesMatrix(currencies: string[]): Promise<ExchangeRatesApiResponse> {
  const uniq = [...new Set(currencies.map((c) => c.trim().toUpperCase().slice(0, 3)).filter(Boolean))].sort();
  const { data } = await api.get<ExchangeRatesApiResponse>("/finance/exchange_rates/", {
    params: { currencies: uniq.join(",") },
  });
  return data ?? { rates: {}, fetched_at_ms: Date.now(), currencies: [] };
}
