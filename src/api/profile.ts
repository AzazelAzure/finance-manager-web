import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import { applyProfileOutboxToProfile } from "../offline/profileOutboxOverlay";
import { api } from "./client";
import {
  isOfflineQueued,
  type AppProfileResponse,
  type AppProfileUpdateRequest,
  type AppProfileUpdateResponse,
  type OfflineQueuedResult,
} from "./types";

/** Dexie `caches` row id for the app profile payload (offline merge + cold read). */
export const PROFILE_CACHE_ID = "appprofile:root";

function offlineFallbackProfile(): AppProfileResponse {
  return {
    spend_accounts: [],
    base_currency: "PHP",
    timezone: "Asia/Manila",
    start_of_week: 0,
    sts_window_mode: "calendar_month",
    pay_cycle_frequency: null,
    pay_cycle_anchor_date: null,
  };
}

export async function getAppProfile(opts?: PwaReadBypassOpts): Promise<AppProfileResponse> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(PROFILE_CACHE_ID);
    if (raw && typeof raw === "object" && "base_currency" in raw) {
      return applyProfileOutboxToProfile(raw as AppProfileResponse);
    }
    return applyProfileOutboxToProfile(offlineFallbackProfile());
  }
  if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(PROFILE_CACHE_ID);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (raw && typeof raw === "object" && "base_currency" in raw) {
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(PROFILE_CACHE_ID, async () => {
          const { data } = await api.get<AppProfileResponse>("/finance/appprofile/");
          await writeCachePayload(PROFILE_CACHE_ID, data, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["app-profile"], refetchType: "all" });
        });
      }
      return applyProfileOutboxToProfile(raw as AppProfileResponse);
    }
  }
  const { data } = await api.get<AppProfileResponse>("/finance/appprofile/");
  await writeCachePayload(PROFILE_CACHE_ID, data, Date.now());
  return applyProfileOutboxToProfile(data);
}

export async function updateAppProfile(
  payload: AppProfileUpdateRequest,
): Promise<AppProfileUpdateResponse | OfflineQueuedResult> {
  const res = await api.patch<AppProfileUpdateResponse | OfflineQueuedResult>("/finance/appprofile/", payload);
  if (res.status === 202 && isOfflineQueued(res.data)) {
    return res.data;
  }
  return res.data as AppProfileUpdateResponse;
}
