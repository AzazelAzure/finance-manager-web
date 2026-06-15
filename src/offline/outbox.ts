import type { TransactionCreateRequest, TransactionPatchRequest } from "../api/types";
import type { OutboxRow } from "./db";
import { offlineDb } from "./db";

const TX_LIST_PATH = /^\/finance\/transactions\/?$/;

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
    return true;
  }
  if (body && typeof body === "object") {
    await offlineDb.outbox.update(row.id, {
      body: mergeCreateBodyWithPatch(body as TransactionCreateRequest, patch),
    });
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
