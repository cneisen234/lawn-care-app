// Drizzle database client (server-only), as on Kindling's other sites: Neon's
// serverless Pool over WebSockets, so transactions work. DATABASE_URL is the
// App database's pooled connection string (gate M1); it's read through
// lib/env.ts, which names the gate if it's missing.

import "server-only";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { getDatabaseUrl } from "../env";
import * as schema from "./schema";

if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

const pool = new Pool({ connectionString: getDatabaseUrl() });

/** The shared Drizzle client. */
export const db = drizzle(pool, { schema });
