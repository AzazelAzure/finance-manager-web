import { api } from "./client";
import type { SnapshotResponse } from "./types";

export async function fetchAppSnapshot(params: Record<string, string> = {}): Promise<SnapshotResponse> {
  const { data } = await api.get<SnapshotResponse>("/finance/appprofile/snapshot/", {
    params,
  });
  return data;
}

/** @deprecated Use fetchAppSnapshot with URL-derived params */
export async function getSnapshotCurrentMonth(): Promise<SnapshotResponse> {
  return fetchAppSnapshot({ current_month: "1" });
}
