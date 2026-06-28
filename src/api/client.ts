import axios, {
  AxiosHeaders,
  getAdapter,
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { CLIENT_BUILD } from "../lib/clientBuild";
import { isLikelyNetworkFailure, markApiReachable } from "../offline/connectivity";
import { isOutboxAllowlisted, resolveUrlPathForAllowlist } from "../offline/allowlist";
import {
  canRetroactivelyQueue,
  enqueueOfflineAxiosWrite,
  shouldQueueOfflineWrite,
} from "../offline/queueMutating";
import { requestPwaReadBypassAfterMutation } from "../offline/pwaReadBypass";
import { queryClient } from "../lib/queryClient";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { clearSession, getEffectiveAccessTokenForSession, getRefreshToken, setSession } from "../state/auth";
import { postRefresh } from "./refreshClient";
import { isOfflineQueued, type LoginResponse } from "./types";
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

const browserAdapter = getAdapter(axios.defaults.adapter);

api.defaults.adapter = async (config) => {
  if (shouldQueueOfflineWrite(config)) {
    const idempotency_key = await enqueueOfflineAxiosWrite(config);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("fm-offline-queued"));
      requestPwaReadBypassAfterMutation();
      void queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["transactions-calendar"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["transactions-viz"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["tags", "all"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["categories", "all"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["sources", "all"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["profile"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["app-profile"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["balance-history"], refetchType: "all" });
      void queryClient.invalidateQueries({ queryKey: ["goals"], refetchType: "all" });
    }
    const headers = new AxiosHeaders();
    return {
      data: { offline_queued: true, idempotency_key },
      status: 202,
      statusText: "Accepted",
      headers,
      config,
    };
  }
  return browserAdapter(config);
};

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

function randomIdempotencyKeyForOnlineWrite(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

api.interceptors.request.use(async (config) => {
  let token = getEffectiveAccessTokenForSession();
  if (!token) {
    const refresh = getRefreshToken();
    const url = String(config.url ?? "");
    if (refresh && !url.includes("/api/token/refresh")) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        token = refreshed;
      }
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method ?? "get").toLowerCase();
  if (MUTATING_METHODS.has(method)) {
    config.headers = config.headers ?? {};
    config.headers["X-Client-Build"] = CLIENT_BUILD;
    const path = resolveUrlPathForAllowlist(config);
    const m = method.toUpperCase();
    if (isOutboxAllowlisted(m, path) && !shouldQueueOfflineWrite(config)) {
      const headers = AxiosHeaders.from(config.headers);
      const existing = headers.get("Idempotency-Key") ?? headers.get("idempotency-key");
      if (!existing) {
        headers.set("Idempotency-Key", randomIdempotencyKeyForOnlineWrite());
        config.headers = headers;
      }
    }
  }
  return config;
});

function isOfflineQueuedResponse(r: AxiosResponse): boolean {
  return r.status === 202 && isOfflineQueued(r.data);
}

api.interceptors.response.use(
  (r) => {
    if (!isOfflineQueuedResponse(r)) {
      markApiReachable(true);
    }
    return r;
  },
  async (err: AxiosError) => {
    const isServerError = !!err.response || err.code === "ERR_BAD_REQUEST" || err.code === "ERR_BAD_RESPONSE" || ((err as any).status && (err as any).status >= 400);
    if (isLikelyNetworkFailure(err) && !isServerError) {
      markApiReachable(false);

      // Retroactively queue allowlisted writes that failed due to network error.
      // This closes the gap where the first write after connectivity loss was
      // always lost because shouldTreatAsDisconnectedForMutations() had not yet
      // detected the outage.
      const failedConfig = err.config as ConfigWithRetry | undefined;
      if (failedConfig && canRetroactivelyQueue(failedConfig)) {
        const idempotency_key = await enqueueOfflineAxiosWrite(failedConfig);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("fm-offline-queued"));
          requestPwaReadBypassAfterMutation();
          void queryClient.invalidateQueries({ queryKey: ["snapshot"], refetchType: "all" });
          void queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "all" });
          void queryClient.invalidateQueries({ queryKey: ["transactions-calendar"], refetchType: "all" });
          void queryClient.invalidateQueries({ queryKey: ["transactions-viz"], refetchType: "all" });
          void queryClient.invalidateQueries({ queryKey: ["tags", "all"], refetchType: "all" });
          void queryClient.invalidateQueries({ queryKey: ["categories", "all"], refetchType: "all" });
          void queryClient.invalidateQueries({ queryKey: ["sources", "all"], refetchType: "all" });
          void queryClient.invalidateQueries({ queryKey: ["upcoming-expenses"], refetchType: "all" });
          void queryClient.invalidateQueries({ queryKey: ["profile"], refetchType: "all" });
          void queryClient.invalidateQueries({ queryKey: ["app-profile"], refetchType: "all" });
        }
        const headers = new AxiosHeaders();
        return {
          data: { offline_queued: true, idempotency_key },
          status: 202,
          statusText: "Accepted",
          headers,
          config: failedConfig,
        };
      }
    }
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
