// Lambda handler for the properties bounded context (Section 6) — legal entities, properties, and
// units (Section 4.3). One function, several routes (API Gateway HTTP API + Lambda proxy
// integration), matching the "one function per bounded context" architecture (Section 6's diagram).
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
      case "GET /accounts/{accountId}/legal-entities":
        return json(200, await handlers.listLegalEntities(db, access, accountId));
      case "POST /accounts/{accountId}/legal-entities":
        return json(201, await handlers.createLegalEntity(db, access, accountId, parseBody(event)));
      case "PATCH /accounts/{accountId}/legal-entities/{id}":
        return json(200, await handlers.updateLegalEntity(db, access, accountId, params.id!, parseBody(event)));
      case "DELETE /accounts/{accountId}/legal-entities/{id}":
        await handlers.deleteLegalEntity(db, access, accountId, params.id!);
        return json(204, null);

      case "GET /accounts/{accountId}/properties":
        return json(200, await handlers.listProperties(db, access, accountId));
      case "POST /accounts/{accountId}/properties":
        return json(201, await handlers.createProperty(db, access, accountId, parseBody(event)));
      case "PATCH /accounts/{accountId}/properties/{id}":
        return json(200, await handlers.updateProperty(db, access, accountId, params.id!, parseBody(event)));
      case "DELETE /accounts/{accountId}/properties/{id}":
        await handlers.deleteProperty(db, access, accountId, params.id!);
        return json(204, null);

      case "GET /accounts/{accountId}/units":
        return json(200, await handlers.listUnits(db, access, accountId));
      case "POST /accounts/{accountId}/properties/{propertyId}/units":
        return json(
          201,
          await handlers.createUnit(db, access, accountId, params.propertyId!, parseBody(event)),
        );
      case "PATCH /accounts/{accountId}/properties/{propertyId}/units/{id}":
        return json(
          200,
          await handlers.updateUnit(db, access, accountId, params.propertyId!, params.id!, parseBody(event)),
        );
      case "DELETE /accounts/{accountId}/properties/{propertyId}/units/{id}":
        await handlers.deleteUnit(db, access, accountId, params.propertyId!, params.id!);
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
