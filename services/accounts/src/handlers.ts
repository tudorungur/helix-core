import { eq } from "drizzle-orm";
import { z } from "zod";
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

const onboardingInput = z.object({ name: z.string().trim().min(1) });

// `users` has no row-creation trigger from Cognito — sign-up only creates the Cognito identity, not
// the Postgres `users` row (Section 3.1: `users.id` *is* the Cognito sub, but nothing inserts it
// there). `onConflictDoUpdate` makes this idempotent: safe to call again (e.g. a retried request)
// without a duplicate-key error, and keeps `name` in sync if it's ever re-submitted.
async function upsertUser(db: Db, userId: string, email: string, name: string) {
  await db
    .insert(users)
    .values({ id: userId, email, name })
    .onConflictDoUpdate({ target: users.id, set: { email, name } });
}

// Section 4.1, Proprietar path — Cognito sign-up only asks for a role + name (no legal-form/fiscal
// data, that's deferred to §4.3/§4.4); this is the "create accounts(name) + account_membership
// (role=OWNER)" step that was previously just a TODO in the mobile SignUpScreen. `name` doubles as
// the account's workspace label (defaults to the person's own name, renamable later, Section 3.1) —
// there's no separate "workspace name" question in the signup form.
export async function createAccount(db: Db, userId: string, email: string, body: unknown) {
  const { name } = onboardingInput.parse(body);
  await upsertUser(db, userId, email, name);

  const [account] = await db.insert(accounts).values({ name, createdBy: userId }).returning();
  await db.insert(accountMemberships).values({ accountId: account.id, userId, role: "OWNER" });

  return { id: account.id, name: account.name, role: "OWNER" as const };
}

// Section 4.1, Chiriaș path — just the `users` row; a tenant has no `account` at all until they
// link their first tenancy via an association code (§4.4, not built yet).
export async function upsertSelf(db: Db, userId: string, email: string, body: unknown) {
  const { name } = onboardingInput.parse(body);
  await upsertUser(db, userId, email, name);
  return { id: userId, name };
}
