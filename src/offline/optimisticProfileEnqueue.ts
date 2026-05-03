import { PROFILE_CACHE_ID } from "../api/profile";
import type { AppProfileResponse } from "../api/types";
import { offlineDb, type OutboxRow } from "./db";
import { listOutboxOrdered } from "./outbox";
import { mergeProfileOutboxFifo } from "./profileOutboxOverlay";

function defaultProfileBase(): AppProfileResponse {
  return {
    spend_accounts: [],
    base_currency: "USD",
    timezone: "UTC",
    start_of_week: 0,
  };
}

/** Pure merge for tests and Dexie write path: FIFO profile PATCH rows onto cached (or default) profile. */
export function computeProfileCachePayloadAfterOutbox(
  existingPayload: unknown,
  outboxRows: OutboxRow[],
): AppProfileResponse {
  const base =
    existingPayload &&
    typeof existingPayload === "object" &&
    "base_currency" in (existingPayload as object)
      ? { ...(existingPayload as AppProfileResponse) }
      : defaultProfileBase();
  return mergeProfileOutboxFifo(base, outboxRows);
}

/** After enqueueing PATCH /finance/appprofile/, refresh Dexie so cold-offline reads match the outbox. */
export async function mergeProfileDexieAfterOutboxEnqueue(): Promise<void> {
  const row = await offlineDb.caches.get(PROFILE_CACHE_ID);
  const rows = await listOutboxOrdered();
  const merged = computeProfileCachePayloadAfterOutbox(row?.payload, rows);
  await offlineDb.caches.put({
    id: PROFILE_CACHE_ID,
    payload: merged,
    fetchedAt: row?.fetchedAt ?? Date.now(),
  });
}
