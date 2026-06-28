import { describe, expect, it } from "vitest";
import type { OutboxRow } from "./db";
import { mergeUpcomingOutboxFifo } from "./upcomingOutboxOverlay";

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

describe("upcomingOutboxOverlay FIFO", () => {
  it("POST then PATCH then DELETE removes expense", () => {
    const rows: OutboxRow[] = [
      row({
        method: "POST",
        url: "/finance/upcoming_expenses/",
        body: { name: "Bill", amount: "10", currency: "USD", due_date: "2026-01-01" },
        idempotencyKey: "1",
        id: 1,
      }),
      row({
        method: "PATCH",
        url: "/finance/upcoming_expenses/Bill/",
        body: { amount: "20" },
        idempotencyKey: "2",
        id: 2,
      }),
      row({
        method: "DELETE",
        url: "/finance/upcoming_expenses/Bill/",
        body: {},
        idempotencyKey: "3",
        id: 3,
      }),
    ];
    const out = mergeUpcomingOutboxFifo([], rows);
    expect(out).toEqual([]);
  });

  it("preserves bill realism fields through POST and PATCH overlays", () => {
    const rows: OutboxRow[] = [
      row({
        method: "POST",
        url: "/finance/upcoming_expenses/",
        body: {
          name: "Electric",
          amount: "2000",
          currency: "PHP",
          due_date: "2026-07-15",
          bill_class: "volatile",
          planned_partial_amount: "1200",
          cycle_residual_amount: "800",
          remainder_due_date: "2026-08-01",
        },
        idempotencyKey: "1",
        id: 1,
      }),
      row({
        method: "PATCH",
        url: "/finance/upcoming_expenses/Electric/",
        body: { planned_partial_amount: "1000" },
        idempotencyKey: "2",
        id: 2,
      }),
    ];
    const out = mergeUpcomingOutboxFifo([], rows);
    expect(out).toEqual([
      expect.objectContaining({
        name: "Electric",
        bill_class: "volatile",
        planned_partial_amount: "1000",
        cycle_residual_amount: "800",
        remainder_due_date: "2026-08-01",
      }),
    ]);
  });
});
