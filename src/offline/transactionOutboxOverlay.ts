/**
 * Merges allowlisted transaction outbox rows into snapshot/list reads so the UI
 * stays usable offline or before drain completes.
 *
 * Limitations (acceptable until we cache ECB rates + wider tx index in IndexedDB):
 * - Cross-currency math uses **no conversion** (amount treated as numeric in target
 *   currency). Same-currency paths match the API.
 * - Source balance replay starts from cached `source_balances` + outbox deltas; if
 *   DELETE/PATCH targets a tx id that was never in the cached month snapshot, the
 *   balance reversal is skipped until the next online refresh.
 *
 * Rust/WASM is **not** required for this layer: deterministic replay of signed
 * amounts. A future shared **rate table** (bundled or synced) would align
 * cross-currency with the Django `convert_currency` path.
 */

import type { SnapshotResponse, SnapshotTransactionRow, TransactionCreateRequest, TransactionPatchRequest, TransactionRecord } from "../api/types";
import type { OutboxRow } from "./db";
import { readCachePayload } from "./cache";
import { listOutboxOrdered } from "./outbox";

const TX_LIST = /^\/finance\/transactions\/?$/;
const TX_DETAIL = /^\/finance\/transactions\/([^/]+)\/?$/;

const PROFILE_CACHE_ID = "appprofile:root";

