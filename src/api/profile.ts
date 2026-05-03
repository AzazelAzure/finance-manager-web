import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import { api } from "./client";
import type { AppProfileResponse, AppProfileUpdateRequest, AppProfileUpdateResponse } from "./types";

const PROFILE_CACHE_ID = "appprofile:root";

function offlineFallbackProfile(): AppProfileResponse {
  return {
    spend_accounts: [],
    base_currency: "PHP",
    timezone: "Asia/Manila",
    start_of_week: 0,
  };
}

export async function getAppProfile(opts?: PwaReadBypassOpts): Promise<AppProfileResponse> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(PROFILE_CACHE_ID);
    if (raw && typeof raw === "object" && "base_currency" in raw) {
      return raw as AppProfileResponse;
    }
    return offlineFallbackProfile();
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
      return raw as AppProfileResponse;
    }
  }
  const { data } = await api.get<AppProfileResponse>("/finance/appprofile/");
  await writeCachePayload(PROFILE_CACHE_ID, data, Date.now());
  return data;
}

export async function updateAppProfile(payload: AppProfileUpdateRequest): Promise<AppProfileUpdateResponse> {
  const { data } = await api.patch<AppProfileUpdateResponse>("/finance/appprofile/", payload);
  return data;
}
