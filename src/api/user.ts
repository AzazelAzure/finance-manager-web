import { refreshClient } from "./refreshClient";
import { api } from "./client";
import type { UserEmailResponse } from "./types";

export type CreateUserBody = {
  username: string;
  user_email: string;
  password: string;
};

export async function createUser(body: CreateUserBody): Promise<void> {
  await refreshClient.post("/finance/user/", body);
}

export async function getCurrentUserEmail(): Promise<string> {
  const { data } = await api.get<UserEmailResponse>("/finance/user/");
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
