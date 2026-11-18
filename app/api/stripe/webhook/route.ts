// Stripe's messages about members' own Stripe accounts (plan.md Step 13): the App's webhook endpoint for
// "Connected accounts" (account.updated, payment_intent.succeeded, charge.refunded). Public: the signature is the
// gate, checked against the raw body before anything is read (lib/payments.ts). A failure answers 500 so Stripe
// sends it again; a repeat is recorded once.

import { receiveStripeMessage } from "@/lib/payments";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const r = await receiveStripeMessage(body, request.headers.get("stripe-signature"));
    return Response.json({ received: r.status === 200, message: r.message }, { status: r.status, headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[stripe webhook] couldn't record it:", err);
    return Response.json({ received: false }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
