import { beforeEach, describe, expect, it, vi } from "vitest";
import { profileTodayIso } from "../lib/profileDate";
import {
  autoDeductAmountForBill,
  buildAutoDeductPayload,
  hasExistingTransactionForBillPeriod,
  hasPendingOutboxTransactionForBill,
  runAutoDeductDueTodayCheck,
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

vi.mock("../api/profile", () => ({
  getAppProfile: vi.fn(),
}));

vi.mock("../api/upcomingExpenses", () => ({
  listUpcomingExpenses: vi.fn(),
}));

vi.mock("../api/transactions", () => ({
  createTransactions: vi.fn(),
  buildFallbackTxList: vi.fn(),
}));

vi.mock("../state/auth", () => ({
  getRefreshToken: vi.fn(() => "refresh-token"),
}));

vi.mock("./outbox", () => ({
  listOutboxOrdered: vi.fn(async () => []),
  parseOutboxBody: vi.fn((body: unknown) => body),
}));

vi.mock("../lib/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));

vi.mock("./pwaReadBypass", () => ({
  requestPwaReadBypassAfterMutation: vi.fn(),
}));

import { getAppProfile } from "../api/profile";
import { listUpcomingExpenses } from "../api/upcomingExpenses";
import { buildFallbackTxList, createTransactions } from "../api/transactions";
import { listOutboxOrdered } from "./outbox";

const mockedGetAppProfile = vi.mocked(getAppProfile);
const mockedListUpcoming = vi.mocked(listUpcomingExpenses);
const mockedCreateTransactions = vi.mocked(createTransactions);
const mockedBuildFallbackTxList = vi.mocked(buildFallbackTxList);
const mockedListOutboxOrdered = vi.mocked(listOutboxOrdered);

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

describe("timezone boundary (profile TZ vs browser/UTC)", () => {
  it("does not enqueue when bill is due tomorrow in a profile TZ ahead of UTC", () => {
    const instant = new Date("2026-07-01T22:00:00.000Z");
    const profileToday = profileTodayIso("Asia/Manila", instant);
    expect(profileToday).toBe("2026-07-02");

    const dueTomorrow = { ...baseBill, due_date: "2026-07-03" };
    expect(shouldEnqueueAutoDeduct(dueTomorrow, profileToday, [], [])).toBe(false);

    const dueToday = { ...baseBill, due_date: "2026-07-02" };
    expect(shouldEnqueueAutoDeduct(dueToday, profileToday, [], [])).toBe(true);
  });

  it("does not enqueue when bill is due tomorrow in a profile TZ behind UTC", () => {
    const instant = new Date("2026-07-02T02:00:00.000Z");
    const profileToday = profileTodayIso("America/Los_Angeles", instant);
    expect(profileToday).toBe("2026-07-01");

    const dueTomorrow = { ...baseBill, due_date: "2026-07-02" };
    expect(shouldEnqueueAutoDeduct(dueTomorrow, profileToday, [], [])).toBe(false);

    const dueToday = { ...baseBill, due_date: "2026-07-01" };
    expect(shouldEnqueueAutoDeduct(dueToday, profileToday, [], [])).toBe(true);
  });
});

describe("toggle-off preserves auto-deduct history", () => {
  it("stops future auto-fires when auto_deduct is false", () => {
    const disabled = { ...baseBill, auto_deduct: false };
    expect(shouldEnqueueAutoDeduct(disabled, "2026-07-02", [], [])).toBe(false);
  });

  it("does not clear or ignore prior auto_deducted transactions when toggle is off", () => {
    const history: TransactionRecord[] = [
      {
        tx_id: "tx-auto-1",
        date: "2026-06-02",
        description: "Rent",
        amount: "-1000.00",
        source: "Checking",
        currency: "USD",
        tags: [],
        tx_type: "EXPENSE",
        category: "",
        bill: "Rent",
        auto_deducted: true,
      },
    ];
    const disabled = { ...baseBill, auto_deduct: false, due_date: "2026-07-02" };
    expect(shouldEnqueueAutoDeduct(disabled, "2026-07-02", [], history)).toBe(false);
    expect(hasExistingTransactionForBillPeriod("Rent", "2026-06-02", history)).toBe(true);
    expect(history[0]?.auto_deducted).toBe(true);
  });
});

describe("re-trigger idempotency (client dedup + outbox contract)", () => {
  const profileToday = profileTodayIso("UTC");

  const dueTodayBill: UpcomingExpenseRecord = {
    ...baseBill,
    due_date: profileToday,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAppProfile.mockResolvedValue({ timezone: "UTC" } as Awaited<ReturnType<typeof getAppProfile>>);
    mockedListUpcoming.mockResolvedValue([dueTodayBill]);
    mockedBuildFallbackTxList.mockResolvedValue([]);
    mockedCreateTransactions.mockResolvedValue({ offline_queued: true, idempotency_key: "idem-1" });
    mockedListOutboxOrdered.mockResolvedValue([]);
  });

  it("dedup guard blocks a second enqueue for the same bill period on re-trigger", () => {
    const pending: TransactionCreateRequest[] = [
      {
        date: profileToday,
        amount: "1000",
        source: "Checking",
        currency: "USD",
        tx_type: "EXPENSE",
        bill: "Rent",
        auto_deducted: true,
      },
    ];
    expect(shouldEnqueueAutoDeduct(dueTodayBill, profileToday, pending, [])).toBe(false);
    expect(shouldEnqueueAutoDeduct(dueTodayBill, profileToday, pending, [])).toBe(false);
  });

  it("runAutoDeductDueTodayCheck enqueues once across concurrent re-triggers", async () => {
    await Promise.all([runAutoDeductDueTodayCheck(), runAutoDeductDueTodayCheck(), runAutoDeductDueTodayCheck()]);
    expect(mockedCreateTransactions).toHaveBeenCalledTimes(1);
  });

  it("runAutoDeductDueTodayCheck skips second pass after pending body is recorded", async () => {
    await runAutoDeductDueTodayCheck();
    await runAutoDeductDueTodayCheck();
    expect(mockedCreateTransactions).toHaveBeenCalledTimes(1);
  });

  /**
   * Second layer: if a duplicate POST reaches the network, `drain.ts` replays the queued row's
   * stable `idempotencyKey` as `Idempotency-Key` (see `outbox.test.ts` + API `test_pwa_write_contract.py`).
   * No parallel infra here — that server replay contract is owned by the outbox/API suites.
   */
  it("documents outbox Idempotency-Key as the network dedup layer", () => {
    expect(typeof buildAutoDeductPayload(dueTodayBill, profileToday).auto_deducted).toBe("boolean");
  });
});

describe("partial-pay parity (F-004)", () => {
  const volatilePartialBill: UpcomingExpenseRecord = {
    ...baseBill,
    name: "Electric",
    amount: "500",
    bill_class: "volatile",
    planned_partial_amount: "120",
  };

  it("uses planned_partial_amount for volatile bills with a partial plan", () => {
    expect(autoDeductAmountForBill(volatilePartialBill)).toBe("120");
    const payload = buildAutoDeductPayload(volatilePartialBill, "2026-07-02");
    expect(payload.amount).toBe("120");
    expect(payload.bill).toBe("Electric");
    expect(payload.auto_deducted).toBe(true);
  });

  it("falls back to full bill amount when no partial plan is set", () => {
    const rigid = { ...baseBill, bill_class: "rigid" as const, planned_partial_amount: null };
    expect(autoDeductAmountForBill(rigid)).toBe("1000");
    expect(buildAutoDeductPayload(rigid, "2026-07-02").amount).toBe("1000");
  });

  it("rides the same transaction POST shape as manual bill payment", () => {
    const manual: TransactionCreateRequest = {
      date: "2026-07-02",
      amount: "120",
      source: "Checking",
      currency: "USD",
      tx_type: "EXPENSE",
      description: "Electric",
      bill: "Electric",
    };
    const auto = buildAutoDeductPayload(volatilePartialBill, "2026-07-02");
    expect(auto.date).toBe(manual.date);
    expect(auto.amount).toBe(manual.amount);
    expect(auto.source).toBe(manual.source);
    expect(auto.currency).toBe(manual.currency);
    expect(auto.tx_type).toBe(manual.tx_type);
    expect(auto.bill).toBe(manual.bill);
    expect(auto.auto_deducted).toBe(true);
  });
});
