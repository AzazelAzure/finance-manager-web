import { describe, expect, it } from "vitest";
import type { TransactionRecord } from "../api/types";
import {
  transactionRecordMatchesParams,
  transactionMatchesTxListQuery,
} from "./transactionOutboxOverlay";

describe("transactionRecordMatchesParams", () => {
  const curDate = new Date();
  const curYear = curDate.getFullYear();
  const curMonth = String(curDate.getMonth() + 1).padStart(2, "0");
  const currentMonthStr = `${curYear}-${curMonth}`;

  // Get last month
  const prevDate = new Date();
  prevDate.setDate(1);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const lastMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  it("filters by current_month correctly", () => {
    const txCurrent: TransactionRecord = {
      tx_id: "tx-1",
      date: `${currentMonthStr}-10`,
      amount: "-100.00",
      source: "Cash",
      currency: "USD",
      tags: [],
      tx_type: "EXPENSE",
      category: "Food",
    };
    const txLast: TransactionRecord = {
      tx_id: "tx-2",
      date: `${lastMonthStr}-15`,
      amount: "-50.00",
      source: "Cash",
      currency: "USD",
      tags: [],
      tx_type: "EXPENSE",
      category: "Rent",
    };

    expect(transactionRecordMatchesParams(txCurrent, { current_month: "1" })).toBe(true);
    expect(transactionRecordMatchesParams(txLast, { current_month: "1" })).toBe(false);

    expect(transactionRecordMatchesParams(txCurrent, { last_month: "1" })).toBe(false);
    expect(transactionRecordMatchesParams(txLast, { last_month: "1" })).toBe(true);
  });

  it("defaults to current_month if params are empty", () => {
    const txCurrent: TransactionRecord = {
      tx_id: "tx-1",
      date: `${currentMonthStr}-10`,
      amount: "-100.00",
      source: "Cash",
      currency: "USD",
      tags: [],
      tx_type: "EXPENSE",
      category: "Food",
    };
    const txLast: TransactionRecord = {
      tx_id: "tx-2",
      date: `${lastMonthStr}-15`,
      amount: "-50.00",
      source: "Cash",
      currency: "USD",
      tags: [],
      tx_type: "EXPENSE",
      category: "Rent",
    };

    expect(transactionRecordMatchesParams(txCurrent, {})).toBe(true);
    expect(transactionRecordMatchesParams(txLast, {})).toBe(false);
  });

  it("allows pending transactions to pass through if params are empty", () => {
    const txPending: TransactionRecord = {
      tx_id: "pending:12345",
      date: `${lastMonthStr}-15`,
      amount: "-50.00",
      source: "Cash",
      currency: "USD",
      tags: [],
      tx_type: "EXPENSE",
      category: "Rent",
    };
    expect(transactionRecordMatchesParams(txPending, {})).toBe(true);
  });

  it("filters dimension attributes correctly", () => {
    const tx: TransactionRecord = {
      tx_id: "tx-1",
      date: `${currentMonthStr}-10`,
      amount: "-100.00",
      source: "Cash",
      currency: "USD",
      tags: ["important"],
      tx_type: "EXPENSE",
      category: "Food",
    };

    expect(transactionMatchesTxListQuery(tx, { category: "Food" })).toBe(true);
    expect(transactionMatchesTxListQuery(tx, { category: "Rent" })).toBe(false);
    expect(transactionMatchesTxListQuery(tx, { source: "Cash" })).toBe(true);
    expect(transactionMatchesTxListQuery(tx, { source: "Card" })).toBe(false);
    expect(transactionMatchesTxListQuery(tx, { tag_name: "important" })).toBe(true);
    expect(transactionMatchesTxListQuery(tx, { tag_name: "misc" })).toBe(false);
  });
});
