import axios from "axios";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import type { LoginResponse } from "./types";

const API_BASE_URL = resolveApiBaseUrl();

/** No auth interceptors — used for `POST /api/token/refresh/` and login. */
export const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export async function postRefresh(refresh: string): Promise<LoginResponse> {
  const { data } = await refreshClient.post<LoginResponse>("/api/token/refresh/", { refresh });
  return data;
}
