import type { SnapshotResponse, SnapshotTransactionRow, TransactionCreateRequest, TransactionPatchRequest, TransactionRecord } from "../api/types";
import type { OutboxRow } from "./db";
import { listOutboxOrdered } from "./outbox";

const TX_LIST = /^\/finance\/transactions\/?$/;
const TX_DETAIL = /^\/finance\/transactions\/([^/]+)\/?$/;

function parseAmount(n: string | number): number {
  if (typeof n === "number") {
    return Number.isFinite(n) ? n : 0;
  }
  const t = String(n).replace(/,/g, "").trim();
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : 0;
}

function txYearMonth(txDate: string): string | null {
  const t = (txDate || "").trim().slice(0, 10);
  if (t.length < 7) {
    return null;
  }
  return t.slice(0, 7);
}

function inCurrentMonth(txDate: string): boolean {
  const ym = txYearMonth(txDate);
  if (!ym) {
    return false;
  }
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return ym === cur;
}

function inLastMonth(txDate: string): boolean {
  const ym = txYearMonth(txDate);
  if (!ym) {
    return false;
  }
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return ym === prev;
}

function inPreviousWeek(txDate: string): boolean {
  const t = new Date(`${txDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(t.getTime())) {
    return false;
  }
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - diffToMonday);
  thisMonday.setHours(0, 0, 0, 0);
  const prevMonday = new Date(thisMonday);
  prevMonday.setDate(thisMonday.getDate() - 7);
  const prevSunday = new Date(thisMonday);
  prevSunday.setDate(thisMonday.getDate() - 1);
  prevSunday.setHours(23, 59, 59, 999);
  return t >= prevMonday && t <= prevSunday;
}

function hasExplicitPeriod(params: Record<string, string | undefined>): boolean {
  return (
    params.last_month === "1" ||
    params.previous_week === "1" ||
    !!(params.start_date && params.end_date) ||
    Boolean(params.date) ||
    params.current_month === "1"
  );
}

/** Whether a transaction row belongs to the same period as snapshot / list API params. */
export function transactionRecordMatchesParams(
  r: TransactionRecord,
  params: Record<string, string | undefined>,
): boolean {
  const txDate = (r.date || "").trim();
  const treatAsCurrent = params.current_month === "1" || !hasExplicitPeriod(params);

  if (treatAsCurrent) {
    return inCurrentMonth(txDate);
  }
  if (params.last_month === "1") {
    return inLastMonth(txDate);
  }
  if (params.previous_week === "1") {
    return inPreviousWeek(txDate);
  }
  if (params.start_date && params.end_date) {
    return txDate >= params.start_date && txDate <= params.end_date;
  }
  if (params.date) {
    return txDate === params.date;
  }
  return inCurrentMonth(txDate);
}

function matchesDimensionFilters(r: TransactionRecord, params: Record<string, string | undefined>): boolean {
  if (params.tx_type && String(params.tx_type) !== String(r.tx_type ?? "")) {
    return false;
  }
  if (params.category && String(params.category) !== String(r.category ?? "")) {
    return false;
  }
  if (params.source && String(params.source) !== String(r.source ?? "")) {
    return false;
  }
  if (params.currency_code) {
    const want = String(params.currency_code).trim().toUpperCase();
    const got = String(r.currency ?? "").trim().toUpperCase();
    if (want && got !== want) {
      return false;
    }
  }
  if (params.tag_name) {
    const want = String(params.tag_name);
    if (!(r.tags ?? []).some((t) => t === want)) {
      return false;
    }
  }
  return true;
}

function normalizeTransactionPostBody(body: unknown): TransactionCreateRequest[] {
  if (Array.isArray(body)) {
    return body.filter((b): b is TransactionCreateRequest => Boolean(b) && typeof b === "object" && "date" in b);
  }
  if (body && typeof body === "object" && "date" in body) {
    return [body as TransactionCreateRequest];
  }
  return [];
}

function createRequestToRecord(req: TransactionCreateRequest, txId: string): TransactionRecord {
  return {
    tx_id: txId,
    date: String(req.date || "").slice(0, 10),
    description: String(req.description ?? ""),
    amount: String(req.amount ?? ""),
    source: String(req.source ?? ""),
    currency: String(req.currency ?? ""),
    tags: Array.isArray(req.tags) ? [...req.tags] : [],
    tx_type: String(req.tx_type ?? "EXPENSE"),
    category: String(req.category ?? ""),
    bill: req.bill,
  };
}

function recordToSnapshotRow(r: TransactionRecord): SnapshotTransactionRow {
  return {
    tx_id: r.tx_id,
    created_on: r.date,
    date: r.date,
    description: r.description,
    amount: r.amount,
    source: r.source,
    currency: r.currency,
    tags: r.tags,
    tx_type: r.tx_type,
    category: r.category,
    bill: r.bill ?? null,
  };
}

function snapshotRowToRecord(r: SnapshotTransactionRow): TransactionRecord {
  const d = (r.date || r.created_on || "").slice(0, 10);
  return {
    tx_id: r.tx_id,
    date: d,
    description: r.description ?? "",
    amount: String(r.amount ?? ""),
    source: r.source ?? "",
    currency: r.currency ?? "",
    tags: r.tags ?? [],
    tx_type: r.tx_type,
    category: r.category ?? "",
    bill: r.bill ?? undefined,
  };
}

function mergePatch(record: TransactionRecord, patch: TransactionPatchRequest): TransactionRecord {
  return {
    ...record,
    date: patch.date ?? record.date,
    description: patch.description ?? record.description,
    amount: patch.amount != null ? String(patch.amount) : record.amount,
    source: patch.source ?? record.source,
    currency: patch.currency ?? record.currency,
    tags: patch.tags ?? record.tags,
    tx_type: patch.tx_type ?? record.tx_type,
    category: patch.category ?? record.category,
    bill: patch.bill ?? record.bill,
  };
}

function sortRecords(a: TransactionRecord, b: TransactionRecord): number {
  const da = a.date || "";
  const db = b.date || "";
  if (da !== db) {
    return db.localeCompare(da);
  }
  return String(b.tx_id).localeCompare(String(a.tx_id));
}

function isPendingTxId(txId: string): boolean {
  return txId.startsWith("pending:");
}

function applyOutboxRowsToMap(map: Map<string, TransactionRecord>, rows: OutboxRow[]): void {
  for (const row of rows) {
    if (row.id === undefined) {
      continue;
    }
    const method = row.method.toUpperCase();
    const path = row.url.split("?")[0];
    const norm = path.endsWith("/") || path.length === 0 ? path : `${path}/`;

    if (method === "POST" && TX_LIST.test(norm)) {
      const bodies = normalizeTransactionPostBody(row.body);
      const keyBase = `pending:${row.idempotencyKey}`;
      bodies.forEach((req, idx) => {
        const txId = bodies.length === 1 ? keyBase : `${keyBase}:${idx}`;
        map.set(txId, createRequestToRecord(req, txId));
      });
      continue;
    }

    const detailMatch = norm.match(TX_DETAIL);
    if (!detailMatch) {
      continue;
    }
    const serverId = decodeURIComponent(detailMatch[1]);

    if (isPendingTxId(serverId)) {
      continue;
    }

    if (method === "DELETE") {
      map.delete(serverId);
      continue;
    }

    if (method === "PATCH" && row.body && typeof row.body === "object") {
      const cur = map.get(serverId);
      if (cur) {
        map.set(serverId, mergePatch(cur, row.body as TransactionPatchRequest));
      }
    }
  }
}

async function mergedTransactionMap(base: TransactionRecord[]): Promise<Map<string, TransactionRecord>> {
  const map = new Map<string, TransactionRecord>();
  for (const r of base) {
    map.set(r.tx_id, { ...r, tags: [...(r.tags ?? [])] });
  }
  const rows = await listOutboxOrdered();
  applyOutboxRowsToMap(map, rows);
  return map;
}

/** Merge pending transaction outbox ops into a list response (FIFO). */
export async function applyTransactionOutboxToList(
  base: TransactionRecord[],
  filterRecord: Record<string, unknown>,
): Promise<TransactionRecord[]> {
  const params = filterRecord as Record<string, string | undefined>;
  const map = await mergedTransactionMap(base);
  const out = [...map.values()].filter(
    (r) => transactionRecordMatchesParams(r, params) && matchesDimensionFilters(r, params),
  );
  out.sort(sortRecords);
  return out;
}

function computeTotalsFromSnapshotRows(rows: SnapshotTransactionRow[]): Pick<
  SnapshotResponse,
  | "total_expenses_for_month"
  | "total_income_for_month"
  | "total_transfer_out_for_month"
  | "total_transfer_in_for_month"
  | "total_leaks_for_month"
> {
  let total_expenses_for_month = 0;
  let total_income_for_month = 0;
  let total_transfer_out_for_month = 0;
  let total_transfer_in_for_month = 0;
  let total_leaks_for_month = 0;
  for (const r of rows) {
    const n = parseAmount(r.amount);
    const tt = String(r.tx_type || "").toUpperCase();
    if (tt === "EXPENSE") {
      total_expenses_for_month += n;
    } else if (tt === "INCOME") {
      total_income_for_month += n;
    } else if (tt === "XFER_OUT") {
      total_transfer_out_for_month += n;
    } else if (tt === "XFER_IN") {
      total_transfer_in_for_month += n;
    } else if (tt.includes("LEAK")) {
      total_leaks_for_month += n;
    }
  }
  return {
    total_expenses_for_month,
    total_income_for_month,
    total_transfer_out_for_month,
    total_transfer_in_for_month,
    total_leaks_for_month,
  };
}

function computeExpenseByCategory(rows: SnapshotTransactionRow[]): Array<{ name: string; value: number }> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (String(r.tx_type || "").toUpperCase() !== "EXPENSE") {
      continue;
    }
    const name = String(r.category || "").trim() || "Uncategorized";
    const n = parseAmount(r.amount);
    m.set(name, (m.get(name) ?? 0) + n);
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function computeDaily(rows: SnapshotTransactionRow[]): {
  daily_spend: Array<{ date: string; amount: number }>;
  daily_income: Array<{ date: string; amount: number }>;
} {
  const spendMap = new Map<string, number>();
  const incomeMap = new Map<string, number>();
  for (const r of rows) {
    const d = (r.date || r.created_on || "").slice(0, 10);
    if (!d) {
      continue;
    }
    const n = parseAmount(r.amount);
    const tt = String(r.tx_type || "").toUpperCase();
    if (tt === "EXPENSE") {
      spendMap.set(d, (spendMap.get(d) ?? 0) + n);
    }
    if (tt === "INCOME") {
      incomeMap.set(d, (incomeMap.get(d) ?? 0) + n);
    }
  }
  const daily_spend = [...spendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));
  const daily_income = [...incomeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));
  return { daily_spend, daily_income };
}

/** Merge pending transaction outbox into a cached or live snapshot (month-scoped list + derived totals). */
export async function applyTransactionOutboxToSnapshot(
  base: SnapshotResponse,
  params: Record<string, string>,
): Promise<SnapshotResponse> {
  const baseRecords = base.transactions_for_month.map(snapshotRowToRecord);
  const map = await mergedTransactionMap(baseRecords);
  const mergedRows = [...map.values()].filter(
    (r) => transactionRecordMatchesParams(r, params) && matchesDimensionFilters(r, params),
  );
  mergedRows.sort(sortRecords);
  const snapRows = mergedRows.map(recordToSnapshotRow);
  const totals = computeTotalsFromSnapshotRows(snapRows);
  const expense_by_category = computeExpenseByCategory(snapRows);
  const { daily_spend, daily_income } = computeDaily(snapRows);
  return {
    ...base,
    transactions_for_month: snapRows,
    ...totals,
    expense_by_category,
    daily_spend,
    daily_income,
  };
}
