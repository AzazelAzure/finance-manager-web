import { describe, expect, it } from "vitest";
import {
  hasExistingTransactionForBillPeriod,
  hasPendingOutboxTransactionForBill,
  shouldEnqueueAutoDeduct,
} from "./autoDeduct";
import type { TransactionCreateRequest, TransactionRecord, UpcomingExpenseRecord } from "../api/types";

const baseBill: UpcomingExpenseRecord = {
  name: "Rent",
  amount: "1000",
  currency: "USD",
  due_date: "2026-07-02",
  paid_flag: false,
  recurring_flag: true,
  cadence: "monthly",
  custom_interval_days: null,
  source: "Checking",
  auto_deduct: true,
};

describe("auto-deduct dedup guards", () => {
  it("skips when pending outbox already has bill for period", () => {
    const pending: TransactionCreateRequest[] = [
      { date: "2026-07-02", amount: "1000", source: "Checking", currency: "USD", tx_type: "EXPENSE", bill: "Rent" },
    ];
    expect(hasPendingOutboxTransactionForBill("Rent", "2026-07-02", pending)).toBe(true);
    expect(shouldEnqueueAutoDeduct(baseBill, "2026-07-02", pending, [])).toBe(false);
  });

  it("skips when synced transaction exists for bill and date", () => {
    const txs: TransactionRecord[] = [
      {
        tx_id: "tx-1",
        date: "2026-07-02",
        description: "Rent",
        amount: "-1000.00",
        source: "Checking",
        currency: "USD",
        tags: [],
        tx_type: "EXPENSE",
        category: "",
        bill: "Rent",
      },
    ];
    expect(hasExistingTransactionForBillPeriod("Rent", "2026-07-02", txs)).toBe(true);
    expect(shouldEnqueueAutoDeduct(baseBill, "2026-07-02", [], txs)).toBe(false);
  });

  it("enqueues only when due today with source and no dup", () => {
    expect(shouldEnqueueAutoDeduct(baseBill, "2026-07-02", [], [])).toBe(true);
    expect(shouldEnqueueAutoDeduct({ ...baseBill, due_date: "2026-07-03" }, "2026-07-02", [], [])).toBe(false);
    expect(shouldEnqueueAutoDeduct({ ...baseBill, auto_deduct: false }, "2026-07-02", [], [])).toBe(false);
    expect(shouldEnqueueAutoDeduct({ ...baseBill, source: "" }, "2026-07-02", [], [])).toBe(false);
  });
});
