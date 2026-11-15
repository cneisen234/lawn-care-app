// drizzle-kit configuration, used by the `db:*` scripts to generate and apply
// migrations from lib/db/schema.ts (this repo owns the App database's `public`
// schema; plan.md Section 2C).
//
// The CLI runs outside Next.js, so it doesn't load .env.local by itself; it's
// loaded here. This is the one place that reads process.env directly (the CLI
// runs before lib/env.ts could). Migrations use the direct (non-pooled)
// connection when there is one: schema changes run as a single session.

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

// The direct connection goes by two names: Vercel's Neon block calls it
// DATABASE_URL_UNPOOLED; older setups call it POSTGRES_URL_NON_POOLING.
const migrationUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "Set DATABASE_URL_UNPOOLED (or POSTGRES_URL_NON_POOLING; preferred) or DATABASE_URL in .env.local before running drizzle-kit (gate M1 in plan.md / SETUP.md).",
  );
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
  strict: true,
  verbose: true,
});
