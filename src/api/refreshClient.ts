import axios from "axios";
import type { LoginResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://api.thehivemanager.com";

/** No auth interceptors — used for `POST /api/token/refresh/` and login. */
export const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export async function postRefresh(refresh: string): Promise<LoginResponse> {
  const { data } = await refreshClient.post<LoginResponse>("/api/token/refresh/", { refresh });
  return data;
}
