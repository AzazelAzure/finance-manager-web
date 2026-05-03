import { refreshClient } from "./refreshClient";
import { preferOfflineCaches, preferPwaLocalFirstReads } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
import { offlineDb } from "../offline/db";
import { isPwaBackgroundStale, schedulePwaBackgroundWork } from "../offline/pwaLocalFirstBg";
import { shouldBypassPwaDataCache, type PwaReadBypassOpts } from "../offline/pwaReadBypass";
import { api } from "./client";
import type { UserEmailResponse } from "./types";

const USER_EMAIL_CACHE_ID = "user:email";

export type CreateUserBody = {
  username: string;
  user_email: string;
  password: string;
};

export async function createUser(body: CreateUserBody): Promise<void> {
  await refreshClient.post("/finance/user/", body);
}

export async function getCurrentUserEmail(opts?: PwaReadBypassOpts): Promise<string> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(USER_EMAIL_CACHE_ID);
    if (raw && typeof raw === "object" && "email" in raw) {
      return String((raw as UserEmailResponse).email ?? "");
    }
    return "";
  }
  if (preferPwaLocalFirstReads() && !shouldBypassPwaDataCache(opts)) {
    const row = await offlineDb.caches.get(USER_EMAIL_CACHE_ID);
    const raw = row?.payload;
    const fetchedAt = row?.fetchedAt ?? 0;
    if (raw && typeof raw === "object" && "email" in raw) {
      if (isPwaBackgroundStale(fetchedAt)) {
        schedulePwaBackgroundWork(USER_EMAIL_CACHE_ID, async () => {
          const { data } = await api.get<UserEmailResponse>("/finance/user/");
          await writeCachePayload(USER_EMAIL_CACHE_ID, data, Date.now());
          const { queryClient } = await import("../lib/queryClient");
          await queryClient.invalidateQueries({ queryKey: ["profile", "email"], refetchType: "all" });
        });
      }
      return String((raw as UserEmailResponse).email ?? "");
    }
  }
  const { data } = await api.get<UserEmailResponse>("/finance/user/");
  void writeCachePayload(USER_EMAIL_CACHE_ID, data, Date.now()).catch(() => undefined);
  return data.email ?? "";
}

export async function patchCurrentUserPassword(oldPassword: string, newPassword: string): Promise<void> {
  await api.patch("/finance/user/", {
    old_password: oldPassword,
    new_password: newPassword,
  });
}

export async function deleteCurrentUser(password: string): Promise<void> {
  await api.delete("/finance/user/", {
    data: { password },
  });
}