function parseAmount(n: string | number): number {
  if (typeof n === "number") {
    return Number.isFinite(n) ? n : 0;
  }
  const t = String(n).replace(/,/g, "").trim();
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : 0;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/** Match API `fix_tx_data` / DB storage: EXPENSE and XFER_OUT negative; INCOME and XFER_IN positive. */
export function signedAmountFromTxLike(amountStr: string, txType: string): number {
  const raw = parseAmount(amountStr);
  if (!Number.isFinite(raw)) {
    return 0;
  }
  const tt = (txType || "").toUpperCase();
  if (tt === "EXPENSE" || tt === "XFER_OUT") {
    return raw <= 0 ? raw : -Math.abs(raw);
  }
  if (tt === "INCOME" || tt === "XFER_IN") {
    return raw >= 0 ? raw : Math.abs(raw);
  }
  return raw;
}

/** API `_calc_totals` without ECB offline: same-currency only; else pass-through (documented). */
function amountInBase(amount: number, currency: string, baseCurrency: string): number {
  const c = currency.trim().toUpperCase();
  const b = baseCurrency.trim().toUpperCase();
  if (c === b) {
    return amount;
  }
  return amount;
}

function convertTxToSourceCurrency(amount: number, txCurrency: string, sourceCurrency: string): number {
  const t = txCurrency.trim().toUpperCase();
  const s = sourceCurrency.trim().toUpperCase();
  if (t === s) {
    return amount;
  }
  return amount;
}

type MutableSource = { source: string; acc_type: string; amount: number; currency: string };

function cloneSourcesFromBase(base: SnapshotResponse): Map<string, MutableSource> {
  const m = new Map<string, MutableSource>();
  for (const row of base.source_balances) {
    const key = row.source.trim().toLowerCase();
    m.set(key, {
      source: row.source,
      acc_type: row.acc_type,
      amount: parseAmount(row.amount),
      currency: (row.currency || "USD").trim().toUpperCase(),
    });
  }
  return m;
}

function applyTxToSourceBalance(sources: Map<string, MutableSource>, tx: TransactionRecord, direction: 1 | -1): void {
  const key = tx.source.trim().toLowerCase();
  let row = sources.get(key);
  if (!row) {
    const ccy = (tx.currency || "USD").toUpperCase();
    row = { source: tx.source.trim(), acc_type: "UNKNOWN", amount: 0, currency: ccy };
    sources.set(key, row);
  }
  const signed = signedAmountFromTxLike(tx.amount, tx.tx_type);
  const delta = convertTxToSourceCurrency(signed, (tx.currency || "USD").toUpperCase(), row.currency) * direction;
  row.amount = round2(row.amount + delta);
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
  const signed = signedAmountFromTxLike(String(req.amount ?? "0"), String(req.tx_type ?? "EXPENSE"));
  return {
    tx_id: txId,
    date: String(req.date || "").slice(0, 10),
    description: String(req.description ?? ""),
    amount: signed.toFixed(2),
    source: String(req.source ?? "").trim(),
    currency: String(req.currency ?? "").toUpperCase(),
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
    source: (r.source ?? "").trim(),
    currency: (r.currency ?? "").toUpperCase(),
    tags: r.tags ?? [],
    tx_type: r.tx_type,
    category: r.category ?? "",
    bill: r.bill ?? undefined,
  };
}

function mergePatch(record: TransactionRecord, patch: TransactionPatchRequest): TransactionRecord {
  const nextAmount = patch.amount != null ? String(patch.amount) : record.amount;
  const nextType = patch.tx_type ?? record.tx_type;
  const signedStr = signedAmountFromTxLike(nextAmount, String(nextType)).toFixed(2);
  return {
    ...record,
    date: patch.date ?? record.date,
    description: patch.description ?? record.description,
    amount: signedStr,
    source: (patch.source ?? record.source).trim(),
    currency: (patch.currency ?? record.currency).toUpperCase(),
    tags: patch.tags ?? record.tags,
    tx_type: nextType,
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

/**
 * Replays outbox onto a tx map; optionally applies the same operations to source balances
 * (FIFO) for snapshot refresh.
 */
function applyOutboxToTxMapAndSources(
  map: Map<string, TransactionRecord>,
  sources: Map<string, MutableSource> | null,
  rows: OutboxRow[],
): void {
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
        const rec = createRequestToRecord(req, txId);
        if (sources) {
          applyTxToSourceBalance(sources, rec, 1);
        }
        map.set(txId, rec);
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
      const prev = map.get(serverId);
      if (prev && sources) {
        applyTxToSourceBalance(sources, prev, -1);
      }
      map.delete(serverId);
      continue;
    }

    if (method === "PATCH" && row.body && typeof row.body === "object") {
      const prev = map.get(serverId);
      if (!prev) {
        continue;
      }
      if (sources) {
        applyTxToSourceBalance(sources, prev, -1);
      }
      const merged = mergePatch(prev, row.body as TransactionPatchRequest);
      if (sources) {
        applyTxToSourceBalance(sources, merged, 1);
      }
      map.set(serverId, merged);
    }
  }
}

async function readProfileBaseCurrency(): Promise<string> {
  const raw = await readCachePayload(PROFILE_CACHE_ID);
  if (raw && typeof raw === "object" && "base_currency" in raw) {
    return String((raw as { base_currency?: string }).base_currency || "USD")
      .trim()
      .toUpperCase();
  }
  return "USD";
}

function buildFlowSeriesFromRows(
  rows: SnapshotTransactionRow[],
  baseCurrency: string,
): Array<{ label: string; incoming: number; outgoing: number; leaks: number }> {
  const byDay = new Map<string, { incoming: number; outgoing: number; leaksRaw: number }>();
  for (const r of rows) {
    const day = (r.date || r.created_on || "").slice(0, 10);
    if (!day) {
      continue;
    }
    const signed = signedAmountFromTxLike(String(r.amount ?? ""), String(r.tx_type ?? ""));
    const inBase = amountInBase(signed, (r.currency || baseCurrency).toUpperCase(), baseCurrency);
    const tt = String(r.tx_type || "").toUpperCase();
    const bucket = byDay.get(day) ?? { incoming: 0, outgoing: 0, leaksRaw: 0 };
    if (tt === "INCOME") {
      bucket.incoming += Math.abs(inBase);
    } else if (tt === "EXPENSE") {
      bucket.outgoing += Math.abs(inBase);
    } else if (tt === "XFER_OUT" || tt === "XFER_IN") {
      bucket.leaksRaw += inBase;
    }
    byDay.set(day, bucket);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({
      label,
      incoming: round2(v.incoming),
      outgoing: round2(v.outgoing),
      leaks: round2(Math.abs(v.leaksRaw)),
    }));
}

function mergedTransactionMapWithRows(base: TransactionRecord[], rows: OutboxRow[]): Map<string, TransactionRecord> {
  const map = new Map<string, TransactionRecord>();
  for (const r of base) {
    map.set(r.tx_id, { ...r, tags: [...(r.tags ?? [])] });
  }
  applyOutboxToTxMapAndSources(map, null, rows);
  return map;
}

async function mergedTransactionMap(base: TransactionRecord[]): Promise<Map<string, TransactionRecord>> {
  const rows = await listOutboxOrdered();
  return mergedTransactionMapWithRows(base, rows);
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

function computeTotalsFromSnapshotRows(
  rows: SnapshotTransactionRow[],
  baseCurrency: string,
): Pick<
  SnapshotResponse,
  | "total_expenses_for_month"
  | "total_income_for_month"
  | "total_transfer_out_for_month"
  | "total_transfer_in_for_month"
  | "total_leaks_for_month"
> {
  let te = 0;
  let ti = 0;
  let tto = 0;
  let tti = 0;
  let netXferBase = 0;
  for (const r of rows) {
    const signed = signedAmountFromTxLike(String(r.amount ?? ""), String(r.tx_type ?? ""));
    const inBase = amountInBase(signed, (r.currency || baseCurrency).toUpperCase(), baseCurrency);
    const tt = String(r.tx_type || "").toUpperCase();
    if (tt === "EXPENSE") {
      te += inBase;
    } else if (tt === "INCOME") {
      ti += inBase;
    } else if (tt === "XFER_OUT") {
      tto += inBase;
    } else if (tt === "XFER_IN") {
      tti += inBase;
    }
    if (tt === "XFER_OUT" || tt === "XFER_IN") {
      netXferBase += inBase;
    }
  }
  return {
    total_expenses_for_month: round2(te),
    total_income_for_month: round2(ti),
    total_transfer_out_for_month: round2(tto),
    total_transfer_in_for_month: round2(tti),
    total_leaks_for_month: round2(Math.abs(netXferBase)),
  };
}

function computeExpenseByCategory(
  rows: SnapshotTransactionRow[],
  baseCurrency: string,
): Array<{ name: string; value: number }> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (String(r.tx_type || "").toUpperCase() !== "EXPENSE") {
      continue;
    }
    const name = String(r.category || "").trim() || "Uncategorized";
    const signed = signedAmountFromTxLike(String(r.amount ?? ""), "EXPENSE");
    const inBase = amountInBase(signed, (r.currency || baseCurrency).toUpperCase(), baseCurrency);
    const n = Math.abs(inBase);
    m.set(name, round2((m.get(name) ?? 0) + n));
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function sourcesToSnapshotRows(sources: Map<string, MutableSource>): SnapshotResponse["source_balances"] {
  return [...sources.values()]
    .map((s) => ({
      source: s.source,
      acc_type: s.acc_type,
      amount: s.amount.toFixed(2),
      currency: s.currency,
    }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

/** Merge pending transaction outbox into a cached or live snapshot (month-scoped list + derived totals). */
export async function applyTransactionOutboxToSnapshot(
  base: SnapshotResponse,
  params: Record<string, string>,
): Promise<SnapshotResponse> {
  const baseRecords = base.transactions_for_month.map(snapshotRowToRecord);
  const outboxRows = await listOutboxOrdered();
  const map = mergedTransactionMapWithRows(baseRecords, outboxRows);
  const mergedRows = [...map.values()].filter(
    (r) => transactionRecordMatchesParams(r, params) && matchesDimensionFilters(r, params),
  );
  mergedRows.sort(sortRecords);
  const snapRows = mergedRows.map(recordToSnapshotRow);

  const baseCurrency = await readProfileBaseCurrency();
  const totals = computeTotalsFromSnapshotRows(snapRows, baseCurrency);
  const expense_by_category = computeExpenseByCategory(snapRows, baseCurrency);
  const flow_series = buildFlowSeriesFromRows(snapRows, baseCurrency);
  const daily_spend = flow_series.filter((p) => p.outgoing > 0).map((p) => ({ date: p.label, amount: p.outgoing }));
  const daily_income = flow_series.filter((p) => p.incoming > 0).map((p) => ({ date: p.label, amount: p.incoming }));

  const sourcesClone = cloneSourcesFromBase(base);
  const sourceReplayMap = new Map<string, TransactionRecord>();
  for (const r of base.transactions_for_month.map(snapshotRowToRecord)) {
    sourceReplayMap.set(r.tx_id, { ...r, tags: [...(r.tags ?? [])] });
  }
  applyOutboxToTxMapAndSources(sourceReplayMap, sourcesClone, outboxRows);
  const source_balances = sourcesToSnapshotRows(sourcesClone);

  return {
    ...base,
    transactions_for_month: snapRows,
    ...totals,
    expense_by_category,
    flow_series,
    daily_spend,
    daily_income,
    source_balances,
  };
}
