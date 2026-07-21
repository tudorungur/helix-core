import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export type Db = ReturnType<typeof createDb>;

// Shared by every Lambda (Section 6/7.2) — connects through RDS Proxy (never directly to Aurora),
// using the master user credentials from Secrets Manager (RDS Proxy's own auth_scheme = "SECRETS",
// infra/modules/database). Each service resolves those credentials itself (cold-start, cached across
// warm invocations) and passes a plain connection string in here.
export function createDb(connectionString: string) {
  // RDS Proxy rejects unencrypted connections outright ("no pg_hba.conf entry ... no encryption").
  // "require" encrypts without verifying the CA chain — good enough here since the connection never
  // leaves AWS's own network (Lambda → RDS Proxy, both inside the VPC); skips having to ship the RDS
  // CA bundle into the Lambda package for "verify-full".
  const client = postgres(connectionString, { max: 1, ssl: "require" });
  return drizzle(client, { schema });
}
