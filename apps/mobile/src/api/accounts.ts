import { apiRequest } from "./client";

export type MyAccount = { id: string; name: string; role: "OWNER" | "COLLABORATOR" | "ACCOUNTANT_READONLY" };

export function getMyAccounts(): Promise<MyAccount[]> {
  return apiRequest<MyAccount[]>("/accounts");
}

// Section 4.1, Proprietar onboarding — creates accounts(name) + account_membership(role=OWNER) for
// the signed-in user (and upserts their users row). No body (2026-07-27) — the account's own `name`
// is just a workspace label with no fiscal meaning, defaulted server-side; personal/business
// identity is collected per-legal_entity instead (Section 4.3/4.4).
export function createAccount(): Promise<MyAccount> {
  return apiRequest<MyAccount>("/accounts", { method: "POST" });
}

// Section 4.1, Chiriaș onboarding — just upserts the users row, no account (tenants get one later,
// from linking their first tenancy via an association code, §4.4).
export function upsertSelf(): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/users/me", { method: "POST" });
}
