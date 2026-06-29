/**
 * Merge allowlisted upcoming-expense outbox rows into cached list reads (FIFO).
 */

import type { OutboxRow } from "./db";
import { listOutboxOrdered } from "./outbox";
import type { UpcomingExpenseRecord, UpcomingExpenseMutationPayload } from "../api/types";
import { normalizeBillCadence } from "../lib/billCadence";

const UE_LIST = /^\/finance\/upcoming_expenses\/?$/;

function normPath(url: string): string {
  const p = url.split("?")[0];
  return p.endsWith("/") || p.length === 0 ? p : `${p}/`;
}

function parseUeDetail(url: string): string | undefined {
  const pathRaw = url.split("?")[0];
  const m = pathRaw.match(/^\/finance\/upcoming_expenses\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function normalizeRow(row: Partial<UpcomingExpenseRecord>): UpcomingExpenseRecord {
  const isRecur = (row as { is_recurring?: boolean }).is_recurring;
  const billClass = row.bill_class === "volatile" ? "volatile" : "rigid";
  return {
    name: String(row.name ?? "").trim(),
    amount: String(row.amount ?? "0"),
    currency: String(row.currency ?? "USD").toUpperCase(),
    due_date: String(row.due_date ?? ""),
    paid_flag: Boolean(row.paid_flag),
    recurring_flag: Boolean(row.recurring_flag ?? isRecur),
    bill_class: billClass,
    planned_partial_amount: row.planned_partial_amount == null ? null : String(row.planned_partial_amount),
    cycle_residual_amount: row.cycle_residual_amount == null ? null : String(row.cycle_residual_amount),
    remainder_due_date: row.remainder_due_date ? String(row.remainder_due_date) : null,
    cadence: normalizeBillCadence(row.cadence as string | undefined),
    custom_interval_days:
      row.custom_interval_days == null ? null : Number(row.custom_interval_days),
    source: row.source ? String(row.source) : "",
    start_date: row.start_date ? String(row.start_date) : "",
    end_date: row.end_date ? String(row.end_date) : "",
  };
}

function parsePostBody(body: unknown): UpcomingExpenseMutationPayload | undefined {
  if (!body || typeof body !== "object" || !("name" in body)) {
    return undefined;
  }
  return body as UpcomingExpenseMutationPayload;
}

function nullableString(value: string | number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value);
}

function mergeUeRow(base: UpcomingExpenseRecord, patch: Partial<UpcomingExpenseMutationPayload>): UpcomingExpenseRecord {
  const nextName = patch.name != null ? String(patch.name).trim() : base.name;
  return normalizeRow({
    ...base,
    name: nextName,
    amount: patch.amount != null ? String(patch.amount) : base.amount,
    currency: patch.currency != null ? String(patch.currency) : base.currency,
    due_date: patch.due_date != null ? String(patch.due_date) : base.due_date,
    paid_flag: patch.paid_flag != null ? Boolean(patch.paid_flag) : base.paid_flag,
    recurring_flag:
      patch.recurring_flag != null
        ? Boolean(patch.recurring_flag)
        : patch.is_recurring != null
          ? Boolean(patch.is_recurring)
          : base.recurring_flag,
    bill_class: patch.bill_class != null ? patch.bill_class : base.bill_class,
    planned_partial_amount:
      patch.planned_partial_amount !== undefined ? nullableString(patch.planned_partial_amount) : base.planned_partial_amount,
    cycle_residual_amount:
      patch.cycle_residual_amount !== undefined ? nullableString(patch.cycle_residual_amount) : base.cycle_residual_amount,
    remainder_due_date: patch.remainder_due_date !== undefined ? patch.remainder_due_date : base.remainder_due_date,
    cadence: patch.cadence != null ? normalizeBillCadence(patch.cadence) : base.cadence,
    custom_interval_days:
      patch.custom_interval_days !== undefined ? patch.custom_interval_days ?? null : base.custom_interval_days,
    source: patch.source != null ? String(patch.source) : base.source,
    start_date: patch.start_date != null ? String(patch.start_date) : base.start_date,
    end_date: patch.end_date != null ? String(patch.end_date) : base.end_date,
  });
}

function nameKey(n: string): string {
  return n.trim().toLowerCase();
}

export function mergeUpcomingOutboxFifo(list: UpcomingExpenseRecord[], rows: OutboxRow[]): UpcomingExpenseRecord[] {
  const byKey = new Map<string, UpcomingExpenseRecord>();
  for (const r of list) {
    const k = nameKey(r.name);
    if (k) {
      byKey.set(k, { ...r });
    }
  }
  for (const row of rows) {
    if (row.id === undefined) {
      continue;
    }
    const method = row.method.toUpperCase();
    const norm = normPath(row.url);
    if (method === "POST" && UE_LIST.test(norm)) {
      const payload = parsePostBody(row.body);
      if (!payload?.name?.trim()) {
        continue;
      }
      const synthetic = normalizeRow({
        name: payload.name.trim(),
        amount: String(payload.amount ?? "0"),
        currency: String(payload.currency ?? "USD"),
        due_date: String(payload.due_date ?? ""),
        paid_flag: Boolean(payload.paid_flag),
        recurring_flag: Boolean(payload.recurring_flag ?? payload.is_recurring),
        bill_class: payload.bill_class,
        planned_partial_amount: payload.planned_partial_amount == null ? null : String(payload.planned_partial_amount),
        cycle_residual_amount: payload.cycle_residual_amount == null ? null : String(payload.cycle_residual_amount),
        remainder_due_date: payload.remainder_due_date || null,
        cadence: normalizeBillCadence(payload.cadence),
        custom_interval_days: payload.custom_interval_days ?? null,
        source: payload.source ? String(payload.source) : "",
        start_date: payload.start_date ? String(payload.start_date) : "",
        end_date: payload.end_date ? String(payload.end_date) : "",
      });
      const k = nameKey(synthetic.name);
      byKey.set(k, synthetic);
      continue;
    }
    const urlName = parseUeDetail(row.url);
    if (!urlName) {
      continue;
    }
    const urlK = nameKey(urlName);
    if (method === "DELETE") {
      byKey.delete(urlK);
      continue;
    }
    if (method === "PATCH" || method === "PUT") {
      const prev = byKey.get(urlK);
      if (!prev) {
        continue;
      }
      const merged = mergeUeRow(prev, (row.body ?? {}) as Partial<UpcomingExpenseMutationPayload>);
      byKey.delete(urlK);
      byKey.set(nameKey(merged.name), merged);
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Merge queued upcoming expense mutators into a list (FIFO). */
export async function applyUpcomingOutboxToList(base: UpcomingExpenseRecord[]): Promise<UpcomingExpenseRecord[]> {
  const rows = await listOutboxOrdered();
  return mergeUpcomingOutboxFifo(base, rows);
}
