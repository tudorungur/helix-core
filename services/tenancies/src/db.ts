import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { createDb } from "@helix-core/domain";
import type { Db } from "@helix-core/domain";

// Same cold-start-once pattern as services/properties/src/db.ts — see
// project_helix_core_backend_services memory for the reasoning (RDS Proxy, Secrets Manager).
let cached: Db | undefined;

type DbSecret = { username: string; password: string };

export async function getDb(): Promise<Db> {
  if (cached) return cached;

  const { DB_PROXY_ENDPOINT, DB_NAME, DB_SECRET_ARN } = process.env;
  if (!DB_PROXY_ENDPOINT || !DB_NAME || !DB_SECRET_ARN) {
    throw new Error("Missing DB_PROXY_ENDPOINT, DB_NAME, or DB_SECRET_ARN environment variable");
  }

  const secretsClient = new SecretsManagerClient({});
  const secretResponse = await secretsClient.send(new GetSecretValueCommand({ SecretId: DB_SECRET_ARN }));
  if (!secretResponse.SecretString) {
    throw new Error(`Secret ${DB_SECRET_ARN} has no SecretString`);
  }
  const { username, password } = JSON.parse(secretResponse.SecretString) as DbSecret;

  const connectionString = `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${DB_PROXY_ENDPOINT}:5432/${DB_NAME}`;
  cached = createDb(connectionString);
  return cached;
}
