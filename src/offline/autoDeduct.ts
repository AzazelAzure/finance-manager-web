/**
 * Client-side auto-deduct due-today check: enqueue normal transaction POSTs via outbox.
 */

import { getAppProfile } from "../api/profile";
import { createTransactions } from "../api/transactions";
import { listUpcomingExpenses } from "../api/upcomingExpenses";
import type { TransactionCreateRequest, TransactionRecord, UpcomingExpenseRecord } from "../api/types";
import { profileTodayIso } from "../lib/profileDate";
import { getRefreshToken } from "../state/auth";
import { listOutboxOrdered, parseOutboxBody } from "./outbox";
import { buildFallbackTxList } from "../api/transactions";
import { requestPwaReadBypassAfterMutation } from "./pwaReadBypass";
import { queryClient } from "../lib/queryClient";
import { isOfflineQueued, type TransactionMutationResult } from "../api/types";

const TX_LIST_PATH = /^\/finance\/transactions\/?$/;

function normPath(url: string): string {
  const p = url.split("?")[0];
  return p.endsWith("/") || p.length === 0 ? p : `${p}/`;
}

function normalizePostBodies(body: unknown): TransactionCreateRequest[] {
  const parsed = parseOutboxBody(body);
  if (Array.isArray(parsed)) {
    return parsed.filter((b): b is TransactionCreateRequest => Boolean(b) && typeof b === "object" && "date" in b);
  }
  if (parsed && typeof parsed === "object" && "date" in parsed) {
    return [parsed as TransactionCreateRequest];
  }
  return [];
}

export function hasPendingOutboxTransactionForBill(billName: string, dueDate: string, bodies: TransactionCreateRequest[]): boolean {
  const bill = billName.trim();
  const date = dueDate.slice(0, 10);
  return bodies.some((body) => String(body.bill ?? "").trim() === bill && String(body.date ?? "").slice(0, 10) === date);
}

export async function listPendingTransactionBodiesFromOutbox(): Promise<TransactionCreateRequest[]> {
  const rows = await listOutboxOrdered();
  const bodies: TransactionCreateRequest[] = [];
  for (const row of rows) {
    if (row.method.toUpperCase() !== "POST" || !TX_LIST_PATH.test(normPath(row.url))) {
      continue;
    }
    bodies.push(...normalizePostBodies(row.body));
  }
  return bodies;
}

export function hasExistingTransactionForBillPeriod(
  billName: string,
  dueDate: string,
  transactions: TransactionRecord[],
): boolean {
  const bill = billName.trim();
  const date = dueDate.slice(0, 10);
  return transactions.some((tx) => String(tx.bill ?? "").trim() === bill && tx.date.slice(0, 10) === date);
}

export function shouldEnqueueAutoDeduct(
  bill: UpcomingExpenseRecord,
  profileToday: string,
  pendingBodies: TransactionCreateRequest[],
  transactions: TransactionRecord[],
): boolean {
  if (!bill.auto_deduct) {
    return false;
  }
  const source = String(bill.source ?? "").trim();
  if (!source || bill.paid_flag) {
    return false;
  }
  if (bill.due_date.slice(0, 10) !== profileToday) {
    return false;
  }
  if (hasPendingOutboxTransactionForBill(bill.name, profileToday, pendingBodies)) {
    return false;
  }
  if (hasExistingTransactionForBillPeriod(bill.name, profileToday, transactions)) {
    return false;
  }
  return true;
}

/** Mirrors API `Calculator._effective_bill_amount` for the auto-deduct POST payload. */
export function autoDeductAmountForBill(bill: UpcomingExpenseRecord): string {
  const partial = bill.planned_partial_amount;
  if (partial != null && String(partial).trim() !== "") {
    return String(partial).trim();
  }
  const residual = bill.cycle_residual_amount;
  if (residual != null && String(residual).trim() !== "") {
    return String(residual).trim();
  }
  return bill.amount;
}

export function buildAutoDeductPayload(bill: UpcomingExpenseRecord, profileToday: string): TransactionCreateRequest {
  return {
    date: profileToday,
    amount: autoDeductAmountForBill(bill),
    source: String(bill.source ?? "").trim(),
    currency: bill.currency,
    tx_type: "EXPENSE",
    description: bill.name,
    bill: bill.name,
    auto_deducted: true,
  };
}

let checkInFlight: Promise<void> | null = null;

/** Run on app open / sync: enqueue due-today auto-deduct transactions (PWA outbox). */
export async function runAutoDeductDueTodayCheck(): Promise<void> {
  if (checkInFlight) {
    return checkInFlight;
  }
  if (!getRefreshToken().trim()) {
    return;
  }
  checkInFlight = (async () => {
    try {
      const profile = await getAppProfile();
      const timezone = profile.timezone || "UTC";
      const profileToday = profileTodayIso(timezone);
      const [bills, pendingBodies] = await Promise.all([
        listUpcomingExpenses(),
        listPendingTransactionBodiesFromOutbox(),
      ]);
      const transactions = await buildFallbackTxList({});
      let enqueued = false;
      for (const bill of bills) {
        if (!shouldEnqueueAutoDeduct(bill, profileToday, pendingBodies, transactions)) {
          continue;
        }
        const payload = buildAutoDeductPayload(bill, profileToday);
        const result = await createTransactions(payload);
        if (isOfflineQueued(result)) {
          pendingBodies.push(payload);
          transactions.push({
            tx_id: `pending:${result.idempotency_key ?? "auto"}`,
            date: payload.date,
            description: payload.description ?? "",
            amount: String(payload.amount),
            source: payload.source,
            currency: payload.currency,
            tags: [],
            tx_type: payload.tx_type,
            category: "",
            bill: payload.bill,
            auto_deducted: true,
          });
          enqueued = true;
          continue;
        }
        const mutation = result as TransactionMutationResult;
        if ((mutation.accepted?.length ?? 0) > 0) {
          enqueued = true;
        }
      }
      if (enqueued) {
        requestPwaReadBypassAfterMutation();
        await queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"], refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
      }
    } catch {
      // Missing cache/auth — retry on next lifecycle tick.
    }
  })().finally(() => {
    checkInFlight = null;
  });
  return checkInFlight;
}
