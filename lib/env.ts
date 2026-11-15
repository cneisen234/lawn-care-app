// Environment access, validated in ONE place with zod (Pilot Light's pattern).
//
// Every variable is OPTIONAL at load time, so the site boots and serves what
// doesn't need a given key before that manual gate is done (M1 to M11 in
// plan.md / SETUP.md). A value is REQUIRED only at the moment a feature needs
// it, and then it fails loudly naming the exact gate. Each step adds the
// variables it uses here (and to .env.example), never ahead of time.
//
// Never read process.env directly elsewhere. The one exception is
// drizzle.config.ts, which runs in the drizzle-kit CLI.

import { z } from "zod";

// A blank or whitespace value counts as "not set", so an empty placeholder line
// in .env.local behaves the same as a missing one.
const optionalKey = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

const schema = z.object({
  // M1: the App's database (Neon, created in Vercel Storage)
  DATABASE_URL: optionalKey, // pooled ("-pooler" in the host), used at runtime
  // direct, used by migrations (drizzle.config.ts): Vercel's block names it DATABASE_URL_UNPOOLED
  DATABASE_URL_UNPOOLED: optionalKey,
  POSTGRES_URL_NON_POOLING: optionalKey, // the same, by its older name
});

const env = schema.parse(process.env);

class MissingEnvError extends Error {
  constructor(key: string, gate: string) {
    super(`${key} is not set. Complete gate ${gate} (SETUP.md / plan.md), put it in .env.local, and restart the dev server.`);
    this.name = "MissingEnvError";
  }
}

class InvalidEnvError extends Error {
  constructor(key: string, problem: string, gate: string) {
    super(`${key} is ${problem}. Check gate ${gate} (SETUP.md / plan.md) and fix it in .env.local.`);
    this.name = "InvalidEnvError";
  }
}

/** The App database's pooled connection string (gate M1). */
export function getDatabaseUrl(): string {
  const value = env.DATABASE_URL;
  if (!value) throw new MissingEnvError("DATABASE_URL", "M1");
  if (!/^postgres(ql)?:\/\//.test(value)) {
    throw new InvalidEnvError("DATABASE_URL", "not a Postgres connection string (it should start with postgresql://)", "M1");
  }
  return value;
}

/** Whether each gate's values are present, without throwing (for status checks). */
export const configured = {
  database: () => Boolean(env.DATABASE_URL),
};
