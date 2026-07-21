// Lambda handler for the tenancies bounded context (Section 6). Phase 1 (Section 4.4): owner
// creates a tenancy on one of their units, generating an association_code; listing/edit/delete.
// The tenant-side "claim the code" step (bilateral fiscal collection, tenancy_membership) is phase
// 2, not built here — see project_helix_core_backend_services memory for the phasing decision.
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
