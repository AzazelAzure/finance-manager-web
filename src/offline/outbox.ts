import type { TransactionCreateRequest, TransactionPatchRequest } from "../api/types";
import type { OutboxRow } from "./db";
import { offlineDb } from "./db";
import { emitSyncState } from "./syncEvents";

const TX_LIST_PATH = /^\/finance\/transactions\/?$/;

export type SyncFailureKind = "action_required" | "retryable";

export type OutboxSyncFailure = {
  kind: SyncFailureKind;
  status?: number;
  detail: string;
  failedAt: number;
  pendingTxId?: string;
};

function normPathForOutbox(url: string): string {
  const p = url.split("?")[0];
  return p.endsWith("/") || p.length === 0 ? p : `${p}/`;
}

export function parseOutboxBody(body: unknown): unknown {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}


function randomIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function enqueueOutboxEntry(input: {
  method: string;
  url: string;
  body: unknown;
  echo?: unknown;
}): Promise<string> {
  const idempotencyKey = randomIdempotencyKey();
  await offlineDb.outbox.add({
    method: input.method.toUpperCase(),
    url: input.url,
    body: input.body,
    idempotencyKey,
    createdAt: Date.now(),
    ...(input.echo !== undefined ? { echo: input.echo } : {}),
  });
  return idempotencyKey;
}

export async function listOutboxOrdered(): Promise<OutboxRow[]> {
  return offlineDb.outbox.orderBy("id").toArray();
}

export async function removeOutboxEntry(id: number): Promise<void> {
  await offlineDb.outbox.delete(id);
}

export async function clearOutbox(): Promise<void> {
  await offlineDb.outbox.clear();
}

export async function outboxDepth(): Promise<number> {
  return offlineDb.outbox.count();
}

/** Render API error bodies as plain text for sync status and repair UI. */
export function parseApiDetailAsText(data: unknown, status?: number): string {
  if (Array.isArray(data)) {
    const message = data
      .map((item, idx) => {
        if (item && typeof item === "object") {
          return Object.entries(item as Record<string, unknown>)
            .map(([k, v]) => {
              if (Array.isArray(v)) {
                return `${k}: ${v.map((x) => String(x)).join(", ")}`;
              }
              return `${k}: ${String(v)}`;
            })
            .join(" | ");
        }
        return `${idx}: ${String(item)}`;
      })
      .filter((part) => Boolean(part))
      .join(" || ");
    if (message) {
      return status ? `HTTP ${status}: ${message}` : message;
    }
  }
  if (data && typeof data === "object") {
    const message = Object.entries(data as Record<string, unknown>)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          return `${k}: ${v.map((x) => String(x)).join(", ")}`;
        }
        return `${k}: ${String(v)}`;
      })
      .join(" | ");
    if (message) {
      return status ? `HTTP ${status}: ${message}` : message;
    }
  }
  if (typeof data === "string" && data.trim()) {
    return status ? `HTTP ${status}: ${data}` : data;
  }
  if (status) {
    return `HTTP ${status}: Request rejected by API.`;
  }
  return "Request rejected by API.";
}

export function classifyOutboxFailure(status: number | undefined, isNetworkError: boolean): SyncFailureKind {
  if (isNetworkError || status === undefined || status >= 500) {
    return "retryable";
  }
  if (status >= 400 && status < 500) {
    return "action_required";
  }
  return "retryable";
}

export function isTransactionPostOutboxRow(row: OutboxRow): boolean {
  return row.method.toUpperCase() === "POST" && TX_LIST_PATH.test(normPathForOutbox(row.url));
}

export function pendingTxIdForOutboxRow(row: OutboxRow, bodyIndex = 0): string | undefined {
  if (!isTransactionPostOutboxRow(row)) {
    return undefined;
  }
  const body = parseOutboxBody(row.body);
  const bodies = Array.isArray(body)
    ? body.filter((b) => Boolean(b) && typeof b === "object")
    : body && typeof body === "object"
      ? [body]
      : [];
  if (bodies.length === 0) {
    return undefined;
  }
  const keyBase = `pending:${row.idempotencyKey}`;
  return bodies.length === 1 ? keyBase : `${keyBase}:${bodyIndex}`;
}

function readEchoObject(echo: unknown): Record<string, unknown> {
  if (echo && typeof echo === "object" && !Array.isArray(echo)) {
    return { ...(echo as Record<string, unknown>) };
  }
  return {};
}

export function getOutboxSyncFailure(echo: unknown): OutboxSyncFailure | undefined {
  const sf = readEchoObject(echo).syncFailure;
  if (!sf || typeof sf !== "object") {
    return undefined;
  }
  const candidate = sf as OutboxSyncFailure;
  if (candidate.kind !== "action_required" && candidate.kind !== "retryable") {
    return undefined;
  }
  if (typeof candidate.detail !== "string") {
    return undefined;
  }
  return candidate;
}

export function mergeEchoWithSyncFailure(echo: unknown, syncFailure: OutboxSyncFailure): Record<string, unknown> {
  return { ...readEchoObject(echo), syncFailure };
}

export async function persistOutboxSyncFailure(
  rowId: number,
  echo: unknown,
  syncFailure: OutboxSyncFailure,
): Promise<void> {
  await offlineDb.outbox.update(rowId, { echo: mergeEchoWithSyncFailure(echo, syncFailure) });
}

export async function clearOutboxSyncFailure(rowId: number): Promise<void> {
  const row = await offlineDb.outbox.get(rowId);
  if (!row) {
    return;
  }
  const next = readEchoObject(row.echo);
  delete next.syncFailure;
  await offlineDb.outbox.update(rowId, { echo: Object.keys(next).length > 0 ? next : undefined });
}

