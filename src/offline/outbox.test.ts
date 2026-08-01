import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxRow } from "./db";

const outboxTable = new Map<number, OutboxRow>();
let nextId = 1;

vi.mock("./db", () => ({
  offlineDb: {
    outbox: {
      add: vi.fn(async (row: OutboxRow) => {
        const id = nextId++;
        outboxTable.set(id, { ...row, id });
        return id;
      }),
      orderBy: vi.fn(() => ({
        toArray: async () =>
          [...outboxTable.values()].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
      })),
      get: vi.fn(async (id: number) => outboxTable.get(id)),
      update: vi.fn(async (id: number, patch: Partial<OutboxRow>) => {
        const cur = outboxTable.get(id);
        if (!cur) {
          return 0;
        }
        outboxTable.set(id, { ...cur, ...patch });
        return 1;
      }),
      delete: vi.fn(async (id: number) => {
        outboxTable.delete(id);
      }),
      clear: vi.fn(async () => {
        outboxTable.clear();
      }),
      count: vi.fn(async () => outboxTable.size),
    },
  },
}));

vi.mock("./syncEvents", () => ({
  emitSyncState: vi.fn(),
}));

import { emitSyncState } from "./syncEvents";
import {
  classifyOutboxFailure,
  deleteQueuedTransactionPost,
  emitSyncStateForOutboxFailures,
  findFirstActionRequiredTransactionFailure,
  getOutboxSyncFailure,
  mergeEchoWithSyncFailure,
  parseApiDetailAsText,
  parsePendingTransactionIdentity,
  pendingTxIdForOutboxRow,
  persistOutboxSyncFailure,
} from "./outbox";

const mockedEmitSyncState = vi.mocked(emitSyncState);

function txPostRow(partial: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: 1,
    method: "POST",
    url: "/finance/transactions/",
    body: {
      date: "2026-08-01",
      amount: "10",
      source: "Cash",
      currency: "USD",
      tx_type: "EXPENSE",
    },
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: Date.now(),
    ...partial,
  };
}

describe("parsePendingTransactionIdentity", () => {
  it("parses pending uuid without index as bodyIndex 0", () => {
    const k = "550e8400-e29b-41d4-a716-446655440000";
    expect(parsePendingTransactionIdentity(`pending:${k}`)).toEqual({
      idempotencyKey: k,
      bodyIndex: 0,
    });
  });

  it("parses pending with numeric suffix as index", () => {
    const k = "550e8400-e29b-41d4-a716-446655440000";
    expect(parsePendingTransactionIdentity(`pending:${k}:1`)).toEqual({
      idempotencyKey: k,
      bodyIndex: 1,
    });
  });

  it("returns null for server ids", () => {
    expect(parsePendingTransactionIdentity("2025-01-01-abc")).toBeNull();
  });
});

describe("parseApiDetailAsText", () => {
  it("renders object field errors as text", () => {
    expect(parseApiDetailAsText({ amount: ["Must be positive."] }, 400)).toBe(
      "HTTP 400: amount: Must be positive.",
    );
  });

  it("renders string bodies with status", () => {
    expect(parseApiDetailAsText("Bad request", 422)).toBe("HTTP 422: Bad request");
  });

  it("returns empty string for no-response bodies without status", () => {
    expect(parseApiDetailAsText(undefined, undefined)).toBe("");
  });
});

describe("classifyOutboxFailure", () => {
  it("marks 4xx as action_required", () => {
    expect(classifyOutboxFailure(400, false)).toBe("action_required");
    expect(classifyOutboxFailure(422, false)).toBe("action_required");
  });

  it("marks network and 5xx as retryable", () => {
    expect(classifyOutboxFailure(undefined, true)).toBe("retryable");
    expect(classifyOutboxFailure(503, false)).toBe("retryable");
  });
});

