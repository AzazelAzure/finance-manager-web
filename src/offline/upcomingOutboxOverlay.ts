/**
 * Merge allowlisted upcoming-expense outbox rows into cached list reads (FIFO).
 */

import type { OutboxRow } from "./db";
import { listOutboxOrdered } from "./outbox";
import type { UpcomingExpenseRecord, UpcomingExpenseMutationPayload } from "../api/types";

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
  return {
    name: String(row.name ?? "").trim(),
    amount: String(row.amount ?? "0"),
    currency: String(row.currency ?? "USD").toUpperCase(),
    due_date: String(row.due_date ?? ""),
    paid_flag: Boolean(row.paid_flag),
    recurring_flag: Boolean(row.recurring_flag ?? isRecur),
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
