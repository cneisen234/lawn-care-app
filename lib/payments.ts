// Members getting paid by their clients (plan.md Step 13): Stripe's standard SaaS setup. Each member has their own
// Stripe account (Get paid: Stripe's hosted onboarding) and a client's payment is a direct charge on it, with no fee
// for the App. The site makes every Stripe call with the App's own key (lib/pilot-light/stripe.ts); Pilot Light
// refunds. Stripe's messages (webhooks for connected accounts) are the only thing that records a payment.
//
// Until the App's Stripe keys are in (gate M4), a stand-in plays Stripe's part so it can all be shown: Get paid
// opens the stand-in's setup page instead of Stripe's form, and an invoice is paid on the stand-in's card form. The
// stand-in sends this site the same signed messages Stripe would, so what it shows runs the real recording code
// below. It switches off by itself once the keys are in.

import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientInvoices, clientPayments, members } from "@/lib/db/schema";
import { getPortalLinkSecret, getSiteUrl, getStripe } from "@/lib/env";
import { canTakePayments, chargeOnMemberAccount, memberOnboardingLink, stripeEvent, StripeCallError, type StripeEvent } from "@/lib/pilot-light";
import { pilotLight } from "@/lib/pilot-light/config";

/** Something the person sees, said plainly (a card declined with Stripe's own words, an invoice already paid). */
export class PaymentRefused extends Error {}

// ---- Get paid ----

/** Where Pilot Light may send a member back to: only Pilot Light's own address (never anywhere a link could name). */
function pilotLightPage(url: unknown): string {
  const pl = pilotLight();
  if (typeof url !== "string" || !pl) throw new PaymentRefused("no page to come back to was given");
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new PaymentRefused("the page to come back to isn't an address");
  }
  if (u.origin !== new URL(pl.url).origin) throw new PaymentRefused("the page to come back to isn't Pilot Light's");
  return u.toString();
}

/**
 * A member's Get paid: their Stripe account (made on the first press, kept on their row) and where to send them to
 * finish it: Stripe's own form, or the stand-in's setup page before the App's keys are in.
 */
export async function startGetPaid(input: { memberId: string; returnUrl: unknown; refreshUrl: unknown }): Promise<string> {
  const returnUrl = pilotLightPage(input.returnUrl);
  const refreshUrl = pilotLightPage(input.refreshUrl);
  const [m] = await db.select().from(members).where(eq(members.id, input.memberId)).limit(1);
  if (!m) throw new PaymentRefused("this business couldn't be found");
  const stripe = getStripe();
  if (!stripe) {
    const accountId = m.stripeAccountId ?? `acct_demo${randomBytes(8).toString("hex")}`;
    if (!m.stripeAccountId) await db.update(members).set({ stripeAccountId: accountId, updatedAt: new Date() }).where(eq(members.id, m.id));
    return `${getSiteUrl()}/get-paid/${standInToken({ k: "get-paid", m: m.id, r: returnUrl })}`;
  }
  try {
    const link = await memberOnboardingLink(stripe.secretKey, { memberId: m.id, accountId: m.stripeAccountId, email: m.email, businessName: m.businessName, returnUrl, refreshUrl });
    if (link.accountId !== m.stripeAccountId) await db.update(members).set({ stripeAccountId: link.accountId, updatedAt: new Date() }).where(eq(members.id, m.id));
    return link.url;
  } catch (err) {
    if (err instanceof StripeCallError) throw new PaymentRefused(err.message);
    throw err;
  }
}

// ---- Paying an invoice (the client portal's Pay, Step 14) ----

/** What's still owed on an invoice: its total less what's been paid and not refunded. */
async function owed(inv: typeof clientInvoices.$inferSelect): Promise<number> {
  const [{ paid }] = await db
    .select({ paid: sql<number>`coalesce(sum(${clientPayments.amountCents} - ${clientPayments.refundedCents}), 0)::int` })
    .from(clientPayments)
    .where(and(eq(clientPayments.invoiceId, inv.id), eq(clientPayments.memberId, inv.memberId), eq(clientPayments.status, "succeeded")));
  return Math.max(0, inv.totalCents - paid);
}

export type PaymentStart =
  | { kind: "stripe"; publishableKey: string; account: string; clientSecret: string; amountCents: number }
  | { kind: "stand-in"; token: string; amountCents: number };