describe("echo.syncFailure helpers", () => {
  beforeEach(() => {
    outboxTable.clear();
    nextId = 1;
    mockedEmitSyncState.mockClear();
  });

  it("preserves existing echo keys when persisting syncFailure", async () => {
    const merged = mergeEchoWithSyncFailure(
      { kind: "transaction_delete", record: { tx_id: "tx-1" } },
      {
        kind: "action_required",
        status: 400,
        detail: "HTTP 400: amount: invalid",
        failedAt: 1,
        pendingTxId: "pending:abc",
      },
    );
    expect(merged.kind).toBe("transaction_delete");
    expect(merged.record).toEqual({ tx_id: "tx-1" });
    expect(getOutboxSyncFailure(merged)?.kind).toBe("action_required");
  });

  it("derives pending tx id for queued transaction POST rows", () => {
    const row = txPostRow();
    expect(pendingTxIdForOutboxRow(row)).toBe(`pending:${row.idempotencyKey}`);
  });

  it("persists syncFailure on outbox row without schema bump", async () => {
    outboxTable.set(1, txPostRow({ echo: { kind: "transaction_delete" } }));
    await persistOutboxSyncFailure(1, { kind: "transaction_delete" }, {
      kind: "action_required",
      status: 400,
      detail: "HTTP 400: source: unknown",
      failedAt: Date.now(),
      pendingTxId: "pending:550e8400-e29b-41d4-a716-446655440000",
    });
    const row = outboxTable.get(1);
    expect(row?.echo).toMatchObject({
      kind: "transaction_delete",
      syncFailure: { kind: "action_required", status: 400 },
    });
  });

  it("finds first action-required transaction failure in fifo order", async () => {
    outboxTable.set(1, txPostRow({
      id: 1,
      echo: {
        syncFailure: {
          kind: "action_required",
          detail: "first",
          failedAt: 1,
          pendingTxId: "pending:550e8400-e29b-41d4-a716-446655440000",
        },
      },
    }));
    outboxTable.set(2, txPostRow({
      id: 2,
      idempotencyKey: "other-key",
      echo: {
        syncFailure: {
          kind: "action_required",
          detail: "second",
          failedAt: 2,
          pendingTxId: "pending:other-key",
        },
      },
    }));
    const found = await findFirstActionRequiredTransactionFailure();
    expect(found?.pendingTxId).toBe("pending:550e8400-e29b-41d4-a716-446655440000");
  });

  it("emits action_required repair state for transaction failures", async () => {
    outboxTable.set(1, txPostRow({
      echo: {
        syncFailure: {
          kind: "action_required",
          detail: "HTTP 400: amount: invalid",
          failedAt: 1,
          pendingTxId: "pending:550e8400-e29b-41d4-a716-446655440000",
        },
      },
    }));
    const emitted = await emitSyncStateForOutboxFailures();
    expect(emitted).toBe(true);
    expect(mockedEmitSyncState).toHaveBeenCalledWith({
      phase: "action_required",
      detail: "HTTP 400: amount: invalid",
      pendingTxId: "pending:550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("emits retryable error for non-transaction entity failures", async () => {
    outboxTable.set(1, {
      id: 1,
      method: "POST",
      url: "/finance/categories/",
      body: { name: "Food" },
      idempotencyKey: "cat-key",
      createdAt: Date.now(),
      echo: {
        syncFailure: {
          kind: "action_required",
          detail: "HTTP 400: duplicate",
          failedAt: 1,
        },
      },
    });
    const emitted = await emitSyncStateForOutboxFailures();
    expect(emitted).toBe(true);
    expect(mockedEmitSyncState).toHaveBeenCalledWith({
      phase: "error",
      detail: "HTTP 400: duplicate",
      retryable: false,
    });
  });

  it("emits retryable without misleading detail when persisted detail is empty", async () => {
    outboxTable.set(1, {
      id: 1,
      method: "POST",
      url: "/finance/categories/",
      body: { name: "Food" },
      idempotencyKey: "cat-key",
      createdAt: Date.now(),
      echo: {
        syncFailure: {
          kind: "retryable",
          detail: "",
          failedAt: 1,
        },
      },
    });
    const emitted = await emitSyncStateForOutboxFailures();
    expect(emitted).toBe(true);
    expect(mockedEmitSyncState).toHaveBeenCalledWith({
      phase: "error",
      retryable: true,
    });
    expect(mockedEmitSyncState).not.toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.stringContaining("Request rejected by API") }),
    );
  });
});

describe("drain failure classification (helper contract)", () => {
  it("never auto-deletes: failed rows stay in outbox with metadata", async () => {
    outboxTable.set(1, txPostRow());
    await persistOutboxSyncFailure(1, undefined, {
      kind: "retryable",
      detail: "network",
      failedAt: Date.now(),
    });
    expect(outboxTable.size).toBe(1);
    expect(getOutboxSyncFailure(outboxTable.get(1)?.echo)?.kind).toBe("retryable");
  });
});

describe("deleteQueuedTransactionPost", () => {
  beforeEach(() => {
    outboxTable.clear();
    nextId = 1;
  });

  it("D7: removes only the targeted queued transaction row", async () => {
    const key1 = "550e8400-e29b-41d4-a716-446655440000";
    const key2 = "other-idempotency-key";
    outboxTable.set(1, txPostRow({ id: 1, idempotencyKey: key1 }));
    outboxTable.set(2, txPostRow({ id: 2, idempotencyKey: key2 }));
    const ok = await deleteQueuedTransactionPost(`pending:${key1}`);
    expect(ok).toBe(true);
    expect(outboxTable.has(1)).toBe(false);
    expect(outboxTable.has(2)).toBe(true);
    expect(outboxTable.size).toBe(1);
  });
});
