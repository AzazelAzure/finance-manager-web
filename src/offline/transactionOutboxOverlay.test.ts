import { describe, expect, it } from "vitest";
import type { OutboxRow } from "./db";
import {
  applyPendingLookupRenamesToTransactionRecords,
  buildPendingTransactionRecordsFromPostBody,
  coerceTxListFilterParams,
  transactionMatchesTxListQuery,
  transactionRecordMatchesParams,
} from "./transactionOutboxOverlay";

function obRow(partial: Omit<OutboxRow, "id" | "createdAt"> & { id?: number }): OutboxRow {
  return {
    id: partial.id ?? 1,
    method: partial.method,
    url: partial.url,
    body: partial.body,
    idempotencyKey: partial.idempotencyKey,
    createdAt: partial.createdAt ?? 1,
  };
}

describe("transactionOutboxOverlay (offline / D golden)", () => {
  it("coerces numeric current_month from JSON-parsed Dexie cache keys", () => {
    const p = coerceTxListFilterParams({ current_month: 1 });
    expect(p.current_month).toBe("1");
  });

  it("treats numeric 1 like current_month=1 for period matching", () => {
    const today = new Date().toISOString().slice(0, 10);
    const [rec] = buildPendingTransactionRecordsFromPostBody(
      [
        {
          date: today,
          amount: "25",
          source: "Cash",
          currency: "USD",
          tx_type: "EXPENSE",
          description: "Coffee",
        },
      ],
      "golden-key",
    );
    expect(rec).toBeDefined();
    expect(transactionRecordMatchesParams(rec!, { current_month: 1 })).toBe(true);
    expect(transactionMatchesTxListQuery(rec!, { current_month: 1 })).toBe(true);
  });

  it("includes backdated pending rows when no explicit period params (default dashboard / list)", () => {
    const [rec] = buildPendingTransactionRecordsFromPostBody(
      [
        {
          date: "2020-01-01",
          amount: "99",
          source: "Cash",
          currency: "USD",
          tx_type: "EXPENSE",
          description: "Old pending",
        },
      ],
      "backdated",
    );
    expect(rec).toBeDefined();
    expect(rec!.tx_id.startsWith("pending:")).toBe(true);
    expect(transactionRecordMatchesParams(rec!, {})).toBe(true);
    expect(transactionMatchesTxListQuery(rec!, {})).toBe(true);
  });

  it("still scopes server rows to current month when no explicit period", () => {
    const rec: import("../api/types").TransactionRecord = {
      tx_id: "server-1",
      date: "2020-01-01",
      amount: "-10.00",
      source: "Cash",
      currency: "USD",
      tags: [],
      tx_type: "EXPENSE",
      category: "",
    };
    expect(transactionRecordMatchesParams(rec, {})).toBe(false);
  });

  it("assigns stable pending ids for single and paired transfer creates", () => {
    const single = buildPendingTransactionRecordsFromPostBody(
      [{ date: "2026-01-15", amount: "10", source: "A", currency: "USD", tx_type: "INCOME", description: "" }],
      "solo",
    );
    expect(single).toHaveLength(1);
    expect(single[0]!.tx_id).toBe("pending:solo");

    const xfer = buildPendingTransactionRecordsFromPostBody(
      [
        { date: "2026-01-01", amount: "1", source: "A", currency: "USD", tx_type: "XFER_OUT", description: "" },
        { date: "2026-01-01", amount: "1", source: "B", currency: "USD", tx_type: "XFER_IN", description: "" },
      ],
      "pair",
    );
    expect(xfer).toHaveLength(2);
    expect(xfer[0]!.tx_id).toBe("pending:pair:0");
    expect(xfer[1]!.tx_id).toBe("pending:pair:1");
  });

  it("applies queued category/source/tag renames to cached transaction rows (FIFO)", () => {
    const rows: OutboxRow[] = [
      obRow({
        method: "PATCH",
        url: "/finance/categories/OldCat/",
        body: { name: "NewCat" },
        idempotencyKey: "1",
        id: 1,
      }),
      obRow({
        method: "PATCH",
        url: "/finance/sources/OldSrc/",
        body: { source: "NewSrc" },
        idempotencyKey: "2",
        id: 2,
      }),
      obRow({
        method: "PATCH",
        url: "/finance/tags/",
        body: { tags: { alpha: "beta" } },
        idempotencyKey: "3",
        id: 3,
      }),
    ];
    const rec: import("../api/types").TransactionRecord = {
      tx_id: "t1",
      date: "2026-01-10",
      amount: "-5.00",
      source: "OldSrc",
      currency: "USD",
      tags: ["alpha", "other"],
      tx_type: "EXPENSE",
      category: "OldCat",
    };
    const [out] = applyPendingLookupRenamesToTransactionRecords([rec], rows);
    expect(out!.category).toBe("NewCat");
    expect(out!.source).toBe("NewSrc");
    expect(out!.tags).toEqual(["beta", "other"]);
  });
});
