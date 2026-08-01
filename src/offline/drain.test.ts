import { AxiosError } from "axios";
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

const mockedEmitSyncState = vi.fn();
vi.mock("./syncEvents", () => ({
  emitSyncState: (...args: unknown[]) => mockedEmitSyncState(...args),
  SYNC_STATE_EVENT: "fm-sync-state",
}));

const mockedApiRequest = vi.fn();
vi.mock("../api/client", () => ({
  api: {
    request: (...args: unknown[]) => mockedApiRequest(...args),
  },
}));

vi.mock("../api/refreshClient", () => ({
  postRefresh: vi.fn(async () => ({ access: "access-token", refresh: "refresh-token" })),
}));

vi.mock("../state/auth", () => ({
  getRefreshToken: vi.fn(() => "refresh-token"),
  setSession: vi.fn(),
  AUTH_CHANGED_EVENT: "fm-auth-changed",
}));

vi.mock("./connectivity", () => ({
  FM_API_REACHABLE_EVENT: "fm-api-reachable",
  isApiMarkedUnreachable: vi.fn(() => false),
  probeApiReachability: vi.fn(async () => true),
}));

vi.mock("../lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn(async () => undefined),
    refetchQueries: vi.fn(async () => undefined),
  },
}));

vi.mock("./pwaReadBypass", () => ({
  requestPwaReadBypassAfterMutation: vi.fn(),
}));

vi.mock("./exchangeRates", () => ({
  syncMinimalExchangeRates: vi.fn(),
}));

vi.mock("./autoDeduct", () => ({
  runAutoDeductDueTodayCheck: vi.fn(),
}));

vi.mock("../lib/clientBuildUpgradeEvents", () => ({
  dispatchClientBuildUnsupported: vi.fn(),
}));

import { offlineDb } from "./db";
import { drainOutbox } from "./drain";
import { getOutboxSyncFailure } from "./outbox";

function axiosError(status: number, data: unknown): AxiosError {
  return new AxiosError(
    "Request failed",
    String(status),
    undefined,
    undefined,
    {
      status,
      statusText: "Error",
      data,
      headers: {},
      config: {} as never,
    },
  );
}

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

describe("drainOutbox failure boundary", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("navigator", { onLine: true });
    outboxTable.clear();
    nextId = 1;
    mockedEmitSyncState.mockClear();
    mockedApiRequest.mockReset();
    vi.mocked(offlineDb.outbox.delete).mockClear();
  });

  it("D1: persists action_required on Axios 400 for queued transaction POST", async () => {
    const row = txPostRow();
    outboxTable.set(1, row);
    mockedApiRequest.mockRejectedValueOnce(axiosError(400, { amount: ["Must be positive."] }));

    await drainOutbox();

    expect(outboxTable.size).toBe(1);
    expect(offlineDb.outbox.delete).not.toHaveBeenCalled();
    const persisted = getOutboxSyncFailure(outboxTable.get(1)?.echo);
    expect(persisted?.kind).toBe("action_required");
    expect(persisted?.status).toBe(400);
    expect(persisted?.pendingTxId).toBe(`pending:${row.idempotencyKey}`);
    expect(persisted?.detail).toContain("Must be positive.");
    expect(mockedEmitSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "action_required",
        detail: persisted?.detail,
        pendingTxId: `pending:${row.idempotencyKey}`,
      }),
    );
  });

  it("D2: persists retryable on network error without response", async () => {
    outboxTable.set(1, txPostRow());
    mockedApiRequest.mockRejectedValueOnce(new Error("network down"));

    await drainOutbox();

    expect(outboxTable.size).toBe(1);
    expect(offlineDb.outbox.delete).not.toHaveBeenCalled();
    const persisted = getOutboxSyncFailure(outboxTable.get(1)?.echo);
    expect(persisted?.kind).toBe("retryable");
    expect(persisted?.detail).toBe("");
    expect(persisted?.detail).not.toContain("Request rejected by API");
    expect(mockedEmitSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "error",
        retryable: true,
      }),
    );
    expect(mockedEmitSyncState).not.toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.stringContaining("Request rejected by API") }),
    );
  });

  it("D2: persists retryable on 5xx response", async () => {
    outboxTable.set(1, txPostRow());
    mockedApiRequest.mockRejectedValueOnce(axiosError(503, { detail: "Service unavailable" }));

    await drainOutbox();

    expect(outboxTable.size).toBe(1);
    expect(offlineDb.outbox.delete).not.toHaveBeenCalled();
    const persisted = getOutboxSyncFailure(outboxTable.get(1)?.echo);
    expect(persisted?.kind).toBe("retryable");
    expect(persisted?.status).toBe(503);
    expect(persisted?.detail).toContain("Service unavailable");
    expect(mockedEmitSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "error",
        detail: persisted?.detail,
        retryable: true,
      }),
    );
  });

  it("D4: non-transaction POST 400 emits error without pendingTxId", async () => {
    outboxTable.set(1, {
      id: 1,
      method: "POST",
      url: "/finance/categories/",
      body: { name: "Food" },
      idempotencyKey: "cat-key",
      createdAt: Date.now(),
    });
    mockedApiRequest.mockRejectedValueOnce(axiosError(400, { name: ["duplicate"] }));

    await drainOutbox();

    expect(outboxTable.size).toBe(1);
    expect(offlineDb.outbox.delete).not.toHaveBeenCalled();
    const persisted = getOutboxSyncFailure(outboxTable.get(1)?.echo);
    expect(persisted?.kind).toBe("action_required");
    expect(persisted?.pendingTxId).toBeUndefined();
    expect(mockedEmitSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "error",
        retryable: false,
      }),
    );
    expect(mockedEmitSyncState).not.toHaveBeenCalledWith(
      expect.objectContaining({ phase: "action_required" }),
    );
  });

  it("D6: successful replay removes row and does not leave syncFailure", async () => {
    outboxTable.set(1, txPostRow());
    mockedApiRequest.mockResolvedValueOnce({ status: 200, data: {} });

    await drainOutbox();

    expect(outboxTable.size).toBe(0);
    expect(offlineDb.outbox.delete).toHaveBeenCalledWith(1);
    expect(mockedEmitSyncState).toHaveBeenCalledWith({ phase: "idle" });
  });

  it("D6: failed rows are never auto-deleted", async () => {
    outboxTable.set(1, txPostRow());
    mockedApiRequest.mockRejectedValueOnce(axiosError(422, { source: ["unknown"] }));

    await drainOutbox();

    expect(outboxTable.size).toBe(1);
    expect(offlineDb.outbox.delete).not.toHaveBeenCalled();
    expect(getOutboxSyncFailure(outboxTable.get(1)?.echo)?.kind).toBe("action_required");
  });
});