/** Start paying an invoice (its portal link already checked): the amount from the invoice itself, never the browser. */
export async function startInvoicePayment(invoiceId: string): Promise<PaymentStart> {
  const [inv] = await db.select().from(clientInvoices).where(eq(clientInvoices.id, invoiceId)).limit(1);
  if (!inv || !["sent", "overdue"].includes(inv.status)) throw new PaymentRefused(inv?.status === "paid" ? "This invoice is already paid." : "This invoice can't be paid online.");
  const [m] = await db.select().from(members).where(eq(members.id, inv.memberId)).limit(1);
  if (!m?.stripeAccountId || !m.payoutsEnabled) throw new PaymentRefused("This invoice can't be paid online.");
  const amountCents = await owed(inv);
  if (amountCents <= 0) throw new PaymentRefused("This invoice is already paid.");
  const stripe = getStripe();
  if (!stripe) return { kind: "stand-in", token: standInToken({ k: "pay", m: m.id, i: inv.id }), amountCents };
  try {
    const pi = await chargeOnMemberAccount(stripe.secretKey, {
      account: m.stripeAccountId,
      amountCents,
      description: `Invoice #${inv.number} from ${m.businessName}`,
      receiptEmail: inv.clientEmail,
      metadata: { invoice_id: inv.id, member_id: m.id },
      // The same invoice and amount: the same payment (a double press or a reload doesn't start a second one).
      idempotencyKey: `invoice-${inv.id}-${amountCents}`,
    });
    return { kind: "stripe", publishableKey: stripe.publishableKey, account: m.stripeAccountId, clientSecret: pi.clientSecret, amountCents };
  } catch (err) {
    if (err instanceof StripeCallError) throw new PaymentRefused(err.message);
    throw err;
  }
}

// ---- Stripe's messages ----

/** The secret Stripe's messages are signed with: the App's endpoint's, or the stand-in's own before the keys are in. */
function signingSecret(): string {
  return getStripe()?.webhookSecret ?? createHmac("sha256", getPortalLinkSecret()).update("stand-in:stripe-messages").digest("hex");
}

/** One message from Stripe (or the stand-in): checked, then recorded. Safe to receive twice. */
export async function receiveStripeMessage(body: string, signature: string | null): Promise<{ status: number; message: string }> {
  const event = stripeEvent(signature, body, signingSecret());
  if (!event) return { status: 400, message: "not signed by Stripe" };
  if (!event.account) return { status: 200, message: "not about a member's account" };
  if (event.type === "account.updated") await accountUpdated(event);
  else if (event.type === "payment_intent.succeeded") await paymentSucceeded(event);
  else if (event.type === "charge.refunded") await chargeRefunded(event);
  return { status: 200, message: "received" };
}

/** Stripe's verdict on a member's account: whether it can take card payments now. */
async function accountUpdated(e: StripeEvent) {
  const ready = canTakePayments(e.data.object as { charges_enabled: boolean });
  await db.update(members).set({ payoutsEnabled: ready, updatedAt: new Date() }).where(eq(members.stripeAccountId, e.account!));
}

/** A client paid: the payment recorded once, on the invoice it names, only if it's that member's own account. */
async function paymentSucceeded(e: StripeEvent) {
  const pi = e.data.object as { id: string; amount_received?: number; amount?: number; metadata?: Record<string, string> };
  const invoiceId = pi.metadata?.invoice_id;
  const memberId = pi.metadata?.member_id;
  if (!invoiceId || !memberId) return;
  const [m] = await db.select({ account: members.stripeAccountId }).from(members).where(eq(members.id, memberId)).limit(1);
  if (!m || m.account !== e.account) return; // not this member's account: never recorded
  const [inv] = await db.select().from(clientInvoices).where(and(eq(clientInvoices.id, invoiceId), eq(clientInvoices.memberId, memberId))).limit(1);
  if (!inv) return;
  const amountCents = pi.amount_received || pi.amount || 0;
  if (amountCents <= 0) return;
  await db.transaction(async (tx) => {
    const added = await tx
      .insert(clientPayments)
      .values({ memberId, invoiceId, stripePaymentIntent: pi.id, stripeAccountId: e.account!, amountCents, status: "succeeded", paidAt: new Date() })
      .onConflictDoNothing({ target: clientPayments.stripePaymentIntent })
      .returning({ id: clientPayments.id });
    if (!added.length) return; // already recorded
    const [{ paid }] = await tx
      .select({ paid: sql<number>`coalesce(sum(${clientPayments.amountCents} - ${clientPayments.refundedCents}), 0)::int` })
      .from(clientPayments)
      .where(and(eq(clientPayments.invoiceId, inv.id), eq(clientPayments.memberId, memberId), eq(clientPayments.status, "succeeded")));
    if (paid >= inv.totalCents)
      await tx
        .update(clientInvoices)
        .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
        .where(and(eq(clientInvoices.id, inv.id), eq(clientInvoices.memberId, memberId), inArray(clientInvoices.status, ["sent", "overdue"])));
  });
}

/** A refund (made in Pilot Light, or in the member's own Stripe): what's been refunded on that payment. */
async function chargeRefunded(e: StripeEvent) {
  const charge = e.data.object as { payment_intent?: string; amount?: number; amount_refunded?: number };
  if (!charge.payment_intent) return;
  const refunded = Math.max(0, charge.amount_refunded ?? 0);
  await db
    .update(clientPayments)
    .set({
      refundedCents: sql`least(${refunded}, ${clientPayments.amountCents})`,
      status: sql`case when ${refunded} >= ${clientPayments.amountCents} then 'refunded'::payment_status else ${clientPayments.status} end`,
      updatedAt: new Date(),
    })
    .where(and(eq(clientPayments.stripePaymentIntent, charge.payment_intent), eq(clientPayments.stripeAccountId, e.account!)));
}

// ---- The stand-in (before the App's Stripe keys are in) ----

