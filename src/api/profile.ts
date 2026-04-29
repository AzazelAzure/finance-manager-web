import { api } from "./client";
import type { AppProfileResponse } from "./types";

export async function getAppProfile(): Promise<AppProfileResponse> {
  const { data } = await api.get<AppProfileResponse>("/finance/appprofile/");
  return data;
}
