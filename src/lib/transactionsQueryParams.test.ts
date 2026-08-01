import { describe, expect, it } from "vitest";
import {
  defaultTransactionsFilterDraft,
  searchParamsToTransactionFilters,
  transactionFilterSignature,
  transactionsDraftToSearchParams,
  urlSearchParamsToTransactionsDraft,
} from "./transactionsQueryParams";

describe("transactionsDraftToSearchParams", () => {
  it("sets current_month for current period", () => {
    const params = transactionsDraftToSearchParams({
      ...defaultTransactionsFilterDraft,
      period: "current",
    });
    expect(params.get("current_month")).toBe("1");
    expect(params.get("start_date")).toBeNull();
    expect(params.get("end_date")).toBeNull();
  });

  it("sets last_month for last period", () => {
    const params = transactionsDraftToSearchParams({
      ...defaultTransactionsFilterDraft,
      period: "last",
    });
    expect(params.get("last_month")).toBe("1");
    expect(params.get("current_month")).toBeNull();
  });

  it("sets previous_week for week period", () => {
    const params = transactionsDraftToSearchParams({
      ...defaultTransactionsFilterDraft,
      period: "week",
    });
    expect(params.get("previous_week")).toBe("1");
    expect(params.get("current_month")).toBeNull();
  });

  it("sets start_date and end_date for custom period with both dates", () => {
    const params = transactionsDraftToSearchParams({
      ...defaultTransactionsFilterDraft,
      period: "custom",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(params.get("start_date")).toBe("2026-01-01");
    expect(params.get("end_date")).toBe("2026-01-31");
    expect(params.get("current_month")).toBeNull();
    expect(params.get("last_month")).toBeNull();
    expect(params.get("previous_week")).toBeNull();
  });

  it("omits date params for custom period without both dates", () => {
    const params = transactionsDraftToSearchParams({
      ...defaultTransactionsFilterDraft,
      period: "custom",
      startDate: "2026-01-01",
      endDate: "",
    });
    expect(params.get("start_date")).toBeNull();
    expect(params.get("end_date")).toBeNull();
    expect(params.get("current_month")).toBeNull();
  });

  it("omits date params for custom period with no dates", () => {
    const params = transactionsDraftToSearchParams({
      ...defaultTransactionsFilterDraft,
      period: "custom",
    });
    expect(params.get("start_date")).toBeNull();
    expect(params.get("end_date")).toBeNull();
  });
});

describe("urlSearchParamsToTransactionsDraft", () => {
  it("defaults to current period with empty params", () => {
    const draft = urlSearchParamsToTransactionsDraft(new URLSearchParams());
    expect(draft.period).toBe("current");
    expect(draft.startDate).toBe("");
    expect(draft.endDate).toBe("");
  });

  it("detects last period from last_month", () => {
    const draft = urlSearchParamsToTransactionsDraft(new URLSearchParams("last_month=1"));
    expect(draft.period).toBe("last");
  });

  it("detects week period from previous_week", () => {
    const draft = urlSearchParamsToTransactionsDraft(new URLSearchParams("previous_week=1"));
    expect(draft.period).toBe("week");
  });

  it("detects custom period from start_date and end_date", () => {
    const draft = urlSearchParamsToTransactionsDraft(
      new URLSearchParams("start_date=2026-01-01&end_date=2026-01-31"),
    );
    expect(draft.period).toBe("custom");
    expect(draft.startDate).toBe("2026-01-01");
    expect(draft.endDate).toBe("2026-01-31");
  });

  it("does not treat partial custom dates as custom period", () => {
    const draft = urlSearchParamsToTransactionsDraft(new URLSearchParams("start_date=2026-01-01"));
    expect(draft.period).toBe("current");
    expect(draft.startDate).toBe("2026-01-01");
  });
});

describe("searchParamsToTransactionFilters", () => {
  it("passes through custom date range params", () => {
    const filters = searchParamsToTransactionFilters(
      new URLSearchParams("start_date=2026-01-01&end_date=2026-01-31"),
    );
    expect(filters.start_date).toBe("2026-01-01");
    expect(filters.end_date).toBe("2026-01-31");
  });

  it("passes through standard period flags unchanged", () => {
    expect(searchParamsToTransactionFilters(new URLSearchParams("current_month=1")).current_month).toBe("1");
    expect(searchParamsToTransactionFilters(new URLSearchParams("last_month=1")).last_month).toBe("1");
    expect(searchParamsToTransactionFilters(new URLSearchParams("previous_week=1")).previous_week).toBe("1");
  });
});

describe("transactionFilterSignature", () => {
  it("is stable regardless of param order", () => {
    const a = transactionFilterSignature(new URLSearchParams("start_date=2026-01-01&end_date=2026-01-31"));
    const b = transactionFilterSignature(new URLSearchParams("end_date=2026-01-31&start_date=2026-01-01"));
    expect(a).toBe(b);
  });
});
