import { preferOfflineCaches } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
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

export async function getAppProfile(): Promise<AppProfileResponse> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(PROFILE_CACHE_ID);
    if (raw && typeof raw === "object" && "base_currency" in raw) {
      return raw as AppProfileResponse;
    }
    return offlineFallbackProfile();
  }
  const { data } = await api.get<AppProfileResponse>("/finance/appprofile/");
  await writeCachePayload(PROFILE_CACHE_ID, data, Date.now());
  return data;
}

export async function updateAppProfile(payload: AppProfileUpdateRequest): Promise<AppProfileUpdateResponse> {
  const { data } = await api.patch<AppProfileUpdateResponse>("/finance/appprofile/", payload);
  return data;
}
