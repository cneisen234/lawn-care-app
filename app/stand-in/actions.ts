"use server";

// The stand-in's two presses (plan.md Step 13), before the App's Stripe keys are in: finishing Get paid, and paying
// an invoice. Each link is signed and short-lived (lib/payments.ts), so it can't be made up or pointed elsewhere.

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { finishStandInGetPaid, finishStandInPayment, PaymentRefused } from "@/lib/payments";

export type StandInState = { error?: string; paidCents?: number };

export async function finishGetPaid(token: string): Promise<StandInState> {
  let back: string;
  try {
    back = await finishStandInGetPaid(token);
  } catch (err) {
    if (err instanceof PaymentRefused) return { error: err.message };
    throw err;
  }
  redirect(back);
}

export async function payInvoice(token: string, _: StandInState, fd: FormData): Promise<StandInState> {
  try {
    const r = await finishStandInPayment(token, String(fd.get("card") ?? ""));
    // The page's own numbers again (now paid in full).
    refresh();
    return { paidCents: r.amountCents };
  } catch (err) {
    if (err instanceof PaymentRefused) return { error: err.message };
    throw err;
  }
}
