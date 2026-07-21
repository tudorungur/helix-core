import { and, eq } from "drizzle-orm";
import { accountMembershipScopes, accountMemberships } from "@helix-core/domain";
import type { Db } from "@helix-core/domain";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

// Section 3.2, step 1 — Cognito JWT → user_id. `users.id` *is* the Cognito sub (Section 3.1), so no
// extra lookup is needed to turn a verified claim into our own primary key.
export function getUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const sub = event.requestContext.authorizer.jwt.claims.sub;
  if (typeof sub !== "string") {
    throw new HttpError(401, "Missing sub claim on the verified JWT");
  }
  return sub;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type AccountAccess =
  | { role: "OWNER" }
  | { role: "COLLABORATOR" | "ACCOUNTANT_READONLY"; propertyIds: Set<string>; unitIds: Set<string> };

// Section 3.2, steps 2-3 — loads this user's membership (+ scopes) on the given account. OWNER has
// full implicit access; COLLABORATOR/ACCOUNTANT_READONLY only see what's explicitly scoped to them
// (no scope rows at all means no access, not "full access by default").
export async function resolveAccountAccess(db: Db, userId: string, accountId: string): Promise<AccountAccess | null> {
  const [membership] = await db
    .select()
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.accountId, accountId)))
    .limit(1);
  if (!membership) return null;

  if (membership.role === "OWNER") return { role: "OWNER" };

  const scopes = await db
    .select()
    .from(accountMembershipScopes)
    .where(eq(accountMembershipScopes.membershipId, membership.id));
  return {
    role: membership.role,
    propertyIds: new Set(scopes.map((scope) => scope.propertyId).filter((id): id is string => id !== null)),
    unitIds: new Set(scopes.map((scope) => scope.unitId).filter((id): id is string => id !== null)),
  };
}

export function canWriteUnit(access: AccountAccess | null, propertyId: string, unitId: string): boolean {
  if (!access) return false;
  if (access.role === "OWNER") return true;
  return access.role === "COLLABORATOR" && (access.propertyIds.has(propertyId) || access.unitIds.has(unitId));
}
