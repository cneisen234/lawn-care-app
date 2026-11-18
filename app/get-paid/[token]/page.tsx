// The stand-in for Stripe's onboarding form (plan.md Step 13), before the App's Stripe keys are in: a member's Get
// paid in Pilot Light lands here, and Finish setup tells the site their account can take payments, as Stripe would.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { standInGetPaidView } from "@/lib/payments";
import { FinishSetup } from "@/app/stand-in/forms";

export const metadata = { robots: { index: false } };

async function Setup({ params }: { params: Promise<{ token: string }> }) {
  // Per visit: the link's expiry is checked against the time now.
  await connection();
  const { token } = await params;
  const view = await standInGetPaidView(token);
  if (!view) notFound();
  return (
    <section className="card-sign mx-auto w-full max-w-md p-6">
      <p className="text-sm font-semibold text-[var(--stone)]">{view.businessName}</p>
      <h1 className="mt-1 font-[family-name:var(--font-zilla)] text-2xl font-bold text-[var(--charcoal)]">Get paid</h1>
      <FinishSetup token={token} />
    </section>
  );
}

export default function Page({ params }: PageProps<"/get-paid/[token]">) {
  return (
    <div className="px-4 py-12">
      <Suspense fallback={<div className="mx-auto h-48 w-full max-w-md" />}>
        <Setup params={params} />
      </Suspense>
    </div>
  );
}
