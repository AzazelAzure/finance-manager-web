import { api } from "./client";
import type { SnapshotResponse } from "./types";

export async function getSnapshotCurrentMonth(): Promise<SnapshotResponse> {
  const { data } = await api.get<SnapshotResponse>("/finance/appprofile/snapshot/", {
    params: { current_month: true },
  });
  return data;
}
