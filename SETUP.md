# The App's website: Setup

This repo is the App's **website**: the marketing site, signup and subscriptions, the client portal, and the App database's `public` schema (its tables and migrations). Everything behind a sign-in is **Pilot Light** (`/Users/christopherneisen/Desktop/pilot-light`), which latches into this site through the site module. `plan.md` is the build plan and progress tracker; this file is how to set up and run it.

## 1. Prerequisites

- **Node.js 24** and npm.
- **Pilot Light running locally** for the steps that connect to it (from Step 4): it runs on `http://localhost:3000`, which is why this site runs on **3001**.

## 2. Install

```bash
npm install
```

## 3. Create your env file

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored; never commit real values. Fill values in as you complete each gate (below). The site boots with any of them blank; a feature that needs a missing value fails with an error naming the gate to complete.

## 4. Database

This repo owns the App database's `public` schema (`lib/db/schema.ts`). Migrations live in `drizzle/`.

| Command | What it does |
|---|---|
| `npm run db:generate` | Turns schema changes in `lib/db/schema.ts` into a new migration in `drizzle/` |
| `npm run db:migrate` | Applies pending migrations to the database in `.env.local` (over the direct connection) |
| `npm run db:studio` | Opens Drizzle Studio to look at the data |

Additive migrations only (plan.md build discipline). In production, `vercel-build` runs the migrations before every build.

## 5. Run locally

```bash
npm run dev
```

Open <http://localhost:3001>.

## 6. Deploy

At gate M9 (near the end): the project goes on Vercel, where `vercel-build` migrates, then builds. Nothing goes to GitHub or Vercel before then.

---

## Manual gates

Each gate is also written inline in `plan.md` at the step it blocks. Pilot Light's existing accounts (OpenAI, SendGrid, UploadThing, Expo, Apple, Vercel, Neon) are reused with no new gate.

### M1: The App's database (Step 3)
1. <https://vercel.com/dashboard> (team selected) → **Storage** → **Create Database** → **Neon** → **Continue**.
2. Region **Washington, D.C., USA (iad1)**; name `lawn-care-app-db` → **Create**. Skip connecting a project (M9 does).
3. **.env.local** tab → **Show secret** → copy the pooled `DATABASE_URL` and the non-pooled URL into this repo's `.env.local`.
4. Tell Claude; Claude runs the migrations and seed.

Done once the migrations and seed run.

### M2: The App's admin login, a test email (Step 4)
1. Give Claude a test email you can receive.
2. Claude sends the owner invite (`invite:create`, emailed by Pilot Light).
3. Open the link, agree to the terms, set a password.

Done once you can sign in as the App's admin. At go-live (Step 24) it moves to the real admin email.

### M3: Connect this site to Pilot Light (Step 4)
1. Claude runs `npm run site:connect -- --business <app-slug>` in Pilot Light; it prints `DATABASE_URL`, `PILOT_LIGHT_BUSINESS_ID`, `PILOT_LIGHT_SITE_SECRET`.
2. Put them in this repo's `.env.local`; Claude copies the site module into `lib/pilot-light/` (with your OK).
3. Claude runs `npm run site:check -- --business <app-slug>`.

Done once the check passes.

### M4: Stripe for the App, test mode (Step 13)
1. <https://dashboard.stripe.com> → a new account for the App → stay in **Test mode**.
2. **Connect → Get started** → platform → **Express** accounts.
3. **Developers → API keys** → secret key; **Webhooks** → the endpoints Claude gives you (locally signed test events until M9).
4. Keys into this repo's `.env.local`; Claude connects the same account as the App business's Stripe connection in Pilot Light (`stripe:connect`).

Done once a test member connects an Express account.

### M5: Google Maps Platform keys (Step 15)
1. <https://console.cloud.google.com> → a project for the App → **Billing** (with a budget alert).
2. **APIs & Services → Library:** enable **Maps JavaScript API**, **Geocoding API**, **Routes API**.
3. **Credentials → Create API key** twice: a browser key restricted to Pilot Light's address (Maps JavaScript), a server key restricted to Geocoding + Routes.
4. Into Pilot Light's `.env.local` as `GOOGLE_MAPS_BROWSER_KEY` / `GOOGLE_MAPS_SERVER_KEY`.

Done once an address geocodes and the map loads.

### M6: Name & domain (Step 20)
Choose the product name and buy the domain; tell Claude both. Claude updates the wordmark, metadata, emails and `plan.md`.

Done once chosen and owned.

### M7: Terms & Privacy (Step 23)
Claude drafts Terms of Service and a Privacy Policy covering members and their clients' data (from Pilot Light's legal pages); you approve them (a lawyer's look is recommended).

Done once approved.

### M8: Sending domain (Step 24)
Claude runs Pilot Light's `email:domain` for the App's domain; add the DNS records it prints at the registrar; Claude verifies.

Done once a test invoice arrives from the App's domain.

### M9: Vercel & domain (Step 24)
1. Push this repo (you commit and push).
2. <https://vercel.com/new> → import it → connect the App's database (M1) → add every env var from `.env.local` (Sensitive where marked).
3. **Settings → Domains** → the domain (M6) with its DNS.
4. Point Stripe's webhooks and `site:connect` at the live address.

Done once the site loads on its domain and `site:check` passes.

### M10: Prices (Step 24)
In Stripe: **Product catalog → Add product** → the plan(s) and their recurring prices → give Claude the price IDs.

Done once the Pricing page and Checkout show them.

### M11: Stripe live (Step 24)
**Activate account** (business details, bank, identity), live Connect, live webhooks; live keys go straight into Vercel env vars (never in chat).

Done once a real small subscription and a real client payment succeed.
