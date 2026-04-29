export type PeriodPreset = "current" | "last" | "week" | "custom";

export type TxTypeFilter = "" | "INCOME" | "EXPENSE" | "XFER_IN" | "XFER_OUT";

export type DashboardFilterDraft = {
  period: PeriodPreset;
  startDate: string;
  endDate: string;
  txType: TxTypeFilter;
  tagName: string;
  category: string;
  source: string;
  currency: string;
};

export const defaultDashboardFilterDraft: DashboardFilterDraft = {
  period: "current",
  startDate: "",
  endDate: "",
  txType: "",
  tagName: "",
  category: "",
  source: "",
  currency: "",
};

/** Map applied URL search params → API query object (string values for axios). */
export function searchParamsToApiParams(sp: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  const copyKeys = [
    "current_month",
    "last_month",
    "previous_week",
    "start_date",
    "end_date",
    "tx_type",
    "tag_name",
    "category",
    "source",
    "currency_code",
  ] as const;
  for (const k of copyKeys) {
    const v = sp.get(k);
    if (v != null && v !== "") {
      out[k] = v;
    }
  }
  return out;
}

export function filterDraftToApiParams(d: DashboardFilterDraft): Record<string, string> {
  const p: Record<string, string> = {};
  if (d.period === "current") {
    p.current_month = "1";
  } else if (d.period === "last") {
    p.last_month = "1";
  } else if (d.period === "week") {
    p.previous_week = "1";
  } else if (d.period === "custom" && d.startDate && d.endDate) {
    p.start_date = d.startDate;
    p.end_date = d.endDate;
  }
  if (d.txType) {
    p.tx_type = d.txType;
  }
  if (d.tagName) {
    p.tag_name = d.tagName;
  }
  if (d.category) {
    p.category = d.category;
  }
  if (d.source) {
    p.source = d.source;
  }
  if (d.currency) {
    p.currency_code = d.currency;
  }
  return p;
}

function draftToSearchParamsObject(d: DashboardFilterDraft): Record<string, string> {
  return filterDraftToApiParams(d);
}

export function filterDraftToURLSearchParams(d: DashboardFilterDraft): URLSearchParams {
  return new URLSearchParams(draftToSearchParamsObject(d));
}

export function urlSearchParamsToFilterDraft(sp: URLSearchParams): DashboardFilterDraft {
  if (Array.from(sp.keys()).length === 0) {
    return { ...defaultDashboardFilterDraft };
  }
  const has = (k: string): boolean => sp.get(k) != null && sp.get(k) !== "";
  let period: PeriodPreset;
  if (has("last_month")) {
    period = "last";
  } else if (has("previous_week")) {
    period = "week";
  } else if (has("start_date") && has("end_date")) {
    period = "custom";
  } else {
    period = "current";
  }
  const start = sp.get("start_date") ?? "";
  const end = sp.get("end_date") ?? "";
  const rawTx = sp.get("tx_type");
  const txType: TxTypeFilter =
    rawTx === "INCOME" || rawTx === "EXPENSE" || rawTx === "XFER_IN" || rawTx === "XFER_OUT" ? rawTx : "";
  return {
    period,
    startDate: start,
    endDate: end,
    txType,
    tagName: sp.get("tag_name") ?? "",
    category: sp.get("category") ?? "",
    source: sp.get("source") ?? "",
    currency: sp.get("currency_code") ?? "",
  };
}

export function appliedSnapshotKey(sp: URLSearchParams): string {
  const keys = Array.from(sp.keys()).sort();
  return keys.map((k) => `${k}=${sp.get(k) ?? ""}`).join("&");
}
