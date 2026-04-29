import { refreshClient } from "./refreshClient";

export type CreateUserBody = {
  username: string;
  user_email: string;
  password: string;
};

export async function createUser(body: CreateUserBody): Promise<void> {
  await refreshClient.post("/finance/user/", body);
}
