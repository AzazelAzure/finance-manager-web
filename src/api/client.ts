import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { CLIENT_BUILD } from "../lib/clientBuild";
import { queryClient } from "../lib/queryClient";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { clearSession, getEffectiveAccessTokenForSession, getRefreshToken, setSession } from "../state/auth";
import { postRefresh } from "./refreshClient";
import type { LoginResponse } from "./types";
import {
  dispatchClientBuildUnsupported,
  type ClientBuildUnsupportedDetail,
} from "../lib/clientBuildUpgradeEvents";

const API_BASE_URL = resolveApiBaseUrl();

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

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

api.interceptors.request.use((config) => {
  const token = getEffectiveAccessTokenForSession();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method ?? "get").toLowerCase();
  if (MUTATING_METHODS.has(method)) {
    config.headers = config.headers ?? {};
    config.headers["X-Client-Build"] = CLIENT_BUILD;
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
    if (err.response?.status === 409) {
      const data = err.response.data;
      if (
        data &&
        typeof data === "object" &&
        "code" in data &&
        (data as { code?: string }).code === "CLIENT_BUILD_UNSUPPORTED"
      ) {
        dispatchClientBuildUnsupported(data as ClientBuildUnsupportedDetail);
      }
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
