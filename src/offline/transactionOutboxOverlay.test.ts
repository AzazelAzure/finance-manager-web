import { describe, expect, it } from "vitest";
import {
  buildPendingTransactionRecordsFromPostBody,
  coerceTxListFilterParams,
  transactionMatchesTxListQuery,
  transactionRecordMatchesParams,
} from "./transactionOutboxOverlay";

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
});
