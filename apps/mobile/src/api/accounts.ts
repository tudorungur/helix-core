import { apiRequest } from "./client";

export type MyAccount = { id: string; name: string; role: "OWNER" | "COLLABORATOR" | "ACCOUNTANT_READONLY" };

export function getMyAccounts(): Promise<MyAccount[]> {
  return apiRequest<MyAccount[]>("/accounts");
}

// Section 4.1, Proprietar onboarding — creates accounts(name) + account_membership(role=OWNER) for
// the signed-in user (and upserts their users row). `name` is the person's own name, which also
// becomes the account's workspace label.
export function createAccount(name: string): Promise<MyAccount> {
  return apiRequest<MyAccount>("/accounts", { method: "POST", body: { name } });
}

// Section 4.1, Chiriaș onboarding — just upserts the users row, no account (tenants get one later,
// from linking their first tenancy via an association code, §4.4).
export function upsertSelf(name: string): Promise<{ id: string; name: string }> {
  return apiRequest<{ id: string; name: string }>("/users/me", { method: "POST", body: { name } });
}
