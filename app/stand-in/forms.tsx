"use client";

// The stand-in's buttons: each shows it's working while it works (no double press), and says what went wrong under it.

import { useActionState } from "react";
import { finishGetPaid, payInvoice, type StandInState } from "./actions";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function FinishSetup({ token }: { token: string }) {
  const [state, act, pending] = useActionState<StandInState>(() => finishGetPaid(token), {});
  return (
    <form action={act} className="mt-6">
      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-70">
        {pending ? "Finishing…" : "Finish setup"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--charcoal)]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function PayForm({ token }: { token: string }) {
  const [state, act, pending] = useActionState(payInvoice.bind(null, token), {});
  if (state.paidCents)
    return (
      <p role="status" className="mt-6 rounded-xl bg-[var(--forest-soft)] px-4 py-3 font-semibold text-[var(--forest-deep)]">
        Paid {money(state.paidCents)}. Thank you!
      </p>
    );
  return (
    <form action={act} className="mt-6">
      <label htmlFor="card" className="block text-sm text-[var(--ash)]">
        Card number
      </label>
      <input
        id="card"
        name="card"
        inputMode="numeric"
        autoComplete="cc-number"
        required
        className="mt-1 w-full rounded-xl border-2 border-[var(--border)] bg-white px-4 py-3 text-base tracking-wider text-[var(--charcoal)] focus:border-[var(--forest)] focus:outline-none"
      />
      <button type="submit" disabled={pending} className="btn-primary mt-4 w-full disabled:opacity-70">
        {pending ? "Paying…" : "Pay"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--charcoal)]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
