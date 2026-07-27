// Lambda handler for the accounts bounded context (Section 6) — "list the accounts I'm a member
// of" (Section 3.2 step 4, the piece the mobile app needs to resolve an `accountId` before calling
// any of services/properties' account-scoped routes) plus Section 4.1's onboarding step (create the
// `users` row + Proprietar's `accounts`/`account_membership`, previously just a TODO in the mobile
// SignUpScreen). Neither onboarding route takes a body anymore (2026-07-27 — SignUp no longer asks
// for a name; identity is collected per-legal_entity instead, Section 4.3/4.4).
import { getDb } from "./db.js";
import { createAccount, listMyAccounts, upsertSelf } from "./handlers.js";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";

function json(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  };
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  try {
    const claims = event.requestContext.authorizer.jwt.claims;
    const sub = claims.sub;
    if (typeof sub !== "string") return json(401, { message: "Missing sub claim on the verified JWT" });
    const email = claims.email;
    if (typeof email !== "string") return json(401, { message: "Missing email claim on the verified JWT" });

    const db = await getDb();

    switch (event.routeKey) {
      case "GET /accounts":
        return json(200, await listMyAccounts(db, sub));
      case "POST /accounts":
        return json(201, await createAccount(db, sub, email));
      case "POST /users/me":
        return json(200, await upsertSelf(db, sub, email));
      default:
        return json(404, { message: `No route for ${event.routeKey}` });
    }
  } catch (error) {
    console.error(error);
    return json(500, { message: "Internal error" });
  }
}
