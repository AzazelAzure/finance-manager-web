import { refreshClient } from "./refreshClient";
import type { LoginResponse } from "./types";

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await refreshClient.post<LoginResponse>("/api/token/", { username, password });
  return data;
}
