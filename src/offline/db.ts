import Dexie, { type Table } from "dexie";

export const OFFLINE_DB_VERSION = 1;

export type OutboxRow = {
  id?: number;
  method: string;
  url: string;
  body: unknown;
  idempotencyKey: string;
  createdAt: number;
};

export type CacheRow = {
  id: string;
  payload: unknown;
  fetchedAt: number;
};

class FinanceOfflineDB extends Dexie {
  outbox!: Table<OutboxRow, number>;
  caches!: Table<CacheRow, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("finance_manager_offline");
    this.version(OFFLINE_DB_VERSION).stores({
      outbox: "++id, createdAt",
      caches: "id, fetchedAt",
      meta: "key",
    });
  }
}

export const offlineDb = new FinanceOfflineDB();
