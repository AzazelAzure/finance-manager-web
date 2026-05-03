import type { OutboxRow } from "./db";
import { offlineDb } from "./db";

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
}): Promise<string> {
  const idempotencyKey = randomIdempotencyKey();
  await offlineDb.outbox.add({
    method: input.method.toUpperCase(),
    url: input.url,
    body: input.body,
    idempotencyKey,
    createdAt: Date.now(),
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
