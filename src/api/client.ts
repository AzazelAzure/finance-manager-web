import axios from "axios";
import { getToken } from "../state/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://api.thehivemanager.com";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type LoginResponse = {
  access: string;
  refresh: string;
};

export type SnapshotResponse = {
  flow_series: Array<{ label: string; incoming: number; outgoing: number; leaks: number }>;
  expense_by_category: Array<{ name: string; value: number }>;
  source_balances: Array<{ source: string; acc_type: string; amount: string; currency: string }>;
  daily_spend: Array<{ date: string; amount: number }>;
  daily_income: Array<{ date: string; amount: number }>;
  total_expenses_for_month: number;
  total_income_for_month: number;
  total_transfer_out_for_month: number;
  total_transfer_in_for_month: number;
  total_leaks_for_month: number;
  snapshot: {
    total_assets?: number;
    safe_to_spend?: number;
    total_remaining_expenses?: number;
    [key: string]: number | string | undefined;
  };
};

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/api/token/", { username, password });
  return data;
}

export async function getSnapshotCurrentMonth(): Promise<SnapshotResponse> {
  const { data } = await api.get<SnapshotResponse>("/finance/appprofile/snapshot/", {
    params: { current_month: true },
  });
  return data;
}
