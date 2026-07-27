// Lambda handler for the tenancies bounded context (Section 6). Owner-side, account-scoped
// (Section 4.4 phase 1): create a tenancy on a unit, generating an association_code; list/edit/
// delete; C168 self-confirm. Tenant-side, user-scoped (Section 4.4 phase 2): claim a code, list
// "my tenancies" — these two have no accountId at all (a tenant has no account_membership), so they
// route BEFORE the accountId requirement below, not through it.
import { z } from "zod";
import { getDb } from "./db.js";
import { HttpError, getUserId, resolveAccountAccess } from "./auth.js";
import * as handlers from "./handlers.js";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";

function json(status: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  };
}

function parseBody(event: APIGatewayProxyEventV2WithJWTAuthorizer): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw);
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  try {
    const db = await getDb();
    const userId = getUserId(event);
    const params = event.pathParameters ?? {};

    switch (event.routeKey) {
      case "POST /tenancies/claim":
        return json(201, await handlers.claimTenancy(db, userId, parseBody(event)));
      case "GET /tenancies/mine":
        return json(200, await handlers.listMyTenancies(db, userId));
      case "GET /legal-entities/mine":
        return json(200, await handlers.listMyLegalEntities(db, userId));
      case "POST /legal-entities/mine":
        return json(201, await handlers.createMyLegalEntity(db, userId, parseBody(event)));
      case "PATCH /legal-entities/mine/{id}":
        return json(200, await handlers.updateMyLegalEntity(db, userId, params.id!, parseBody(event)));
      case "DELETE /legal-entities/mine/{id}":
        await handlers.deleteMyLegalEntity(db, userId, params.id!);
        return json(204, null);
    }

    const accountId = params.accountId;
    if (!accountId) throw new HttpError(400, "Missing accountId path parameter");

    const access = await resolveAccountAccess(db, userId, accountId);

    switch (event.routeKey) {
      case "GET /accounts/{accountId}/tenancies":
        return json(200, await handlers.listTenancies(db, access, accountId));
      case "POST /accounts/{accountId}/units/{unitId}/tenancies":
        return json(201, await handlers.createTenancy(db, access, accountId, params.unitId!, parseBody(event)));
      case "PATCH /accounts/{accountId}/tenancies/{id}":
        return json(200, await handlers.updateTenancy(db, access, accountId, params.id!, parseBody(event)));
      case "PATCH /accounts/{accountId}/tenancies/{id}/c168":
        return json(200, await handlers.confirmC168(db, access, accountId, params.id!));
      case "DELETE /accounts/{accountId}/tenancies/{id}":
        await handlers.deleteTenancy(db, access, accountId, params.id!);
        return json(204, null);

      default:
        return json(404, { message: `No route for ${event.routeKey}` });
    }
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { message: error.message });
    if (error instanceof z.ZodError) return json(400, { message: "Invalid request body", issues: error.issues });
    console.error(error);
    return json(500, { message: "Internal error" });
  }
}