type StandIn = { k: "get-paid"; m: string; r: string } | { k: "pay"; m: string; i: string };

const standInSig = (payload: string) => createHmac("sha256", getPortalLinkSecret()).update(`stand-in:${payload}`).digest("base64url").slice(0, 32);

/** A signed, 30-minute link to a stand-in page (it can't be made up or pointed at another member or invoice). */
function standInToken(t: StandIn): string {
  const payload = Buffer.from(JSON.stringify({ ...t, x: Date.now() + 30 * 60_000 })).toString("base64url");
  return `${payload}.${standInSig(payload)}`;
}

/** The stand-in page's link, checked: null when it isn't one this site made, or it's expired. */
export function readStandIn<K extends StandIn["k"]>(token: string, kind: K): Extract<StandIn, { k: K }> | null {
  if (getStripe()) return null; // real Stripe is in: the stand-in is off
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(standInSig(payload));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const t = JSON.parse(Buffer.from(payload, "base64url").toString()) as StandIn & { x: number };
    return t.k === kind && t.x > Date.now() ? (t as unknown as Extract<StandIn, { k: K }>) : null;
  } catch {
    return null;
  }
}

/** The stand-in sends what Stripe would: signed the same way, received by the same code. */
async function standInSends(type: string, account: string, object: Record<string, unknown>) {
  const body = JSON.stringify({ id: `evt_demo${randomBytes(8).toString("hex")}`, object: "event", type, account, data: { object } });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", signingSecret()).update(`${t}.${body}`).digest("hex");
  const r = await receiveStripeMessage(body, `t=${t},v1=${v1}`);
  if (r.status !== 200) throw new Error(`The stand-in's message wasn't accepted: ${r.message}`);
}

/** The stand-in's setup page, finished: the member's account can take payments, as Stripe would say it. */
export async function finishStandInGetPaid(token: string): Promise<string> {
  const t = readStandIn(token, "get-paid");
  if (!t) throw new PaymentRefused("This link has expired. Go back and press Get paid again.");
  const [m] = await db.select({ account: members.stripeAccountId }).from(members).where(eq(members.id, t.m)).limit(1);
  if (!m?.account) throw new PaymentRefused("This link has expired. Go back and press Get paid again.");
  await standInSends("account.updated", m.account, { id: m.account, object: "account", charges_enabled: true, payouts_enabled: true, details_submitted: true });
  return t.r;
}

/** Stripe's own test cards and its own words for each: 4242… pays; its decline cards decline. */
const TEST_CARDS: Record<string, string | null> = {
  "4242424242424242": null,
  "4000000000000002": "Your card was declined.",
  "4000000000009995": "Your card has insufficient funds.",
  "4000000000000069": "Your card has expired.",
  "4000000000000127": "Your card's security code is incorrect.",
};

/** The stand-in's card form, paid: Stripe's decline wording for its decline cards, else the payment as Stripe would report it. */
export async function finishStandInPayment(token: string, cardNumber: string): Promise<{ amountCents: number }> {
  const t = readStandIn(token, "pay");
  if (!t) throw new PaymentRefused("This page has expired. Go back to the invoice and press Pay again.");
  const card = cardNumber.replace(/\D/g, "");
  if (!(card in TEST_CARDS)) throw new PaymentRefused("Your card number is incorrect.");
  if (TEST_CARDS[card]) throw new PaymentRefused(TEST_CARDS[card]!);
  const start = await startInvoicePayment(t.i);
  const [m] = await db.select({ account: members.stripeAccountId }).from(members).where(eq(members.id, t.m)).limit(1);
  if (!m?.account) throw new PaymentRefused("This invoice can't be paid online.");
  await standInSends("payment_intent.succeeded", m.account, {
    id: `pi_demo${randomBytes(8).toString("hex")}`,
    object: "payment_intent",
    amount: start.amountCents,
    amount_received: start.amountCents,
    currency: "usd",
    status: "succeeded",
    metadata: { invoice_id: t.i, member_id: t.m },
  });
  return { amountCents: start.amountCents };
}

/** What the stand-in's setup page shows: the business it's for (null when the link isn't good). */
export async function standInGetPaidView(token: string): Promise<{ businessName: string } | null> {
  const t = readStandIn(token, "get-paid");
  if (!t) return null;
  const [m] = await db.select({ businessName: members.businessName }).from(members).where(eq(members.id, t.m)).limit(1);
  return m ?? null;
}

/** What the stand-in's card form shows: whose invoice, which, and what's owed on it now (null when the link isn't good). */
export async function standInPayView(token: string): Promise<{ businessName: string; number: number; totalCents: number; amountCents: number } | null> {
  const t = readStandIn(token, "pay");
  if (!t) return null;
  const [inv] = await db.select().from(clientInvoices).where(and(eq(clientInvoices.id, t.i), eq(clientInvoices.memberId, t.m))).limit(1);
  const [m] = await db.select({ businessName: members.businessName }).from(members).where(eq(members.id, t.m)).limit(1);
  if (!inv || !m) return null;
  return { businessName: m.businessName, number: inv.number, totalCents: inv.totalCents, amountCents: await owed(inv) };
}
