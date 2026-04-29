import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { queryClient } from "../lib/queryClient";
import { clearSession, getEffectiveAccessTokenForSession, getRefreshToken, setSession } from "../state/auth";
import { postRefresh } from "./refreshClient";
import type { LoginResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://api.thehivemanager.com";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

type ConfigWithRetry = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshChain: Promise<string | null> | null = null;

/** Avoid N× `clearSession` + `queryClient.clear()` when many requests fail 401 together. */
let postAuthFailureCleanup = false;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshChain) {
    refreshChain = (async () => {
      const refresh = getRefreshToken();
      if (!refresh) {
        return null;
      }
      try {
        const res: LoginResponse = await postRefresh(refresh);
        setSession({
          access: res.access,
          refresh: res.refresh ?? refresh,
        });
        return res.access;
      } catch {
        return null;
      } finally {
        refreshChain = null;
      }
    })();
  }
  return refreshChain;
}

api.interceptors.request.use((config) => {
  const token = getEffectiveAccessTokenForSession();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as ConfigWithRetry | undefined;
    if (!original) {
      return Promise.reject(err);
    }
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    if (original.url?.includes("/api/token/")) {
      return Promise.reject(err);
    }
    original._retry = true;
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    }
    if (!postAuthFailureCleanup) {
      postAuthFailureCleanup = true;
      clearSession();
      queryClient.clear();
      const path = window.location?.pathname ?? "";
      if (!path.startsWith("/login") && !path.startsWith("/signup") && path !== "/") {
        window.location.replace("/login");
      }
      queueMicrotask(() => {
        postAuthFailureCleanup = false;
      });
    }
    return Promise.reject(err);
  },
);

export type { LoginResponse, SnapshotResponse } from "./types";
