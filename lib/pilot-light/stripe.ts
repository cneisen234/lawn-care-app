// A SaaS site's members getting paid by their own customers (lawn-care-app/plan.md Step 13;
// docs/site-conventions.md, "Members' payments"). Stripe Connect, Stripe's standard SaaS setup:
// each member has their own Stripe account (the full Stripe Dashboard; they pay Stripe's fees;
// Stripe handles identity checks and losses), made through Stripe's hosted onboarding, and a
// customer's payment is a DIRECT CHARGE on it: it lands in the member's balance, under their
// name, and its refunds and disputes are theirs. The site makes every call with its own Stripe
// key; there is no platform fee on any charge. Pilot Light refunds (its Stripe connector, as
// the member's account).
//
// Also the ONE copy of Stripe's webhook signature check: Pilot Light's own Stripe webhooks use
// it too (lib/payments/stripe/webhook.ts). Standalone: only Node's crypto and fetch.

import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = "https://api.stripe.com/v1";

/** Stripe said no, or couldn't be reached. `message` is Stripe's own words (a card decline's reason included). */
export class StripeCallError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Stripe's error code (card_declined, expired_card…), when it gave one. */
    readonly code: string | null,
  ) {
    super(message);
    this.name = "StripeCallError";
  }
}

type Params = Record<string, string | number | boolean | undefined | Record<string, string | number | boolean | Record<string, string | boolean>>>;

/** Stripe's form encoding, nested keys included (controller[fees][payer]=account). */
function form(params: Params, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Params, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe<T>(secretKey: string, path: string, params: Params, opts: { account?: string; idempotencyKey?: string; method?: "GET" | "POST" } = {}): Promise<T> {
  const method = opts.method ?? "POST";
  const body = form(params).toString();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${method === "GET" && body ? `?${body}` : ""}`, {
      method,
      headers: {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        ...(opts.account ? { "stripe-account": opts.account } : {}),
        ...(opts.idempotencyKey ? { "idempotency-key": opts.idempotencyKey } : {}),
      },
      ...(method === "POST" ? { body } : {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new StripeCallError("Stripe didn't answer. Try again in a moment.", 0, null);
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string; decline_code?: string } };
  if (res.ok) return json;
  throw new StripeCallError(json.error?.message ?? `Stripe answered ${res.status}.`, res.status, json.error?.decline_code ?? json.error?.code ?? null);
}

/** A member's Stripe account, as far as getting paid goes. */
export type MemberStripeAccount = { id: string; charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean };

/** Stripe's own flags: the account can take card payments (Stripe has what it needs to charge). */
export const canTakePayments = (a: Pick<MemberStripeAccount, "charges_enabled">) => a.charges_enabled === true;

/**
 * "Get paid": the member's Stripe account (made once, on their first press) and a fresh link to Stripe's own
 * onboarding form (identity and bank; single use, valid a few minutes, so made on each press). What they've
 * already given Stripe is never asked again. `memberId` makes a double press make ONE account.
 */
export async function memberOnboardingLink(
  secretKey: string,
  input: { memberId: string; accountId: string | null; email: string | null; businessName: string | null; returnUrl: string; refreshUrl: string },
): Promise<{ accountId: string; url: string }> {
  const accountId =
    input.accountId ??
    (
      await stripe<{ id: string }>(
        secretKey,
        "/accounts",
        {
          // Stripe's standard SaaS setup (its defaults, stated so they never drift): the member's own full Stripe
          // Dashboard, the member pays Stripe's fees, Stripe handles losses and collects what the law requires.
          controller: { stripe_dashboard: { type: "full" }, fees: { payer: "account" }, losses: { payments: "stripe" }, requirement_collection: "stripe" },
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          email: input.email ?? undefined,
          business_profile: input.businessName ? { name: input.businessName } : undefined,
          metadata: { member_id: input.memberId },
        },
        { idempotencyKey: `member-account-${input.memberId}` },
      )
    ).id;
  const link = await stripe<{ url: string }>(secretKey, "/account_links", { account: accountId, type: "account_onboarding", refresh_url: input.refreshUrl, return_url: input.returnUrl });
  return { accountId, url: link.url };
}

/** The member's account as Stripe has it now (after onboarding, or to check it). */
export const getMemberAccount = (secretKey: string, accountId: string) => stripe<MemberStripeAccount>(secretKey, `/accounts/${encodeURIComponent(accountId)}`, {}, { method: "GET" });

/**
 * A customer's payment to a member: a direct charge on the member's own account, no platform fee. The amount is
 * the caller's, read from its own records (never from the browser). Stripe's Payment Element finishes it in the
 * customer's browser (Stripe.js with the site's publishable key and `stripeAccount` = this account), with Stripe's
 * own card checks, 3-D Secure and decline reasons. `idempotencyKey` (e.g. the invoice and its amount) makes a
 * repeat of the same request the same payment.
 */
export async function chargeOnMemberAccount(
  secretKey: string,
  input: { account: string; amountCents: number; currency?: string; description: string; receiptEmail: string | null; metadata: Record<string, string>; idempotencyKey: string },
): Promise<{ id: string; clientSecret: string }> {
  if (!Number.isInteger(input.amountCents) || input.amountCents < 50) throw new StripeCallError("The amount is too small to pay by card.", 400, "amount_too_small");
  const pi = await stripe<{ id: string; client_secret: string }>(
    secretKey,
    "/payment_intents",
    {
      amount: input.amountCents,
      currency: input.currency ?? "usd",
      automatic_payment_methods: { enabled: true },
      description: input.description.slice(0, 1000),
      receipt_email: input.receiptEmail ?? undefined,
      metadata: input.metadata,
    },
    { account: input.account, idempotencyKey: input.idempotencyKey },
  );
  return { id: pi.id, clientSecret: pi.client_secret };
}

// ---- Stripe's webhook signature ----

const TOLERANCE_S = 300;

/**
 * Stripe signed this body with the endpoint's signing secret: `Stripe-Signature: t=<time>,v1=<hex>`, HMAC-SHA256
 * over "<time>.<raw body>". Older than 5 minutes is refused, so a captured request can't be replayed later.
 */
export function signedByStripe(header: string | null, body: string, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const given = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(t) || !given.length || Math.abs(now / 1000 - t) > TOLERANCE_S) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  return given.some((g) => {
    const b = Buffer.from(g);
    return b.length === expected.length && timingSafeEqual(b, expected);
  });
}

/** A Stripe event (v1), with the member's account it happened on (`account`, on a Connect endpoint). */
export type StripeEvent = { id: string; type: string; account?: string; data: { object: Record<string, unknown> & { id?: string; object?: string } } };

/** The event, if Stripe signed it; null otherwise (answer 400 and do nothing). */
export function stripeEvent(header: string | null, body: string, secret: string): StripeEvent | null {
  if (!signedByStripe(header, body, secret)) return null;
  try {
    const e = JSON.parse(body) as StripeEvent;
    return e && typeof e.id === "string" && typeof e.type === "string" && e.data?.object ? e : null;
  } catch {
    return null;
  }
}
