import { defineConfig } from "drizzle-kit";

// DATABASE_URL points at the Aurora Postgres cluster via RDS Proxy (Section 6/Section 8),
// injected per environment — never committed.
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
