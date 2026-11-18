// Environment access, validated in ONE place with zod (Pilot Light's pattern).
//
// Every variable is OPTIONAL at load time, so the site boots and serves what
// doesn't need a given key before that manual gate is done (M1 to M11 in
// plan.md / SETUP.md). A value is REQUIRED only at the moment a feature needs
// it, and then it fails loudly naming the exact gate. Each step adds the
// variables it uses here (and to .env.example), never ahead of time.
//
// Never read process.env directly elsewhere. The exceptions: drizzle.config.ts
// and scripts/ (they run outside Next.js), and Pilot Light's site module
// (lib/pilot-light/), which reads its own PILOT_LIGHT_* names and is never
// edited here.

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
  // M3a: emails to members' customers (invoices, quotes, reminders): Kindling's SendGrid key, and the secret that
  // signs the links in them (any long random value, set once; changing it breaks every link already sent)
  SENDGRID_API_KEY: optionalKey,
  PORTAL_LINK_SECRET: optionalKey,
  // M4: the App's Stripe account (members getting paid by their clients, Step 13). All three or none: without them
  // the demo stand-in plays Stripe's part, so Get paid and paying an invoice can be shown before the account exists.
  STRIPE_SECRET_KEY: optionalKey,
  STRIPE_PUBLISHABLE_KEY: optionalKey,
  STRIPE_CONNECT_WEBHOOK_SECRET: optionalKey, // the signing secret of the webhook endpoint for connected accounts
  // Optional: who the emails come from until the App's own sending domain (M8). Defaults to Kindling's domain.
  EMAIL_FROM: optionalKey,
  // Set by Vercel on its own: the site's production address (the custom domain once it's added)
  VERCEL_PROJECT_PRODUCTION_URL: optionalKey,
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

/** Kindling's SendGrid key, for the emails the site sends members' customers (gate M3a). */
export function getSendgridKey(): string {
  const value = env.SENDGRID_API_KEY;
  if (!value) throw new MissingEnvError("SENDGRID_API_KEY", "M3a");
  if (!value.startsWith("SG.")) throw new InvalidEnvError("SENDGRID_API_KEY", "not a SendGrid API key (it starts with SG.)", "M3a");
  return value;
}

/** The secret that signs client-portal links (gate M3a). */
export function getPortalLinkSecret(): string {
  const value = env.PORTAL_LINK_SECRET;
  if (!value) throw new MissingEnvError("PORTAL_LINK_SECRET", "M3a");
  if (value.length < 32) throw new InvalidEnvError("PORTAL_LINK_SECRET", "too short (use at least 32 random characters)", "M3a");
  return value;
}

/** Who the site's emails come from: Kindling's authenticated domain until the App's own (M8). */
export function getEmailFrom(): string {
  return env.EMAIL_FROM ?? "invoices@kindlingdigital.org";
}

/** The site's own address, for links in emails: this computer under `next dev`, the live address everywhere else. */
export function getSiteUrl(): string {
  if (process.env.NODE_ENV === "development") return `http://localhost:${process.env.PORT ?? "3001"}`;
  const live = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!live) throw new MissingEnvError("VERCEL_PROJECT_PRODUCTION_URL", "M3 (Vercel sets it on its own once the project is deployed)");
  return `https://${live.replace(/^https?:\/\//, "")}`;
}

export type StripeKeys = { secretKey: string; publishableKey: string; webhookSecret: string };

/**
 * The App's Stripe keys (gate M4), or null before they exist: then the demo stand-in plays Stripe's part (lib/payments.ts).
 * Some but not all of them is a setup mistake, and fails loudly.
 */
export function getStripe(): StripeKeys | null {
  const { STRIPE_SECRET_KEY: secretKey, STRIPE_PUBLISHABLE_KEY: publishableKey, STRIPE_CONNECT_WEBHOOK_SECRET: webhookSecret } = env;
  if (!secretKey && !publishableKey && !webhookSecret) return null;
  if (!secretKey) throw new MissingEnvError("STRIPE_SECRET_KEY", "M4");
  if (!publishableKey) throw new MissingEnvError("STRIPE_PUBLISHABLE_KEY", "M4");
  if (!webhookSecret) throw new MissingEnvError("STRIPE_CONNECT_WEBHOOK_SECRET", "M4");
  if (!/^sk_(test|live)_/.test(secretKey)) throw new InvalidEnvError("STRIPE_SECRET_KEY", "not a Stripe secret key (it starts with sk_test_ or sk_live_)", "M4");
  if (!/^pk_(test|live)_/.test(publishableKey)) throw new InvalidEnvError("STRIPE_PUBLISHABLE_KEY", "not a Stripe publishable key (it starts with pk_test_ or pk_live_)", "M4");
  if (!webhookSecret.startsWith("whsec_")) throw new InvalidEnvError("STRIPE_CONNECT_WEBHOOK_SECRET", "not a webhook signing secret (it starts with whsec_)", "M4");
  if (secretKey.startsWith("sk_test_") !== publishableKey.startsWith("pk_test_")) throw new InvalidEnvError("STRIPE_PUBLISHABLE_KEY", "from the other mode (test and live keys can't be mixed)", "M4");
  return { secretKey, publishableKey, webhookSecret };
}

/** Whether each gate's values are present, without throwing (for status checks). */
export const configured = {
  database: () => Boolean(env.DATABASE_URL),
  email: () => Boolean(env.SENDGRID_API_KEY && env.PORTAL_LINK_SECRET),
};
