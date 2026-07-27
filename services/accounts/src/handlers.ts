import { eq } from "drizzle-orm";
import { accountMemberships, accounts, users } from "@helix-core/domain";
import type { Db } from "@helix-core/domain";

// Section 3.2 step 4 — a user can have 0..N account_memberships; the mobile app's account/context
// switcher (Section 5.1) needs this list to resolve which `accountId` to scope every other
// account-scoped request to (Section 4.3's properties/units, etc. all live under
// /accounts/{accountId}/...). No pagination — realistically a handful of accounts per user.
export async function listMyAccounts(db: Db, userId: string) {
  return db
    .select({ id: accounts.id, name: accounts.name, role: accountMemberships.role })
    .from(accountMemberships)
    .innerJoin(accounts, eq(accounts.id, accountMemberships.accountId))
    .where(eq(accountMemberships.userId, userId));
}

// `users` has no row-creation trigger from Cognito — sign-up only creates the Cognito identity, not
// the Postgres `users` row (Section 3.1: `users.id` *is* the Cognito sub, but nothing inserts it
// there). `onConflictDoUpdate` makes this idempotent: safe to call again (e.g. a retried request)
// without a duplicate-key error.
async function upsertUser(db: Db, userId: string, email: string) {
  await db.insert(users).values({ id: userId, email }).onConflictDoUpdate({ target: users.id, set: { email } });
}

// Section 4.1, Proprietar path — Cognito sign-up only asks for a role, nothing else (no name, no
// legal-form/fiscal data — 2026-07-27: identity is collected per-legal_entity instead, Section
// 4.3/4.4, not at sign-up, since the same person can act through different identities in different
// contexts). This is the "create accounts(name) + account_membership(role=OWNER)" step that was
// previously just a TODO in the mobile SignUpScreen. The account's own `name` is just a
// workspace/display label with no fiscal meaning (Section 3.1) — defaults to a neutral placeholder,
// renamable later once there's a UI for that.
export async function createAccount(db: Db, userId: string, email: string) {
  await upsertUser(db, userId, email);

  const [account] = await db.insert(accounts).values({ name: "Contul meu", createdBy: userId }).returning();
  await db.insert(accountMemberships).values({ accountId: account.id, userId, role: "OWNER" });

  return { id: account.id, name: account.name, role: "OWNER" as const };
}

// Section 4.1, Chiriaș path — just the `users` row; a tenant has no `account` at all until they
// link their first tenancy via an association code (§4.4).
export async function upsertSelf(db: Db, userId: string, email: string) {
  await upsertUser(db, userId, email);
  return { id: userId };
}
