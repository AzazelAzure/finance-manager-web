import { api } from "./client";
import type { AppProfileResponse, AppProfileUpdateRequest, AppProfileUpdateResponse } from "./types";

export async function getAppProfile(): Promise<AppProfileResponse> {
  const { data } = await api.get<AppProfileResponse>("/finance/appprofile/");
  return data;
}

export async function updateAppProfile(payload: AppProfileUpdateRequest): Promise<AppProfileUpdateResponse> {
  const { data } = await api.patch<AppProfileUpdateResponse>("/finance/appprofile/", payload);
  return data;
}
