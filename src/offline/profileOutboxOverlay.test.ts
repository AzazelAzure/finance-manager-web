import { describe, expect, it } from "vitest";
import type { AppProfileResponse } from "../api/types";
import type { OutboxRow } from "./db";
import { mergeProfileOutboxFifo } from "./profileOutboxOverlay";

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

describe("profileOutboxOverlay FIFO", () => {
  it("merges only patched fields from PATCH rows", () => {
    const base: AppProfileResponse = {
      spend_accounts: ["a"],
      base_currency: "USD",
      timezone: "UTC",
      start_of_week: 0,
    };
    const rows: OutboxRow[] = [
      row({
        method: "PATCH",
        url: "/finance/appprofile/",
        body: { base_currency: "PHP", spend_accounts: ["b"], timezone: "Asia/Manila", start_week: 1 },
        idempotencyKey: "1",
        id: 1,
      }),
    ];
    const out = mergeProfileOutboxFifo(base, rows);
    expect(out.base_currency).toBe("PHP");
    expect(out.spend_accounts).toEqual(["b"]);
    expect(out.timezone).toBe("Asia/Manila");
    expect(out.start_of_week).toBe(1);
  });
});
