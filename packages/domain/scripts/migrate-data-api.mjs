// Runs pending Drizzle migrations (./drizzle/*.sql) against Aurora over the RDS Data API
// (HTTPS + IAM), instead of a direct TCP connection — the only path in from outside the VPC, since
// there's no NAT/bastion and RDS Proxy has no public endpoint (SPEC.md §8). Requires the cluster's
// `enable_http_endpoint` to be on (infra/modules/database) and AWS credentials for a principal
// allowed to call rds-data:* and secretsmanager:GetSecretValue on the DB secret.
//
// Usage: node scripts/migrate-data-api.mjs
// Override target via env vars if migrating a different environment/account:
//   DB_RESOURCE_ARN, DB_SECRET_ARN, DB_NAME, AWS_REGION
//
// Credentials are resolved by shelling out to `aws configure export-credentials` (this machine's
// "helix-core" profile is itself `credential_process = aws configure export-credentials` with no
// --profile flag — it just re-exports whatever the CLI's own default session already is, see
// ~/.aws/config). Letting the AWS SDK's own provider chain do this (e.g. via AWS_PROFILE=helix-core)
// makes the spawned child process inherit that same env var and try to resolve "helix-core" again,
// which the CLI correctly rejects as a self-referential credential_process cycle. Resolving once here
// and handing the SDK static credentials sidesteps that entirely.

import { execFileSync } from "node:child_process";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { migrate } from "drizzle-orm/aws-data-api/pg/migrator";

function resolveCredentials() {
  const { AWS_PROFILE, ...envWithoutProfile } = process.env;
  const json = execFileSync("aws", ["configure", "export-credentials"], {
    encoding: "utf8",
    env: envWithoutProfile,
  });
  const parsed = JSON.parse(json);
  return {
    accessKeyId: parsed.AccessKeyId,
    secretAccessKey: parsed.SecretAccessKey,
    sessionToken: parsed.SessionToken,
    expiration: parsed.Expiration ? new Date(parsed.Expiration) : undefined,
  };
}

const region = process.env.AWS_REGION ?? "eu-west-1";
const database = process.env.DB_NAME ?? "helix";
const resourceArn = process.env.DB_RESOURCE_ARN ?? "arn:aws:rds:eu-west-1:924622219617:cluster:helix-dev";
const secretArn =
  process.env.DB_SECRET_ARN ??
  "arn:aws:secretsmanager:eu-west-1:924622219617:secret:rds!cluster-afd69232-c55d-4732-8186-4a0e018f685b-fpJ0d2";

const client = new RDSDataClient({ region, credentials: resolveCredentials() });
const db = drizzle(client, { database, resourceArn, secretArn });

console.log(`Migrating ${database} (${resourceArn}) via RDS Data API...`);
await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
console.log("Done.");
