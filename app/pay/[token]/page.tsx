// The stand-in for Stripe's card form (plan.md Step 13), before the App's Stripe keys are in: paying an invoice
// from the client portal (Step 14). Stripe's own test cards behave as they do at Stripe (4242… pays; its decline
// cards decline in Stripe's words), and a payment is reported to the site as Stripe would report it.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { standInPayView } from "@/lib/payments";
import { PayForm } from "@/app/stand-in/forms";

export const metadata = { robots: { index: false } };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

async function Pay({ params }: { params: Promise<{ token: string }> }) {
  // Per visit: the link's expiry is checked against the time now.
  await connection();
  const { token } = await params;
  const view = await standInPayView(token);
  if (!view) notFound();
  return (
    <section className="card-sign mx-auto w-full max-w-md p-6">
      <p className="text-sm font-semibold text-[var(--stone)]">{view.businessName}</p>
      <h1 className="mt-1 font-[family-name:var(--font-zilla)] text-2xl font-bold text-[var(--charcoal)]">Invoice #{view.number}</h1>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span className="text-[var(--ash)]">{view.amountCents > 0 ? "Amount due" : "Paid"}</span>
        <span className="font-semibold tabular-nums text-[var(--charcoal)]">{money(view.amountCents > 0 ? view.amountCents : view.totalCents)}</span>
      </div>
      {view.amountCents > 0 ? (
        <PayForm token={token} />
      ) : (
        <p role="status" className="mt-6 rounded-xl bg-[var(--forest-soft)] px-4 py-3 font-semibold text-[var(--forest-deep)]">
          Paid in full. Thank you!
        </p>
      )}
    </section>
  );
}

export default function Page({ params }: PageProps<"/pay/[token]">) {
  return (
    <div className="px-4 py-12">
      <Suspense fallback={<div className="mx-auto h-64 w-full max-w-md" />}>
        <Pay params={params} />
      </Suspense>
    </div>
  );
}
