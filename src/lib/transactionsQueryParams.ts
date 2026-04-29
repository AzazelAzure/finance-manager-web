import type { TransactionFilters } from "../api/transactions";

export type TransactionsFilterDraft = {
  period: "current" | "last" | "week" | "custom";
  txType: string;
  tagName: string;
  category: string;
  source: string;
  currency: string;
  date: string;
  startDate: string;
  endDate: string;
};

export const defaultTransactionsFilterDraft: TransactionsFilterDraft = {
  period: "current",
  txType: "",
  tagName: "",
  category: "",
  source: "",
  currency: "",
  date: "",
  startDate: "",
  endDate: "",
};

export function searchParamsToTransactionFilters(sp: URLSearchParams): TransactionFilters {
  const out: TransactionFilters = {};
  const copyKeys = [
    "tx_type",
    "tag_name",
    "category",
    "source",
    "currency_code",
    "start_date",
    "end_date",
    "date",
    "current_month",
    "last_month",
    "previous_week",
  ] as const;
  for (const key of copyKeys) {
    const val = sp.get(key);
    if (val != null && val !== "") {
      out[key] = val;
    }
  }
  return out;
}

export function urlSearchParamsToTransactionsDraft(sp: URLSearchParams): TransactionsFilterDraft {
  const has = (k: string): boolean => {
    const v = sp.get(k);
    return v != null && v !== "";
  };
  let period: TransactionsFilterDraft["period"] = "current";
  if (has("last_month")) {
    period = "last";
  } else if (has("previous_week")) {
    period = "week";
  } else if (has("start_date") && has("end_date")) {
    period = "custom";
  }
  return {
    period,
    txType: sp.get("tx_type") ?? "",
    tagName: sp.get("tag_name") ?? "",
    category: sp.get("category") ?? "",
    source: sp.get("source") ?? "",
    currency: sp.get("currency_code") ?? "",
    date: sp.get("date") ?? "",
    startDate: sp.get("start_date") ?? "",
    endDate: sp.get("end_date") ?? "",
  };
}

export function transactionsDraftToSearchParams(draft: TransactionsFilterDraft): URLSearchParams {
  const p = new URLSearchParams();
  if (draft.period === "current") {
    p.set("current_month", "1");
  } else if (draft.period === "last") {
    p.set("last_month", "1");
  } else if (draft.period === "week") {
    p.set("previous_week", "1");
  } else if (draft.startDate && draft.endDate) {
    p.set("start_date", draft.startDate);
    p.set("end_date", draft.endDate);
  }
  if (draft.txType) p.set("tx_type", draft.txType);
  if (draft.tagName) p.set("tag_name", draft.tagName);
  if (draft.category) p.set("category", draft.category);
  if (draft.source) p.set("source", draft.source);
  if (draft.currency) p.set("currency_code", draft.currency);
  if (draft.date) p.set("date", draft.date);
  return p;
}

export function transactionFilterSignature(sp: URLSearchParams): string {
  const entries = Array.from(sp.entries()).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}