export async function findFirstActionRequiredTransactionFailure(): Promise<{
  row: OutboxRow;
  pendingTxId: string;
  syncFailure: OutboxSyncFailure;
} | null> {
  const rows = await listOutboxOrdered();
  for (const row of rows) {
    const syncFailure = getOutboxSyncFailure(row.echo);
    if (
      syncFailure?.kind === "action_required" &&
      syncFailure.pendingTxId &&
      isTransactionPostOutboxRow(row)
    ) {
      return { row, pendingTxId: syncFailure.pendingTxId, syncFailure };
    }
  }
  return null;
}

/** Re-emit sync UI state from persisted outbox failure metadata (e.g. after reload or reachability). */
export async function emitSyncStateForOutboxFailures(): Promise<boolean> {
  const repair = await findFirstActionRequiredTransactionFailure();
  if (repair) {
    emitSyncState({
      phase: "action_required",
      detail: repair.syncFailure.detail,
      pendingTxId: repair.pendingTxId,
    });
    return true;
  }
  const rows = await listOutboxOrdered();
  for (const row of rows) {
    const syncFailure = getOutboxSyncFailure(row.echo);
    if (!syncFailure) {
      continue;
    }
    emitSyncState({
      phase: "error",
      detail: syncFailure.detail,
      retryable: syncFailure.kind === "retryable",
    });
    return true;
  }
  return false;
}

/** Parse `pending:<idempotencyKey>` or `pending:<idempotencyKey>:<index>` (multi-body POST). */
export function parsePendingTransactionIdentity(txId: string): { idempotencyKey: string; bodyIndex: number } | null {
  if (!txId.startsWith("pending:")) {
    return null;
  }
  const rest = txId.slice("pending:".length);
  const m = rest.match(/^(.*):(\d+)$/);
  if (m) {
    return { idempotencyKey: m[1]!, bodyIndex: Number(m[2]) };
  }
  return { idempotencyKey: rest, bodyIndex: 0 };
}

function mergeCreateBodyWithPatch(
  body: TransactionCreateRequest,
  patch: TransactionPatchRequest,
): TransactionCreateRequest {
  return {
    ...body,
    date: patch.date ?? body.date,
    amount: patch.amount != null ? String(patch.amount) : body.amount,
    source: patch.source ?? body.source,
    currency: patch.currency ?? body.currency,
    tx_type: (patch.tx_type ?? body.tx_type) as TransactionCreateRequest["tx_type"],
    category: patch.category ?? body.category,
    description: patch.description ?? body.description,
    bill: patch.bill ?? body.bill,
    tags: patch.tags ?? body.tags,
    auto_deducted: patch.auto_deducted ?? body.auto_deducted,
  };
}

/**
 * Update the queued POST /finance/transactions/ body for a synthetic `pending:*` tx id
 * (Dexie outbox row update).
 */
export async function updateQueuedTransactionPostBody(
  txId: string,
  patch: TransactionPatchRequest,
): Promise<boolean> {
  const ident = parsePendingTransactionIdentity(txId);
  if (!ident) {
    return false;
  }
  const rows = await offlineDb.outbox.orderBy("id").toArray();
  const row = rows.find(
    (r) =>
      r.idempotencyKey === ident.idempotencyKey &&
      r.method.toUpperCase() === "POST" &&
      TX_LIST_PATH.test(normPathForOutbox(r.url)),
  );
  if (row?.id === undefined) {
    return false;
  }
  const bi = ident.bodyIndex;
  const body = parseOutboxBody(row.body);
  if (Array.isArray(body)) {
    if (bi < 0 || bi >= body.length) {
      return false;
    }
    const cur = body[bi];
    if (!cur || typeof cur !== "object") {
      return false;
    }
    const next = [...body];
    next[bi] = mergeCreateBodyWithPatch(cur as TransactionCreateRequest, patch);
    await offlineDb.outbox.update(row.id, { body: next });
    await clearOutboxSyncFailure(row.id);
    return true;
  }
  if (body && typeof body === "object") {
    await offlineDb.outbox.update(row.id, {
      body: mergeCreateBodyWithPatch(body as TransactionCreateRequest, patch),
    });
    await clearOutboxSyncFailure(row.id);
    return true;
  }
  return false;
}

/**
 * Delete the queued POST /finance/transactions/ body for a synthetic `pending:*` tx id
 * (Dexie outbox row update or deletion).
 */
export async function deleteQueuedTransactionPost(txId: string): Promise<boolean> {
  const ident = parsePendingTransactionIdentity(txId);
  if (!ident) {
    return false;
  }
  const rows = await offlineDb.outbox.orderBy("id").toArray();
  const row = rows.find(
    (r) =>
      r.idempotencyKey === ident.idempotencyKey &&
      r.method.toUpperCase() === "POST" &&
      TX_LIST_PATH.test(normPathForOutbox(r.url)),
  );
  if (row?.id === undefined) {
    return false;
  }
  const bi = ident.bodyIndex;
  const body = parseOutboxBody(row.body);
  if (Array.isArray(body)) {
    if (bi < 0 || bi >= body.length) {
      return false;
    }
    const next = [...body];
    next.splice(bi, 1);
    if (next.length === 0) {
      await offlineDb.outbox.delete(row.id);
    } else {
      await offlineDb.outbox.update(row.id, { body: JSON.stringify(next) });
    }
    return true;
  }
  if (body && typeof body === "object") {
    // Single item payload. Deleting it means the whole POST should be aborted.
    await offlineDb.outbox.delete(row.id);
    return true;
  }
  return false;
}
