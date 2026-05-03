/**
 * Merges allowlisted transaction outbox rows into snapshot/list reads so the UI
 * stays usable offline or before drain completes.
 *
 * Cross-currency: uses **stored** pairwise rates from `GET /finance/exchange_rates/`
 * (see `offline/exchangeRates.ts`). If a pair is missing, conversion falls back to
 * identity (same as pre-rates behavior).
 *
 * DELETE balance reversal: prefers the tx row from the cached snapshot month; if
 * missing, uses optional outbox **echo** (`kind: "transaction_delete"`) captured when
 * the user deletes from the ledger while offline.
 */

import type {
  SnapshotResponse,
  SnapshotTransactionRow,
  SourceRow,
  TransactionCreateRequest,
  TransactionPatchRequest,
  TransactionRecord,
} from "../api/types";
import type { OutboxRow } from "./db";
import { readCachePayload } from "./cache";
import type { CurrencyConverter } from "./exchangeRates";
import { loadCurrencyConverter } from "./exchangeRates";
import { applySourceOutboxToList } from "./lookupsOutboxOverlay";
import { offlineDb } from "./db";
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

async function applyTxToSourceBalance(
  sources: Map<string, MutableSource>,
  tx: TransactionRecord,
  direction: 1 | -1,
  cv: CurrencyConverter,
): Promise<void> {
  const key = tx.source.trim().toLowerCase();
  let row = sources.get(key);
  if (!row) {
    const ccy = (tx.currency || "USD").toUpperCase();
    row = { source: tx.source.trim(), acc_type: "UNKNOWN", amount: 0, currency: ccy };
    sources.set(key, row);
  }
  const signed = signedAmountFromTxLike(tx.amount, tx.tx_type);
  const delta = (await cv.convert(signed, (tx.currency || "USD").toUpperCase(), row.currency)) * direction;
  row.amount = round2(row.amount + delta);
}

function deleteEchoToRecord(echo: unknown): TransactionRecord | undefined {
  if (!echo || typeof echo !== "object") {
    return undefined;
  }
  const o = echo as { kind?: string; record?: TransactionRecord };
  if (o.kind !== "transaction_delete" || !o.record) {
    return undefined;
  }
  const r = o.record;
  return { ...r, tags: [...(r.tags ?? [])] };
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

/** Coerce URL / JSON-parsed filter objects (Dexie keys may use numeric flags). */
export function coerceTxListFilterParams(raw: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null || v === "") {
      continue;
    }
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    }
  }
  return out;
}

