import { describe, expect, it } from "vitest";
import type { OutboxRow } from "./db";
import { computeProfileCachePayloadAfterOutbox } from "./optimisticProfileEnqueue";

function row(partial: Omit<OutboxRow, "id" | "createdAt"> & { id?: number }): OutboxRow {
  return {
    id: partial.id ?? 1,
    method: partial.method,
    url: partial.url,
    body: partial.body,
    idempotencyKey: partial.idempotencyKey,
    createdAt: partial.createdAt ?? 1,
  };
}

describe("optimisticProfileEnqueue", () => {
  it("merges queued PATCH appprofile rows onto Dexie-shaped base (cold read parity)", () => {
    const base = {
      spend_accounts: ["Checking"],
      base_currency: "USD",
      timezone: "UTC",
      start_of_week: 0,
    };
    const rows: OutboxRow[] = [
      row({
        method: "PATCH",
        url: "/finance/appprofile/",
        body: { base_currency: "PHP", timezone: "Asia/Manila" },
        idempotencyKey: "k1",
        id: 1,
      }),
    ];
    const out = computeProfileCachePayloadAfterOutbox(base, rows);
    expect(out.base_currency).toBe("PHP");
    expect(out.timezone).toBe("Asia/Manila");
    expect(out.spend_accounts).toEqual(["Checking"]);
  });

  it("uses defaults when no cached profile row exists", () => {
    const rows: OutboxRow[] = [
      row({
        method: "PATCH",
        url: "/finance/appprofile/",
        body: { start_week: 1 },
        idempotencyKey: "k2",
        id: 1,
      }),
    ];
    const out = computeProfileCachePayloadAfterOutbox(undefined, rows);
    expect(out.start_of_week).toBe(1);
    expect(out.base_currency).toBe("USD");
  });
});
