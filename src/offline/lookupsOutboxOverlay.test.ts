import { describe, expect, it } from "vitest";
import type { OutboxRow } from "./db";
import { mergeCategoryOutboxFifo, mergeSourceOutboxFifo, mergeTagOutboxFifo } from "./lookupsOutboxOverlay";

function row(partial: Omit<OutboxRow, "id" | "createdAt"> & { id?: number }): OutboxRow {
  return {
    id: partial.id ?? 1,
    method: partial.method,
    url: partial.url,
    body: partial.body,
    idempotencyKey: partial.idempotencyKey,
    createdAt: partial.createdAt ?? 1,
    ...(partial.echo !== undefined ? { echo: partial.echo } : {}),
  };
}

describe("lookupsOutboxOverlay FIFO", () => {
  it("POST then PATCH then DELETE category leaves empty list", () => {
    const rows: OutboxRow[] = [
      row({ method: "POST", url: "/finance/categories/", body: { name: "A" }, idempotencyKey: "1", id: 1 }),
      row({
        method: "PATCH",
        url: "/finance/categories/A/",
        body: { name: "B" },
        idempotencyKey: "2",
        id: 2,
      }),
      row({ method: "DELETE", url: "/finance/categories/B/", body: {}, idempotencyKey: "3", id: 3 }),
    ];
    const out = mergeCategoryOutboxFifo([], rows);
    expect(out).toEqual([]);
  });

  it("tag POST then PATCH rename", () => {
    const rows: OutboxRow[] = [
      row({ method: "POST", url: "/finance/tags/", body: { tags: ["x"] }, idempotencyKey: "1", id: 1 }),
      row({
        method: "PATCH",
        url: "/finance/tags/",
        body: { tags: { x: "y" } },
        idempotencyKey: "2",
        id: 2,
      }),
    ];
    const out = mergeTagOutboxFifo([], rows);
    expect(out).toContain("y");
    expect(out).not.toContain("x");
  });

  it("source POST then PATCH rename relabels row", () => {
    const rows: OutboxRow[] = [
      row({
        method: "POST",
        url: "/finance/sources/",
        body: { source: "Old", acc_type: "CHECKING", amount: "0", currency: "USD" },
        idempotencyKey: "1",
        id: 1,
      }),
      row({
        method: "PATCH",
        url: "/finance/sources/Old/",
        body: { source: "New" },
        idempotencyKey: "2",
        id: 2,
      }),
    ];
    const out = mergeSourceOutboxFifo([], rows);
    expect(out.map((s) => s.source)).toContain("New");
    expect(out.map((s) => s.source)).not.toContain("Old");
  });
});
