import { refreshClient } from "./refreshClient";
import { preferOfflineCaches } from "../offline/connectivity";
import { readCachePayload, writeCachePayload } from "../offline/cache";
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

export async function getCurrentUserEmail(): Promise<string> {
  if (preferOfflineCaches()) {
    const raw = await readCachePayload(USER_EMAIL_CACHE_ID);
    if (raw && typeof raw === "object" && "email" in raw) {
      return String((raw as UserEmailResponse).email ?? "");
    }
    return "";
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
