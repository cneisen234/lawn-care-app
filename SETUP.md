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
| `npm run db:seed` | Rewrites the two test members and their data (touches only those two) |
| `npm run db:check` | Proves member scope on the live database: reads its rules, then attacks it as two members, in this site's tables and in Pilot Light's own (`ops`). Changes nothing. **Run it after every migration** (`--verbose` lists every check) |

**Member scope (plan.md Section 3B).** Every member's rows live in this one database, and the database itself keeps them apart for members: row-level security for the restricted role `pilot_light_member` (`drizzle/0001_member_scope.sql`). A new member-owned table needs its four statements (row-level security, the `member_scope` policy, the `member_id` default, the grant) in its migration: see `pilot-light/docs/site-conventions.md` §8.

Additive migrations only (plan.md build discipline). In production, `vercel-build` runs the migrations before every build.

## 5. Run locally

```bash
npm run dev
```

Open <http://localhost:3001>.

## 6. Deploy

The site is on Vercel at its free `*.vercel.app` address from gate M3 (so the live Pilot Light can reach it); the custom domain comes at gate M9. Every deploy runs `vercel-build`: migrations first, then the build. Vercel gets the database URLs by connecting `lawn-care-app-db` to the project (Storage → Connect Project); without that the build stops with a message saying so.

---

## Manual gates

Each gate is also written inline in `plan.md` at the step it blocks. Pilot Light's existing accounts (OpenAI, SendGrid, UploadThing, Expo, Apple, Vercel, Neon) are reused with no new gate.

### M1: The App's database (Step 3)
1. <https://vercel.com/dashboard> (team selected) → **Storage** → **Create Database** → **Neon** → **Continue**.
2. Region **Washington, D.C., USA (iad1)**; name `lawn-care-app-db` → **Create**. Skip connecting a project (M3 does).
3. **.env.local** tab → **Show secret** → copy the pooled `DATABASE_URL` and the direct `DATABASE_URL_UNPOOLED` into this repo's `.env.local` (pasting Vercel's block as it is works; the older name `POSTGRES_URL_NON_POOLING` works too).
4. Tell Claude; Claude runs the migrations and seed.

Done once the migrations and seed run.

### M2: The App's admin login, a test email (Step 4)
1. Give Claude a test email you can receive.
2. Claude sends the owner invite (`invite:create`, emailed by Pilot Light).
3. Open the link, agree to the terms, set a password.

Done once you can sign in as the App's admin. At go-live (Step 24) it moves to the real admin email.

### M3: Connect this site to Pilot Light, at its Vercel address (Step 4)
The live Pilot Light health-checks every connected site and can't reach `localhost`, so the site is connected at its free `*.vercel.app` address (the custom domain comes at M9).
1. Push this repo (you commit and push) → <https://vercel.com/new> → import it.
2. Vercel → **Storage** → `lawn-care-app-db` → **Connect Project** → this project, all environments → **Redeploy**. Note the `*.vercel.app` address.
3. Claude runs `npm run site:connect -- --business lawn-care-app --url https://<address>.vercel.app` in Pilot Light; it prints `PILOT_LIGHT_URL`, `PILOT_LIGHT_BUSINESS_ID`, `PILOT_LIGHT_SITE_SECRET`.
4. Put them in this repo's `.env.local` and the Vercel project's env vars (the secret marked **Sensitive**); never in chat. Claude copies the site module into `lib/pilot-light/` and its route (with your OK); you commit and push (redeploy).
5. Claude runs `npm run site:check -- --business lawn-care-app`.

Done once the check passes.

### M3a: Emails to members' customers (Step 12)
Invoices, quotes and payment reminders go out from the site through Kindling's SendGrid (the same account Pilot Light uses), from Kindling's domain under the member's business name until the App's own domain (M8).
1. Copy `SENDGRID_API_KEY` from Pilot Light's `.env.local` into this repo's `.env.local`.
2. Make the link secret: run `openssl rand -base64 32` in a terminal and put the result in this repo's `.env.local` as `PORTAL_LINK_SECRET`. Set it once: changing it later breaks every link already emailed.
3. Put both in the Vercel project's env vars too (marked **Sensitive**), the same values; never in chat.
4. Restart this site's dev server.

Done once a test invoice email arrives.

### M4: Stripe for the App, test mode (Step 13)
Until this is done, a stand-in plays Stripe's part (Get paid, paying an invoice), so it can all be demoed. It switches off by itself once the three keys below are in.
1. <https://dashboard.stripe.com> → a new account for the App → stay in **Test mode**.
2. **Connect → Get started** → a platform whose businesses are paid directly by their own customers (Stripe's SaaS setup: each member gets their own Stripe account; no platform fee).
3. **Developers → API keys:** the **Secret key** (`sk_test_…`) → `STRIPE_SECRET_KEY`; the **Publishable key** (`pk_test_…`) → `STRIPE_PUBLISHABLE_KEY`.
4. **Developers → Webhooks → Add endpoint:** listen to events on **Connected accounts**, at `<this site's address>/api/stripe/webhook`, events `account.updated`, `payment_intent.succeeded`, `charge.refunded` → its **Signing secret** (`whsec_…`) → `STRIPE_CONNECT_WEBHOOK_SECRET`.
5. All three into this repo's `.env.local` and the Vercel project's env vars (the secret key and signing secret marked **Sensitive**); never in chat. Restart the dev server.
6. Claude connects the same account in Pilot Light as the App business's Stripe connection (`stripe:connect`), so refunds work, and clears the stand-in's made-up accounts (members' `acct_demo…` values) so every member presses Get paid once for real.

Done once a test member finishes **Get paid** on Stripe's form and a test client pays an invoice with Stripe's test card.

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

### M9: The custom domain (Step 24)
The Vercel project exists since M3.
1. Vercel → the project → **Settings → Domains** → the domain (M6) with its DNS.
2. Claude runs `site:connect --url https://<domain>` (moves the site; its new secret goes into Vercel).
3. Point Stripe's webhooks at the domain; check every env var is in Vercel.

Done once the site loads on its domain and `site:check` passes.

### M10: Prices (Step 24)
In Stripe: **Product catalog → Add product** → the plan(s) and their recurring prices → give Claude the price IDs.

Done once the Pricing page and Checkout show them.

### M11: Stripe live (Step 24)
**Activate account** (business details, bank, identity), live Connect, live webhooks; live keys go straight into Vercel env vars (never in chat).

Done once a real small subscription and a real client payment succeed.