function truthyApiFlag(v: string | undefined): boolean {
  if (v === undefined) {
    return false;
  }
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** Whether a transaction row belongs to the same period as snapshot / list API params. */
export function transactionRecordMatchesParams(
  r: TransactionRecord,
  params: Record<string, unknown> | Record<string, string | undefined>,
): boolean {
  const p = coerceTxListFilterParams(params as Record<string, unknown>);
  const txDate = (r.date || "").trim();

  if (truthyApiFlag(p.current_month)) {
    return inCurrentMonth(txDate);
  }
  if (truthyApiFlag(p.last_month)) {
    return inLastMonth(txDate);
  }
  if (truthyApiFlag(p.previous_week)) {
    return inPreviousWeek(txDate);
  }
  if (p.start_date && p.end_date) {
    return txDate >= p.start_date && txDate <= p.end_date;
  }
  if (p.date) {
    return txDate === p.date;
  }
  // No explicit period: server default is current calendar month, but queued `pending:*` rows
  // must still appear on dashboard / default list after reload.
  if (r.tx_id.startsWith("pending:")) {
    return true;
  }
  return inCurrentMonth(txDate);
}

function matchesDimensionFilters(
  r: TransactionRecord,
  params: Record<string, unknown> | Record<string, string | undefined>,
): boolean {
  const p = coerceTxListFilterParams(params as Record<string, unknown>);
  if (p.tx_type && String(p.tx_type) !== String(r.tx_type ?? "")) {
    return false;
  }
  if (p.category && String(p.category) !== String(r.category ?? "")) {
    return false;
  }
  if (p.source && String(p.source) !== String(r.source ?? "")) {
    return false;
  }
  if (p.currency_code) {
    const want = String(p.currency_code).trim().toUpperCase();
    const got = String(r.currency ?? "").trim().toUpperCase();
    if (want && got !== want) {
      return false;
    }
  }
  if (p.tag_name) {
    const want = String(p.tag_name);
    if (!(r.tags ?? []).some((t) => t === want)) {
      return false;
    }
  }
  return true;
}

/** Row is included in a transactions list response for these API-style filters. */
export function transactionMatchesTxListQuery(
  r: TransactionRecord,
  params: Record<string, unknown> | Record<string, string | undefined>,
): boolean {
  return transactionRecordMatchesParams(r, params) && matchesDimensionFilters(r, params);
}

/** Synthetic rows for queued POST /finance/transactions/ (matches outbox replay ids). */
export function buildPendingTransactionRecordsFromPostBody(body: unknown, idempotencyKey: string): TransactionRecord[] {
  const bodies = normalizeTransactionPostBody(body);
  const keyBase = `pending:${idempotencyKey}`;
  return bodies.map((req, idx) => {
    const txId = bodies.length === 1 ? keyBase : `${keyBase}:${idx}`;
    return createRequestToRecord(req, txId);
  });
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

export function sortLedgerTransactionsByDate(a: TransactionRecord, b: TransactionRecord): number {
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

/** Replay outbox onto tx map only (list reads). */
function applyOutboxToTxMapOnly(map: Map<string, TransactionRecord>, rows: OutboxRow[]): void {
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
      const prev = map.get(serverId);
      if (!prev) {
        continue;
      }
      map.set(serverId, mergePatch(prev, row.body as TransactionPatchRequest));
    }
  }
}

/** Replay outbox onto tx map and source balances (snapshot); uses stored FX rates. */
async function applyOutboxToTxMapAndSourcesAsync(
  map: Map<string, TransactionRecord>,
  sources: Map<string, MutableSource>,
  rows: OutboxRow[],
  cv: CurrencyConverter,
): Promise<void> {
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
      for (let idx = 0; idx < bodies.length; idx += 1) {
        const req = bodies[idx]!;
        const txId = bodies.length === 1 ? keyBase : `${keyBase}:${idx}`;
        const rec = createRequestToRecord(req, txId);
        await applyTxToSourceBalance(sources, rec, 1, cv);
        map.set(txId, rec);
      }
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
      const prev = map.get(serverId) ?? deleteEchoToRecord(row.echo);
      if (prev) {
        await applyTxToSourceBalance(sources, prev, -1, cv);
      }
      map.delete(serverId);
      continue;
    }

    if (method === "PATCH" && row.body && typeof row.body === "object") {
      const prev = map.get(serverId);
      if (!prev) {
        continue;
      }
      await applyTxToSourceBalance(sources, prev, -1, cv);
      const merged = mergePatch(prev, row.body as TransactionPatchRequest);
      await applyTxToSourceBalance(sources, merged, 1, cv);
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

async function buildFlowSeriesFromRows(
  rows: SnapshotTransactionRow[],
  baseCurrency: string,
  cv: CurrencyConverter,
): Promise<Array<{ label: string; incoming: number; outgoing: number; leaks: number }>> {
  const byDay = new Map<string, { incoming: number; outgoing: number; leaksRaw: number }>();
  for (const r of rows) {
    const day = (r.date || r.created_on || "").slice(0, 10);
    if (!day) {
      continue;
    }
    const signed = signedAmountFromTxLike(String(r.amount ?? ""), String(r.tx_type ?? ""));
    const inBase = await cv.toBase(signed, (r.currency || baseCurrency).toUpperCase(), baseCurrency);
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
  applyOutboxToTxMapOnly(map, rows);
  return map;
}

async function mergedTransactionMap(base: TransactionRecord[]): Promise<Map<string, TransactionRecord>> {
  const rows = await listOutboxOrdered();
  return mergedTransactionMapWithRows(base, rows);
}

const TXLIST_CACHE_PREFIX = "txlist:";

/**
 * Resolve a transaction row while offline or for queued `pending:*` ids by scanning
 * materialized `txlist:*` caches plus outbox replay (pending-only map when needed).
 */
export async function findTransactionRecordById(txId: string): Promise<TransactionRecord | undefined> {
  if (txId.startsWith("pending:")) {
    const map = mergedTransactionMapWithRows([], await listOutboxOrdered());
    const r = map.get(txId);
    return r ? { ...r, tags: [...(r.tags ?? [])] } : undefined;
  }
  const rows = await offlineDb.caches.toArray();
  for (const row of rows) {
    if (!row.id.startsWith(TXLIST_CACHE_PREFIX)) {
      continue;
    }
    if (!Array.isArray(row.payload)) {
      continue;
    }
    let rawFilters: Record<string, unknown>;
    try {
      rawFilters = JSON.parse(row.id.slice(TXLIST_CACHE_PREFIX.length)) as Record<string, unknown>;
    } catch {
      continue;
    }
    const merged = await applyTransactionOutboxToList(row.payload as TransactionRecord[], rawFilters);
    const hit = merged.find((t) => t.tx_id === txId);
    if (hit) {
      return { ...hit, tags: [...(hit.tags ?? [])] };
    }
  }
  return undefined;
}

/** Merge pending transaction outbox ops into a list response (FIFO). */
export async function applyTransactionOutboxToList(
  base: TransactionRecord[],
  filterRecord: Record<string, unknown>,
): Promise<TransactionRecord[]> {
  const map = await mergedTransactionMap(base);
  const out = [...map.values()].filter((r) => transactionMatchesTxListQuery(r, filterRecord));
  out.sort(sortLedgerTransactionsByDate);
  return out;
}

async function computeTotalsFromSnapshotRows(
  rows: SnapshotTransactionRow[],
  baseCurrency: string,
  cv: CurrencyConverter,
): Promise<
  Pick<
    SnapshotResponse,
    | "total_expenses_for_month"
    | "total_income_for_month"
    | "total_transfer_out_for_month"
    | "total_transfer_in_for_month"
    | "total_leaks_for_month"
  >
> {
  let te = 0;
  let ti = 0;
  let tto = 0;
  let tti = 0;
  let netXferBase = 0;
  for (const r of rows) {
    const signed = signedAmountFromTxLike(String(r.amount ?? ""), String(r.tx_type ?? ""));
    const inBase = await cv.toBase(signed, (r.currency || baseCurrency).toUpperCase(), baseCurrency);
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

async function totalAssetsFromSourceBalances(
  rows: Array<{ amount: string | number; currency: string }>,
  baseCurrency: string,
  cv: CurrencyConverter,
): Promise<number> {
  let sum = 0;
  for (const r of rows) {
    const amt = parseAmount(String(r.amount ?? "0"));
    const ccy = (r.currency || baseCurrency).toUpperCase();
    sum += await cv.toBase(amt, ccy, baseCurrency);
  }
  return round2(sum);
}

async function computeExpenseByCategory(
  rows: SnapshotTransactionRow[],
  baseCurrency: string,
  cv: CurrencyConverter,
): Promise<Array<{ name: string; value: number }>> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (String(r.tx_type || "").toUpperCase() !== "EXPENSE") {
      continue;
    }
    const name = String(r.category || "").trim() || "Uncategorized";
    const signed = signedAmountFromTxLike(String(r.amount ?? ""), "EXPENSE");
    const inBase = await cv.toBase(signed, (r.currency || baseCurrency).toUpperCase(), baseCurrency);
    const n = Math.abs(inBase);
    m.set(name, round2((m.get(name) ?? 0) + n));
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Merge pending transaction outbox into a cached or live snapshot (month-scoped list + derived totals). */
export async function applyTransactionOutboxToSnapshot(
  base: SnapshotResponse,
  params: Record<string, string>,
): Promise<SnapshotResponse> {
  const baseRecords = base.transactions_for_month.map(snapshotRowToRecord);
  const outboxRows = await listOutboxOrdered();
  const map = mergedTransactionMapWithRows(baseRecords, outboxRows);
  const mergedRows = [...map.values()].filter((r) => transactionMatchesTxListQuery(r, params));
  mergedRows.sort(sortLedgerTransactionsByDate);
  const snapRows = mergedRows.map(recordToSnapshotRow);

  const baseCurrency = await readProfileBaseCurrency();
  const cv = await loadCurrencyConverter();
  const [totals, expense_by_category, flow_series] = await Promise.all([
    computeTotalsFromSnapshotRows(snapRows, baseCurrency, cv),
    computeExpenseByCategory(snapRows, baseCurrency, cv),
    buildFlowSeriesFromRows(snapRows, baseCurrency, cv),
  ]);
  const daily_spend = flow_series.filter((p) => p.outgoing > 0).map((p) => ({ date: p.label, amount: p.outgoing }));
  const daily_income = flow_series.filter((p) => p.incoming > 0).map((p) => ({ date: p.label, amount: p.incoming }));

  const sourcesClone = cloneSourcesFromBase(base);
  const sourceReplayMap = new Map<string, TransactionRecord>();
  for (const r of base.transactions_for_month.map(snapshotRowToRecord)) {
    sourceReplayMap.set(r.tx_id, { ...r, tags: [...(r.tags ?? [])] });
  }
  await applyOutboxToTxMapAndSourcesAsync(sourceReplayMap, sourcesClone, outboxRows, cv);
  const sourceRowsForOverlay: SourceRow[] = [...sourcesClone.values()].map((s) => ({
    source: s.source,
    acc_type: s.acc_type,
    amount: s.amount.toFixed(2),
    currency: s.currency,
  }));
  const mergedSources = await applySourceOutboxToList(sourceRowsForOverlay);
  const source_balances = mergedSources.map((s) => ({
    source: s.source,
    acc_type: s.acc_type,
    amount: s.amount,
    currency: s.currency,
  }));

  let snapshot = base.snapshot;
  if (snapshot && typeof snapshot === "object") {
    const total_assets = await totalAssetsFromSourceBalances(source_balances, baseCurrency, cv);
    snapshot = { ...snapshot, total_assets };
  }

  return {
    ...base,
    transactions_for_month: snapRows,
    ...totals,
    expense_by_category,
    flow_series,
    daily_spend,
    daily_income,
    source_balances,
    snapshot,
  };
}
