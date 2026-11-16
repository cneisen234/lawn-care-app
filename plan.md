# Lawn Care SaaS: Build Plan & Progress Tracker

> **Names:** the product's name is **not chosen yet** (gate M6); this plan calls it **"the App"**. The AI is always **Lena**. In Pilot Light's generic terms, the App is a **SaaS business**, and the people who sign up are its **members**: for the App, members are solo lawn-care operators. A member's own customers are their **clients**.
>
> **Purpose of this file:** the single source of truth for building this project, so work can resume in a fresh chat with zero context loss. **Update the Progress Tracker (Section 6) after every step.** Modeled on Pilot Light's own `plan.md` (`/Users/christopherneisen/Desktop/pilot-light/plan.md`).
>
> **Source:** the user's feature list and decisions (2026-11-15). Do not add, remove, or reinterpret requirements. If something is unclear, ask the user.

---

## 0. Context for resuming (read this first in a new chat)

**What we're building:** a premium, intelligent business system for solo lawn-care operators, sold by subscription and powered by Pilot Light. The bookkeeping happens inside the work: a member starts a job, finishes it, and its time, services and price land on the client's invoice by themselves; at month's end the invoices are ready to review and send. Around that: a client book, recurring visits, route order, weather warnings, a satellite-map lawn estimator, expenses and profit, online client payments, a client portal, and Lena.

**Two pieces of work, in two places:**
1. **Pilot Light learns to run SaaS products (generic).** Today every Pilot Light business is one company with an owner and an assistant. A **SaaS business** adds a third tier, **members**, each running their own business inside it. This is built **for SaaS products in general, never for the lawn App**, so future SaaS apps plug into Pilot Light the same way Kindling websites do (user decision). It lives in Pilot Light's code and docs (`docs/site-conventions.md` gains a SaaS section, the site module gains SaaS helpers).
2. **The App (lawn-specific).** This repo is the App's **website**: the marketing site, signup and subscriptions, the client portal, and the App database's `public` schema. Pilot Light's **`lawn_care` add-on** holds the lawn features behind the sign-in.

**The rule, everywhere: customer-facing = the website (this repo); admin, meaning anything behind a sign-in = Pilot Light.**

**The three tiers:**
1. **Super admin (Kindling):** Kindling's own Pilot Light console. **Exists; nothing to build.** The App appears there like every client business. Addition: on businesses Kindling co-administers, Kindling's "Look in" becomes **full control** (Step 9).
2. **App admins:** the App business's **owner** login (an established Pilot Light pattern), plus Kindling through (1). They set the **one global Lena configuration**, which is simply Pilot Light's business-level Lena settings: every member shares them because they're one business. They also see the members list, subscriptions and usage. The admin login uses a **test email until go-live**.
3. **Members (lawn operators):** run their own business (clients, jobs, schedule, invoices, money) and **use** Lena, but can't set anything at the Lena level.

**Data:** one database for the whole App (registered in Pilot Light like any client's). Members don't get their own database. Every member's records carry `member_id`. The consequence that must never slip: **"Lena only knows this member's business" is enforced in code, not by a database wall.** Member scope is built once, in the platform (Step 6), and everything goes through it.

**On the phone:** members use **the Pilot Light app as it is** (Lena chat, Allow cards, push, the camera to send photos to Lena, and links that open the dashboard). **No phone-app work.** The dashboard is mobile-first and **already works offline**: with Next 16's `experimental.useOffline` (on in Pilot Light), a save or page load made with no signal waits and goes through when the signal returns, with a "You're offline" line.

**Project locations:** this repo `/Users/christopherneisen/Desktop/lawn-care-app`; Pilot Light `/Users/christopherneisen/Desktop/pilot-light`. The brand lives in this repo (`app/globals.css`, `components/`).

### The user's ground rules (apply everywhere)
1. **Reuse Pilot Light; never reinvent the wheel.** Anything Pilot Light's existing structure can do is built that way. No duplicated code, no parallel versions ("this is how apps break"). Net-new only where Section 3D says so. When something *almost* fits, extend it in Pilot Light.
2. **The SaaS layer is generic.** Nothing in Pilot Light's SaaS layer names lawns, jobs or invoices. Lawn logic lives only in the `lawn_care` add-on and this site.
3. **Customer-facing = website; admin = Pilot Light.** No exceptions.
4. **No phone-app work.** The Pilot Light app is used as it is.
5. **Premium, not cheap.** Never cut capability to hit a low price.
6. **The App's "Forest & Stone" brand (Section 3F), and grow it.** Its source of truth is this repo (`app/globals.css`, `components/`). Anything it never defined (tables, forms, the map, the portal) is built in the same visual language.
7. **Member scope is non-negotiable.** No query, tool, page, email or export runs for a member without their scope. A guard fails loudly; nothing relies on remembering.
8. **Lena-level settings are admin-only.** One global Lena configuration for all members.
9. **Bookkeeping happens in the workflow.** Never add an after-work chore.
10. **Automation first, AI only when needed** (Pilot Light rule 13). The estimator is plain math, never AI.
11. **Lena never writes** (Pilot Light rule 7). She proposes Allow cards; a person's press, or a fixed rule the member switched on, makes every change.
12. **Easier to add than remove.** Build only what's in this plan.
13. **Claude never commits, pushes, or rewrites git history.** The user does all commits; Claude says when a step is ready and suggests a message (per repo).
14. **Stay at the product level.** No deep dives into testing or edge cases.

### Locked decisions

"Source": **User** = decided by the user. **Claude** = a default the user can veto; **(veto?)** marks the ones to check now.

| Area | Decision | Source |
|---|---|---|
| Name | **TBD** (M6); placeholder "the App". AI **Lena** everywhere | User |
| Positioning | Premium, intelligent, Pilot Light-powered | User |
| Architecture | The App = one Pilot Light **SaaS business**. This repo = its website (marketing, signup, subscriptions, client portal, the `public` schema, the site module). Pilot Light = everything behind a sign-in | User |
| SaaS layer | Built generically in Pilot Light for any SaaS product: the business flag, members, member scope, provisioning, subscription gates, member payments, member Lena, site conventions | User |
| Tier-3 name | **Members** (a SaaS business's members); the App shows them as "your business" | User (any name works) |
| Data | One database for the App; every member-owned row has `member_id`; no database per member | User |
| Member logins | Through Pilot Light's existing `users` table: new role **`member`** + `member_id`. Members get Pilot Light's sign-in, password reset, **invite (welcome) email**, the phone app and push with no new auth code. Their business data stays in the App database. Members are members **of** the App: every member login belongs to the App business and every member row lives in the App's database, so the parent/child relationship always holds | User |
| What admins see | Admins (the owner login) see **everything in the business, all members included**, as an owner always does in Pilot Light ("all clients of a SaaS app relate to the SaaS owner") | User |
| Lena configuration | Global: Pilot Light's existing business-level Lena settings; members never see them | User / Claude (mechanism) |
| Kindling full control | A per-business switch, **`kindling_admin`**, set on the App only: Kindling's "Look in" on that business is full control; client websites stay look-only. **Hardened (Step 9):** set and cleared only by CLI with direct database access (no page, form, action or API can touch it, like the existing `kindling` flag); re-read from the master database on every request, never trusted from a cookie or token; the session is signed, time-limited and startable only by Kindling's own owner from the console | User |
| Signup → login | The site writes the member's row after checkout. Pilot Light's change trigger raises an event, and the SaaS layer's handler creates the login and sends **Pilot Light's existing invite (welcome) email**. No new endpoint | User (flow) / Claude (mechanism) |
| Subscriptions | Stripe Billing on the site (Checkout, Customer Portal, webhooks → the member row). **Gates built now; prices inserted later (M10).** Access: trialing/active = full; past_due = full with a banner and a grace period; canceled = read-only plus their data export. A **comped** flag skips billing | User / Claude (statuses) |
| Member payments | **Stripe Connect (Express)** under the App's own Stripe account (the same one for subscriptions): each member connects their Stripe; the site charges on the member's connected account (Pilot Light's model: the site charges, Pilot Light refunds); refunds are Allow cards. Members don't set up Stripe on their own; Connect gives the App what it needs. **Square: not planned** | User |
| Customer emails | Invoice, quote and reminder emails are **site actions** (Pilot Light's pattern for "email the customer when X"): the member's press in Pilot Light calls the site, which sends the email in the member's branding with a client-portal link | Claude |
| Recurring work | A **daily add-on hook** in Pilot Light's existing daily sweep: recurring visits create upcoming jobs; month-end closes invoices; overdue reminders; weather checks. Each is a fixed rule the member switches on (add-on settings), so no AI writes and no phone change | Claude |
| Estimator | Draw the lawn on a satellite map → square feet → × the member's price → quote; saved to the property and reused. No AI | User |
| Maps | Google Maps Platform: Maps JavaScript (satellite), **Terra Draw** for drawing (Google's own drawing library was retired), the geometry library for area, Geocoding, Routes (stop order) | Claude |
| Weather | National Weather Service API (free, no key, US-only; the User-Agent carries a generic App contact, never personal details) | User (API) / Claude (provider) |
| Taxes | No tax reports or tax APIs. Members enter their own tax rate; meaning per open question (a) | User |
| Phone | The Pilot Light app as is; dashboard offline support as is | User |
| Brand | The App's "Forest & Stone" system (Section 3F), in this repo, through the site-convention theme variables, so Pilot Light's `theme:import` dresses the member dashboard too | User / Claude (seam) |
| Framework | This repo: Next.js 16.4.6 + React 19.3 + Tailwind v4; read `node_modules/next/dist/docs/` first (AGENTS.md). Pilot Light keeps its own stack | User / Spec |
| Hosting | This repo on Vercel: its free `*.vercel.app` address from M3 (so the live Pilot Light can reach it; Luzerne Express is connected the same way), the custom domain at M9; Pilot Light as today | User (2026-11-15) |
| Testing | No test framework (Pilot Light's pattern): live checks with **two test members**; isolation re-checked at every checkpoint | Claude |

### Feature scope
**In:** client book searchable by name and address · start/complete jobs with time tracking and average time per client · per-job service checklist · each member's own pricing (hourly, per visit, per sq ft) · auto-invoicing (per visit or monthly) with review-and-send · before/after photos · satellite lawn estimator with saved measurements · recurring visits + calendar · seasonal service packages · route order · weather warnings · client payments online · reminders and overdue tracking · expenses, mileage and profit per job/client · a manually entered tax rate · client portal · quote pipeline (request → quote → scheduled → done → invoiced) · branded invoices · subscriptions with payment gates · Lena.
**Out:** tax reports, digital quote acceptance/e-sign, automated review requests, "on my way"/reminder texts, AI pricing suggestions, a Lena daily briefing, voice logging, at-risk client alerts, revenue forecasting, a separate PWA or app.

### Notes
- **Open question (a), before Step 19:** the tax rate: sales tax added to invoices, an income-tax set-aside shown on profit, or both?
- **Pilot Light's plan:** every Pilot Light step here is also logged in Pilot Light's own `plan.md` Progress Tracker, and the SaaS layer gets its own section there, since it's a platform capability.

### Known limitations
- Member isolation is a code guarantee in one shared database; it rests on Step 6's guard and is re-tested at every checkpoint.
- Offline work waits inside the open page; closing the browser tab while offline drops it.
- Satellite imagery can be dated or hidden by trees; the drawing is adjustable.
- Route order handles about 25 stops at a time; longer days are ordered in parts.
- NWS weather is US-only. Emails to clients can't be unsent.

### Conventions to reuse
- **Pilot Light:** `lib/auth/*` (sessions, roles, invites, resets, support sessions), `lib/kindling/commands.ts` (`inviteAndEmail`), `lib/addons/*` (module, catalog, registry, grants, `eventHandlers`, `pages`, settings), schema maps (`lib/maps/format.ts`: statuses + transitions + **stamps**, `parent` child records, `customerLink`, image fields, money, search, filters, `showWhen`, `modelFacts`, `payment`) and **Manage**, **Today** (customer-sent records in their first status, one-tap next status), the action pipeline + Allow cards (rule-proposed too), `lib/events/*` (change triggers, the daily sweep in `lib/events/run.ts`), Lena's owner and customer agents, `lib/payments/stripe`, site actions, notifications + push, `lib/names.ts`, the shared UI and "THE design pattern".
- **Site side (this repo):** `pilot-light/docs/site-conventions.md` and `docs/site-module.md` (theme variables, connection env, endpoints, navigation, `siteEmailHeaders`, site actions, `notifyChange`, `<LenaForCustomers />`, payments).
- **Brand:** this repo's `app/globals.css`, `components/` (`Logo`, `GrassEdge`, `MownLawn`, `Navigation`, `Footer`) and the fonts in `app/layout.tsx`.
- **`AGENTS.md`:** read the Next docs before Next-specific code; leave the auto-generated block in place.

### Build discipline
- **Every step names the Pilot Light mechanism it extends.** Anything net-new that Section 3D doesn't list: stop and ask.
- **Every step names its member scope.**
- **Generic check (Pilot Light SaaS steps):** would a second, unrelated SaaS app work with this unchanged? If not, it doesn't belong in the SaaS layer.
- Brand tokens only; additive migrations only; phase by phase; stop for a user gut-check at every checkpoint.

---

## 1. ⚠️ Manual actions the USER must do

Each gate is repeated inline at the step it blocks. Pilot Light's existing accounts (OpenAI, SendGrid, UploadThing, Expo, Apple, Vercel, Neon) are reused with no new gate.

- **M1** The App's database in Vercel Storage (Step 3)
- **M2** The App's admin login, a test email (Step 4)
- **M3** Connect this site to Pilot Light, at its Vercel address (Step 4)
- **M4** Stripe account for the App, test mode, with Connect (Step 13)
- **M5** Google Maps Platform keys (Step 15)
- **M6** Product name + domain (Step 20)
- **M7** Terms of Service + Privacy Policy approved (Step 23)
- **M8** Sending domain for the App's emails (Step 24)
- **M9** The custom domain for this site (Step 24; the Vercel project exists since M3)
- **M10** Subscription prices (Step 24)
- **M11** Stripe live mode (Step 24)

---

## 2. Data model

### 2A. Pilot Light master DB (generic SaaS layer; additive)
- **businesses:** `saas` (boolean: this business has members), `kindling_admin` (boolean: Kindling's Look in is full control). Both set by CLI.
- **users:** role gains **`member`**; new nullable **`member_id`** (the member row's id in the business's own database). The one-owner-plus-one-assistant limit doesn't count members.
- **invites:** role gains `member` (+ its `member_id`).

### 2B. Pilot Light `ops` schema (generic; additive)
- Nullable **`member_id`** on every `ops` table holding a member's content (at least actions, scheduled_tasks, conversations, messages, contacts, notifications, model_facts, twin_edges, knowledge_chunks, simulations, verifications, audit_log, errors, emails; the full list is settled in Step 6 by auditing every table). Null = business-wide (admin-level).

### 2C. The App database `public` schema (owned and migrated by **this repo**)
Every table carries **`member_id`** (indexed, first in composite indexes); money in integer cents; rates in basis points. The member scope column name follows the new SaaS site convention (Step 7). Every link between member-owned records has **two foreign keys**: a single-column one (what Pilot Light's schema reader uses) and a composite one including `member_id`, so the database itself refuses a cross-member link.
- **members** (`member_id` = its own id): business_name, contact_name, email (login), phone, address, logo_url, tax_rate_bp, mileage_rate_cents, billing_default (monthly|per_visit), invoice_due_days, next_invoice_number, **subscription_status** (trialing|active|past_due|canceled), stripe_customer_id, stripe_subscription_id, current_period_end, **comped**, stripe_account_id, payouts_enabled, status (active|disabled).
- **clients:** name, email, phone, billing_address, billing (monthly|per_visit), notes, status.
- **properties:** client_id, address, lat, lng, **lawn_polygon** (GeoJSON), **lawn_sqft**, measured_at, notes.
- **services:** name, pricing (**hourly | per_visit | per_sqft**), rate_cents (per hour, per visit, or per 1,000 sq ft), active.
- **service_packages:** name, season, months, services (a list of services; seasonal templates like spring cleanup).
- **schedules** (recurring visits): client_id, property_id, cadence (weekly|biweekly|every_n_days|monthly), day, services or package, starts_on, ends_on, active.
- **quote_requests** (from the client portal): name, email, phone, address, note, **status** (new → contacted → quoted | declined). Its customer link puts new requests on **Today** with no new code.
- **jobs:** client_id, property_id, schedule_id, client_email (copied, for the customer link), **status** (quoted → scheduled → in_progress → done → invoiced; canceled) with **stamps** `started_at` (in_progress, first time) and `completed_at` (done), **minutes** (generated from the stamps), scheduled_for, weather_flag, quote_cents, notes.
- **job_services** (the checklist; child of jobs): service_id, name, pricing, quantity, rate_cents, amount_cents, done.
- **job_photos** (child of jobs): image, kind (before|after), on_invoice.
- **client_invoices:** client_id, client_email (copied), number, period_start, period_end, **status** (draft → ready → sent → paid; overdue; void), subtotal_cents, tax_cents, total_cents, due_on, sent_at, paid_at, portal_token_hash, reminders_sent. (Pilot Light's `invoices` feature key already means vendor invoices.)
- **invoice_lines** (child): job_id, service_date, description, quantity, unit_cents, amount_cents.
- **client_payments** (child; mapped as a `payment`): stripe payment id (with its connected account), amount_cents, status, paid_at, refunded_cents.
- **expenses:** kind (fuel|materials|equipment|mileage|other), date, amount_cents, miles, job_id, note, receipt image.

---

## 3. Architecture

```
 prospects ──▶ THIS REPO (the App's website) ◀── members' clients
               marketing · signup · Stripe Billing · client portal
               (invoices, pay via Stripe Connect, quotes, request a quote,
               Lena for customers) · owns public.* · site module · site actions
                     │ writes public.* → change triggers → ops.events (+ notifyChange)
                     ▼
 APP DATABASE   public.* members, clients, properties, jobs, invoices…   ops.* (+ member_id)
                     ▲
                     │ getBusinessDb() + MEMBER SCOPE
 PILOT LIGHT ── SaaS layer (generic): members · scope · provisioning · gates ·
                member payments · member Lena · daily add-on hook
             ── lawn_care add-on: maps · handlers · Estimator · Route · Calendar · Money
             ── existing: Manage · Today · Allow cards · Lena · notifications/push ·
                Kindling console (+ full-control Look in) · the phone app, unchanged
```

### 3A. Who sees what
| | Kindling | App admins (owner) | Member |
|---|---|---|---|
| Kindling console | ✓ | | |
| Lena's configuration (notes, rules, hand-off words, customer chat) | via Look in | ✓ | never |
| Add-ons, the App's connections | ✓ (grants) | ✓ | |
| Members list, subscriptions, usage, comp | via Look in | ✓ (Manage) | |
| Members' clients, jobs, invoices, money | via Look in | ✓ | own only |
| Lena | | ✓ | own business only |
| Their own Settings (their member record, notifications, Get paid) | | | ✓ |

### 3B. Member scope (generic, Step 6)
**The database enforces it, not each query** (design settled 2026-11-15, after studying every system that reads business data: Manage, Lena's tools, the twin, knowledge, previews and exports each write their own SQL, so a filter added by hand to each would be one forgotten query from a leak).
- **A restricted database role, `pilot_light_member`.** The business's own database user bypasses row-level security (Neon's default; checked), so policies alone would bind nothing. A member's statements run as this role instead: it doesn't bypass row-level security and can touch only the tables it's granted. Owners, assistants, the website and jobs keep using the business's user exactly as before; the policies don't apply to them.
- **A member-scoped connection** (`pilot-light/lib/db/business/member.ts`): for a member, every statement runs inside a transaction that first does `set local role pilot_light_member` and sets `pilot_light.member_id` (both transaction-local, so Postgres itself puts them back; the connections are pooled). Single statements, the driver's transactions, nested ones and Lena's READ ONLY ones are all covered, because it sits under the driver.
- **Row-level security on every member-owned table** (this repo's tables; Pilot Light's `ops` tables that hold member content): the role sees, changes and adds only rows whose member column equals the setting; a new row is stamped by a column default and can't be stamped as someone else. A table the role isn't granted is refused outright. The role, its grants and its policies exist only in SaaS businesses' databases.
- **Closed unless opened:** `getBusinessDb()` still refuses members; a page built for them asks with `getBusinessDb({ members: true })` and gets their scoped view.
- **The tripwire:** inside a member's request, opening the business database without the member's scope throws (`connectBusinessDb` reads the request's own signed session).
- Schema maps gain **`memberScope`** (the column), declared like `customerLink`; a SaaS business's map is refused unless its table has the member policy. Background work (events, the twin, knowledge, notifications, scheduled jobs) stamps the member on what it writes.
- A member's own `members` row is their Settings form (the columns they may change are granted one by one: never their subscription, comp or status).
- **Known limit:** this guards against a forgotten filter, not against arbitrary SQL run as the business's user (which could reset the role). Nothing a member or Lena does runs SQL they wrote.

### 3C. Lena
- **Global configuration** = the App business's existing Lena settings, edited by admins and inherited by every member.
- **For members:** the owner agent in a member session, her prompt naming the member's business, her tools and grounding scoped. Map-generated tools already cover creating, editing and moving lawn records through status; every change is an Allow card.
- **For clients:** `lena_customers` on the client portal, given the member's context (signed by the site) and the verified client (email code, existing).

### 3D. Reuse map: what's reused, what's net-new
| Need | Reused (Pilot Light) | Net-new | Where |
|---|---|---|---|
| Member logins + welcome email | users, invites, `inviteAndEmail`, sessions, resets, phone sign-in, push | `member` role + `member_id` | SaaS layer |
| Member isolation | getBusinessDb, maps' customer-link pattern, ESLint guards | member scope | SaaS layer |
| Signup → login | change triggers → events → handlers | the provisioning handler + SaaS site convention | SaaS layer |
| Subscription gates | the session check (`requireUser`) | reading status/comped from the member row | SaaS layer |
| Member payments | Stripe connector, site-charges/Pilot-Light-refunds model, payment maps | Connect onboarding; charging and refunding on a connected account | SaaS layer |
| Client-portal Lena | `lena_customers`, email codes, widget | member context on the widget | SaaS layer |
| Global Lena config | business-level Lena settings | hiding them from members | SaaS layer |
| Kindling full control | Look in, `SUPPORT_RETURN_COOKIE`, audit | the `kindling_admin` flag lifting look-only | Platform |
| Daily rules | the per-business daily sweep | add-ons' `daily` hook | Platform |
| App in Kindling's console | `clientReport()` lists every business | nothing | — |
| Client book, services, packages, schedules, expenses, quote requests | schema maps + Manage + Today | the maps | lawn_care |
| Job start/complete, checklist, photos, time | statuses + stamps, child records, image fields; Lena + camera in the app | the maps | lawn_care |
| Auto-invoicing, month close, reminders, recurring visits | event handlers, daily hook, add-on settings (switches) | the lawn rules | lawn_care |
| Invoice/quote/reminder emails | site actions, `siteEmailHeaders`, SendGrid | the three actions | this repo |
| Estimator, route, calendar, money | add-on `pages`, shared UI | those four pages | lawn_care |
| Weather | rule-proposed Allow cards, notifications | NWS check | lawn_care |
| Marketing, signup, Billing, portal | site conventions, site module | the pages | this repo |
| Phone & offline | the Pilot Light app; `useOffline` | nothing | — |

### 3E. AI vs. deterministic
| Area | Deterministic | AI only for |
|---|---|---|
| Jobs, invoicing, reminders, recurring visits, profit, tax rate, provisioning, gates | Everything | Nothing |
| Estimator, route, weather | Math, API results, fixed rules | Nothing |
| Lena (members, admins, clients) | Tools, simulation, Allow cards, verification, identity | Understanding requests; grounded answers |

### 3F. Brand
**Forest & Stone:** forest `#2B4A34`, forest-deep `#1C3323`, forest-soft `#D9E2D2`; tan `#B8A17E`, tan-deep `#9A835F`, tan-soft `#EADFC9`; moss `#8A9A5B`, moss-deep `#6E7D43`; cream `#F1EDE1`, paper `#F8F5EC`, charcoal `#282722`, ash `#4E4C44`, stone `#837E72`, bone `#EFEBE0`, border `#E4DCCB`, ink `#0E1A12`. **Fonts:** Zilla Slab (headings, wordmark), Caveat (accents, sparingly), Nunito Sans (body). **Elements:** pill buttons that press into a hard offset shadow, `.card` / `.card-sign`, `.badge`, `.eyebrow`, `.script-accent`, `.divider-leaf`, `.mow-stripes-dark`, `Logo`, `GrassEdge`, `MownLawn`, entrance animations with reduced motion. Exposed as the site-convention theme variables so Pilot Light's members' dashboard wears it.

---

## 4. Build steps (25 steps, Phases 0–6)

### Phase 0: Foundation
**Step 1: Brand foundation (this repo).** Read the Next 16 docs. Put the brand into this repo: tokens, classes, fonts, `Logo`, `GrassEdge`, `MownLawn`, nav and footer; add the site-convention theme variables; replace the starter page. Wordmark uses the placeholder until M6.

**Step 2: Env, database layer & SETUP.md (this repo).** Drizzle + Neon (Pilot Light's versions and `lib/db` pattern), zod, `lib/env.ts` with gate-named errors, `.env.example`, `SETUP.md`, `.claude/launch.json`.

**Step 3: The App's schema (this repo).** Section 2C as Drizzle schema + migrations; a dev seed with **two test members** and believable data for each.

> **⚠️ MANUAL GATE (M1): The App's database.**
> 1. <https://vercel.com/dashboard> (team selected) → **Storage** → **Create Database** → **Neon** → **Continue**.
> 2. Region **Washington, D.C., USA (iad1)**; name `lawn-care-app-db` → **Create**. Skip connecting a project (M3 does).
> 3. **.env.local** tab → **Show secret** → copy the pooled `DATABASE_URL` and the direct `DATABASE_URL_UNPOOLED` into this repo's `.env.local` (pasting Vercel's block as it is works; the older name `POSTGRES_URL_NON_POOLING` works too).
> 4. Tell Claude; Claude runs the migrations and seed.
>
> ☑ once the migrations and seed run.

**Step 4: The App in Pilot Light.** Claude runs Pilot Light's CLI: `business:create`, `db:register` (the `ops` migrations), `theme:import`. Confirm the App shows in Kindling's console.

> **⚠️ MANUAL GATE (M2): The App's admin login (test email).**
> 1. Give Claude a test email you can receive.
> 2. Claude sends the owner invite (`invite:create`, emailed by Pilot Light).
> 3. Open the link, agree to the terms, set a password.
>
> ☑ once you can sign in as the App's admin.

> **⚠️ MANUAL GATE (M3): Connect this site, at its Vercel address.** The live Pilot Light health-checks every connected site and can't reach `localhost`, so the site is connected at a real address: its free `*.vercel.app` address now (user decision, 2026-11-15; Luzerne Express is connected the same way), the custom domain at M9.
> 1. Push this repo (the user commits and pushes) → <https://vercel.com/new> → import it.
> 2. Vercel → **Storage** → `lawn-care-app-db` → **Connect Project** → this project, all environments → **Redeploy**. Note the `*.vercel.app` address.
> 3. Claude runs `npm run site:connect -- --business lawn-care-app --url https://<address>.vercel.app` in Pilot Light; it prints `PILOT_LIGHT_URL`, `PILOT_LIGHT_BUSINESS_ID`, `PILOT_LIGHT_SITE_SECRET`.
> 4. Put them in this repo's `.env.local` and the Vercel project's env vars (the secret marked **Sensitive**); never in chat. Claude copies the site module into `lib/pilot-light/` and its route (with your OK); the user commits and pushes (redeploy).
> 5. Claude runs `npm run site:check -- --business lawn-care-app`.
>
> ☑ once the check passes.

**Checkpoint 0:** this site runs locally in the brand; the App database is migrated, seeded and registered; the App is in Kindling's console; the admin signs in.

### Phase 1: Pilot Light for SaaS products (generic)
**Step 5: SaaS businesses & members.** Master migration (2A). The `member` role and `member_id`; member invites; members don't count toward the owner/assistant limit. The member's navigation: Today, Manage (only member-facing add-ons), Lena, Settings (their own member record + notifications). Hidden from members: Add-ons, Connections, every Lena-level setting, Kindling pages. `business:saas` CLI command sets the flag.

**Step 6: Member scope.** Section 3B, in six parts, each built, tested and reported before the next:
- **6a: The member-scoped connection and the tripwire** (Pilot Light).
- **6b: The App's tables** (this repo's migration): row-level security on all 14, member-stamping defaults, the role's grants (column by column on `members`); the role itself made by a Pilot Light command for SaaS businesses; a SaaS rule in the site conventions so every future SaaS app does the same.
- **6c: Pilot Light's `ops` tables:** `member_id` where a table holds member content (additive, every business database), and, in SaaS businesses' databases only, the role's grants and policies: business-wide pieces (Lena's notes and rules) readable, admin-only pieces (the mailbox, errors) not granted at all. **Proven on a scratch database, then the demo, then the App; the user is asked before it reaches client databases.**
- **6d: Background work** stamps the member on what it writes (events, the twin, knowledge, notifications, scheduled jobs); maps' `memberScope`, and a SaaS map refused without its table's policy.
- **6e: Member pages open:** Today, Activity, Manage, Lena's chat (naming their business), notifications, the phone app and uploads.
- **6f: Isolation test** with both test members: pages, addresses, search, Today, Lena, notifications, exports, tampered forms. (Needs the App's tables mapped: that core of Step 10 is done right after 6e.)

**Step 7: Provisioning & subscription gates.** A platform handler for SaaS businesses: a new or changed member row → create, update or disable the member's login and send the **welcome (invite) email** through `inviteAndEmail`. The session check reads the member's status, `subscription_status` and `comped` → full, banner, or read-only. A **Billing** link to the site's billing page. Written up as a **SaaS section in `docs/site-conventions.md`** (the members table and its required fields, the scope column, the billing page) plus site-module helpers, so any future SaaS site follows it.

**Step 8: Daily add-on hook.** Add-on modules gain a `daily` handler, run for each business in the existing daily sweep (`lib/events/run.ts`): deterministic, only while the add-on is on, safe to repeat.

**Step 9: Kindling full control (security-critical).** On a `kindling_admin` business, Kindling's **Look in** opens a full-control owner session instead of look-only, with a banner; **End** restores Kindling's sign-in (`SUPPORT_RETURN_COOKIE`). The protections, all required:
- **No web path to the switch.** Only `npm run business:kindling-admin` (CLI, direct database access) sets or clears it; no page, form, server action or API route reads input that could change it, enforced by an ESLint rule as Pilot Light does for other dangerous imports.
- **The server decides, every request.** The session token only says "Kindling support"; whether it's full control is re-read from the master database on each request (`requireUser` and `proxy.ts`), so a tampered cookie or token gains nothing, and clearing the switch drops every open session back to look-only at once.
- **Only Kindling can start it.** Only from Kindling's own console, signed in as Kindling's owner (`requireKindling()`: other businesses, assistants and support sessions refused), through the existing one-time link (SHA-256 stored, single use, 10 minutes).
- **Signed, short, logged.** Signed with `AUTH_SECRET` like every session; one hour; every start, end and change it makes recorded in `platform_audit`.

**Checkpoint 1:** writing a member row (by script) sends a welcome email and that member signs in; two members can't see each other anywhere; a canceled test member is read-only; a comped one has full access; Kindling looks into the App with full control and back out; the same Look in on a client website stays look-only; a forged or tampered session, a non-Kindling owner, and an attempt to set the switch from the web are all refused; clearing the switch drops an open session to look-only.

### Phase 2: The `lawn_care` add-on (Pilot Light)
**Step 10: Module, maps & grant.** `lib/addons/lawn_care/` (catalog entry, feature keys for every Section 2C resource, settings: auto-invoice on/off, month-end close, reminders cadence, weather warnings on/off), schema maps with `memberScope` (statuses, transitions, stamps, child records, image fields, payments, customer links, search, filters), granted to the App. Result with no further code: Manage for every lawn record, Today for new quote requests, Lena tools for all of it, job start/complete by status with stamped times on the phone dashboard and through Lena in the app (photos via the app's camera to Lena).

**Step 11: Lawn rules.** Event handler: a job reaching **done** adds its lines to the client's open invoice (monthly) or a new one (per visit). Daily hook: recurring visits create the coming jobs; on the period's end, open monthly invoices close to **ready** (Today: "Review and send"); overdue invoices are marked and queued for reminders. All switched on per member in the add-on's settings.

**Checkpoint 2:** a test member's recurring clients get jobs; a job runs from Start to Complete from a phone and through Lena; a month of jobs becomes ready invoices; nothing crosses members.

### Phase 3: Customer-facing & member payments
**Step 12: Site actions (this repo).** `invoice-send`, `quote-send`, `invoice-remind`, declared with `site:actions`: each emails the client in the member's branding (logo, business name) with a client-portal link, via SendGrid with `siteEmailHeaders`, Reply-To the member. "Send all ready" is one batch Allow card.

> **⚠️ MANUAL GATE (M4): Stripe for the App (test mode).**
> 1. <https://dashboard.stripe.com> → a new account for the App → stay in **Test mode**.
> 2. **Connect → Get started** → platform → **Express** accounts.
> 3. **Developers → API keys** → secret key; **Webhooks** → endpoints Claude gives you (locally signed test events until M9).
> 4. Keys into this repo's `.env.local`; Claude connects the same account as the App business's Stripe connection in Pilot Light (`stripe:connect`).
>
> ☑ once a test member connects an Express account.

**Step 13: Member payments (generic).** Members connect their own Stripe from Settings (Express onboarding); a site-module helper charges on a member's connected account; Pilot Light's Stripe connector refunds on it (Allow cards); payment webhooks → events → invoice paid.

**Step 14: Client portal (this repo).** Invoice (view, pay, print), quote (view), request a quote (→ `quote_requests` → Today), all in the member's branding over the App's brand; `<LenaForCustomers />` with the member's context.

**Checkpoint 3:** invoices go out by email; a client opens one, pays by card in test mode, and the invoice turns paid in Pilot Light; a quote request lands on the right member's Today; the client's Lena answers from that member's records only.

### Phase 4: Field tools (`lawn_care` pages)
> **⚠️ MANUAL GATE (M5): Google Maps Platform keys.**
> 1. <https://console.cloud.google.com> → a project for the App → **Billing** (with a budget alert).
> 2. **APIs & Services → Library:** enable **Maps JavaScript API**, **Geocoding API**, **Routes API**.
> 3. **Credentials → Create API key** twice: a browser key restricted to Pilot Light's address (Maps JavaScript), a server key restricted to Geocoding + Routes.
> 4. Into Pilot Light's `.env.local` as `GOOGLE_MAPS_BROWSER_KEY` / `GOOGLE_MAPS_SERVER_KEY`.
>
> ☑ once an address geocodes and the map loads.

**Step 15: Estimator.** Addresses geocoded on save (event handler). **Estimator** page: satellite map → draw the lawn (Terra Draw; several shapes, cut-outs for beds and the house) → square feet → × the member's per-sq-ft prices → a quoted job; the drawing and square feet saved to the property.

**Step 16: Route.** **Route** page: the day's jobs ordered by drive time (Routes API), list + map, one tap opens the next stop in the phone's maps.

**Step 17: Weather.** Daily hook: NWS forecast per scheduled job; rain risk flagged on the job; a rule-proposed **"move to the next dry day"** Allow card; a notification.

**Step 18: Calendar.** **Calendar** page: jobs by day, week and month, including the coming recurring visits; open any to change it.

**Step 19: Money.** **Money** page: revenue, expenses, mileage and profit per job, client and month; average time per client and service; the tax rate per open question (a).

**Checkpoint 4:** a new lawn measured from satellite becomes a quote; a day's route is ordered; a rainy day gets a move card the member allows; the calendar and Money page are right for each test member.

### Phase 5: Marketing & signup (this repo)
> **⚠️ MANUAL GATE (M6): Name & domain.** Choose the product name and buy the domain; tell Claude both. Claude updates the wordmark, metadata, emails and this plan.
>
> ☑ once chosen and owned.

**Step 20: Marketing site.** Home, Features, How it works, Pricing (placeholders until M10), FAQ, Sign up; the premium Pilot Light-powered story in the brand; SEO; mobile-first.

**Step 21: Signup & subscriptions.** Sign up → Stripe Checkout (subscription; **prices from env, placeholders until M10**) → webhook writes the member row → Step 7 provisions the login and sends the welcome email. The **billing page** opens Stripe's Customer Portal; webhooks keep `subscription_status` current.

**Checkpoint 5:** a stranger signs up in test mode, gets the welcome email, sets a password and is working; a canceled subscription turns read-only; a comped member is unaffected.

### Phase 6: Launch
**Step 22: Audit.** Duplication against Pilot Light (rule 1); the generic check on every SaaS-layer change (rule 2); member isolation and security on both repos, including a deliberate attack on the full-control switch (Step 9's protections, each tried); a click-through at phone and computer widths, including the Pilot Light app.

> **⚠️ MANUAL GATE (M7): Terms & Privacy.** Claude drafts Terms of Service and a Privacy Policy covering members and their clients' data (from Pilot Light's legal pages); the user approves (a lawyer's look is recommended).
>
> ☑ once approved.

**Step 23: Legal pages.** Terms and Privacy on the site; agreement recorded through the invite's terms acceptance.

**Step 23a: Kindling's site: the "Pilot Light for SaaS" plan (user request, 2026-11-15).** A third monthly plan on kindlingdigital.org (`/Users/christopherneisen/Desktop/Kindling-Digital-Website`), beside **Brand in a Box** ($100/month) and **Business in a Box** ($300/month), titled **"Pilot Light for SaaS"**: everything in Brand in a Box and Business in a Box, designed for SaaS products. What it adds is Pilot Light's SaaS layer (Phase 1): your product's own members, each with their own login, running their business inside it; one Lena configuration you set for every member, each member's Lena knowing only their own business; subscriptions and payment gates for your members; your members getting paid by their own customers (Stripe Connect); a marketing and signup site. **One plan, three tiers inside it (user decision, 2026-11-15):**

| Tier (working name) | Price | Members included |
|---|---|---|
| Launch | **$600/month** | up to 25 |
| Growth | **$800/month** | up to 50 |
| Scale | **$1,000/month** | up to 100 |

Each tier includes its members' Lena usage. Like every Pilot Light plan, nothing is unlimited: a member past the tier's limit means the next tier up, and past 100 members Kindling quotes it. Where it changes: the `plans` list on `app/pricing/page.tsx` gains a third plan card, "Pilot Light for SaaS", that shows its three tiers **inside the card** (Brand in a Box and Business in a Box keep their single price), plus everywhere else the plans are named (home page, Services, the Pilot Light page, FAQ, site metadata). The card's exact wording and the tier names are settled with the user before anything changes. The same plan goes into Pilot Light's own `plan.md` Section 9 (pricing), whose rule is that kindlingdigital.org always matches it. Claude never commits in that repo either.

> **⚠️ MANUAL GATE (M8): Sending domain.** Claude runs Pilot Light's `email:domain` for the App's domain; add the DNS records it prints at the registrar; Claude verifies.
>
> ☑ once a test invoice arrives from the App's domain.

> **⚠️ MANUAL GATE (M9): The custom domain.** The Vercel project exists since M3. **Settings → Domains** → the domain (M6) with its DNS → Claude runs `site:connect --url https://<domain>` (moves the site; its new secret goes into Vercel) → point Stripe's webhooks at the domain; check every env var is in Vercel.
>
> ☑ once the site loads on its domain and `site:check` passes.

> **⚠️ MANUAL GATE (M10): Prices.** In Stripe: **Product catalog → Add product** → the plan(s) and recurring prices → give Claude the price IDs.
>
> ☑ once the Pricing page and Checkout show them.

> **⚠️ MANUAL GATE (M11): Stripe live.** **Activate account** (business details, bank, identity), live Connect, live webhooks; live keys straight into Vercel env vars (never in chat).
>
> ☑ once a real small subscription and a real client payment succeed.

**Step 24: Go-live.** This site live on its domain; Pilot Light deployed with the SaaS layer and `lawn_care`; the admin login moved from the test email to the real one; signups open.

**Checkpoint 6:** live signup, live payment, live welcome email; the App in Kindling's console.

---

## 5. External services

| Service | Use | Cost | Gate |
|---|---|---|---|
| Pilot Light (existing) | Everything behind a sign-in, Lena, events, invites, push, the phone app | Running | — |
| Neon via Vercel Storage | The App's database | Your plan | M1 |
| Vercel | This site | Your plan | M3, M9 |
| Stripe | Billing (subscriptions) + Connect (member payments) | Per transaction | M4, M10, M11 |
| Google Maps Platform | Satellite map, geocoding, routes | Usage, budget-capped | M5 |
| National Weather Service | Forecasts | Free | — |
| SendGrid (existing) | Welcome, invoice, quote, reminder emails | By volume | M8 |
| UploadThing, OpenAI, Expo, Apple (existing) | Photos, Lena, phone app | Existing | — |

**Env (this repo):** `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (or `POSTGRES_URL_NON_POOLING`), `PILOT_LIGHT_URL`, `PILOT_LIGHT_BUSINESS_ID`, `PILOT_LIGHT_SITE_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_PRICE_IDS` (M10), `SENDGRID_API_KEY`, `APP_URL`. **Pilot Light adds:** `GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_MAPS_SERVER_KEY`.

---

## 6. Progress Tracker

**Status key:** ☐ not started · ◐ in progress · ☑ done

**Current phase:** Phase 0 complete (2026-11-15). Phase 1 in progress: Steps 5, 6a, 6b and 6c done (2026-11-15). Next: 6d. `npm run db:check` proves member scope: run it after every migration. Testing is local first: this site and the local Pilot Light use the same database; a push is only for checks that need the live address. Plan redrawn from scratch 2026-11-15 (generic SaaS layer, no phone-app work). Member naming, member logins, admin visibility and Stripe Connect confirmed (Square not planned). Full-control switch confirmed with hardened rules (Step 9); Stripe Connect is new work, accepted. Open: question (a) (tax rate), needed before Step 19.

| Step | Description | Status | Notes |
|---|---|---|---|
| 1 | Brand foundation | ☑ | Read Next 16 fonts/CSS/metadata/caching docs first. `app/globals.css`: the brand's tokens and classes, plus the site-convention theme block (all 18 variables; every text pair checked ≥4.5:1: muted = `--ash` 7.4 (`--stone` is 3.5, kept for large text only), brand-soft text = `--forest` 7.4 (moss-deep is 3.4)). `components/`: `Logo`, `GrassEdge`, `MownLawn`, `Navigation`, `Footer`, content from `lib/site.ts` (the placeholder name, one place until M6; menu empty until Step 20, so no menu button and no dead links). Layout: Zilla Slab, Caveat, Nunito Sans; metadata + theme color. Starter page replaced by a branded placeholder home (hero, dark mown band with sign cards, striped lawn), no buttons yet. **Found and fixed:** Cache Components refuses a bare `new Date()` in prerender, so the footer's year is a cached component (`'use cache'` + `cacheLife('days')`). Verified: tsc, lint, `next build` clean (home static, revalidates daily); in the browser at desktop and 375px: no console errors, no sideways scroll, all 18 theme variables resolve, fonts resolve to their Google Fonts names (`theme:import` can read them; Pilot Light's validator accepts the minifier's 8-digit hex shadow). **Port:** local Pilot Light holds 3000, so this site runs on **3001** (`dev` script + launch.json). **For Step 20:** the brand's small decorative text is under 4.5:1 (eyebrow moss-deep on cream 3.8, tan-deep accents 3.1, badge moss-deep on sage 3.4); fine as accents, but don't use them for anything people must read |
| 2 | Env, database layer & SETUP.md | ☑ | Followed Kindling's client-site pattern (a site that owns its schema) + Pilot Light's env pattern; versions matched to them: `drizzle-orm` ^0.45.4, `@neondatabase/serverless` ^1.2.1, `ws` ^8.23, `zod` ^4.6.7, `server-only`; dev `drizzle-kit` ^0.31.11, `dotenv` ^18, `@types/ws`. `lib/db/index.ts` (server-only; Neon serverless Pool over WebSockets so transactions work; URL through `lib/env.ts`), `lib/db/schema.ts` (empty until Step 3), `drizzle.config.ts` (loads `.env.local`, migrates over the direct connection, `out: drizzle/`, strict; the one direct `process.env` reader). Scripts: `db:generate`, `db:migrate`, `db:studio`, `vercel-build` (migrate, then build), `start` on 3001. `lib/env.ts`: zod, every key optional at load (blank = unset), `getDatabaseUrl()` fails naming gate M1 (missing, or not a Postgres URL), `configured.database()`; only M1's variables now, each later step adds its own. `.env.example` (committed: `!.env.example` in `.gitignore`) + blank `.env.local` (ignored). `SETUP.md`: prerequisites, install, env, database commands, run on 3001, deploy, all 11 gates with full steps (same text as here). `.claude/launch.json` was done in Step 1. Verified: tsc, lint, build clean; drizzle-kit with no URL stops with the M1 message; `getDatabaseUrl()` missing → "Complete gate M1", malformed → "not a Postgres connection string", valid → returned; `.env.example` tracked, `.env.local` ignored. `npm audit`: **0 in production dependencies**; 11 moderate in dev-only tools (esbuild inside drizzle-kit, minimatch inside eslint-config-next), left as is (the forced fix downgrades them) |
| 3 | The App's schema | ☑ | `lib/db/schema.ts`: all 14 Section 2C tables, 12 status enums, money in cents, rates in basis points, check constraints. **Two foreign keys on every link between member-owned records:** a single-column one (Pilot Light's schema reader only reads those) and a composite one with `member_id` (16 of them), so the database itself refuses cross-member links. A member is never cascade-deleted; a job's checklist/photos and an invoice's lines go with it; payments never cascade; a used service can't be deleted, only switched off. `jobs.minutes` is a generated column from the `started_at`/`completed_at` stamps. Added to 2C while building: `members.timezone`, `jobs.quote_request_id`, `jobs.weather_note` (instead of a flag), `client_invoices.tax_rate_bp` (kept with the invoice) and `last_reminder_at`, `client_payments.stripe_account_id`. Migration `drizzle/0000_init_app_schema.sql` (reviewed: no destructive statements). `scripts/seed.ts` (`npm run db:seed`, tsx): two test members (Green Acres: active, monthly; Northwoods: comped, per visit, 6% tax), touching only their two fixed ids, one transaction, dates relative to today. The direct connection is read as `DATABASE_URL_UNPOOLED` (Vercel's name) or `POSTGRES_URL_NON_POOLING`. Verified on the real database: every invoice's lines, tax and total add up; paid invoices equal their payments; job statuses match their invoices; minutes match the stamps; checklist amounts match each member's pricing; **0 cross-member links**; every invoice state present for both members; seed re-runs identically; **a direct insert of one member's job onto another member's client is refused by the database** (`jobs_member_client_fk`). Note: weekends have no visits, so a job in progress only appears in weekday seeds |
| - | ⚠️ M1 The App's database | ☑ | `lawn-care-app-db` (Neon, Vercel Storage, iad1, PostgreSQL 18.7); pooled + direct URLs in `.env.local` (Vercel's block pasted as is) |
| 4 | The App in Pilot Light | ☑ | `business:create` → "Lawn Care App" (`lawn-care-app`, America/Detroit, status setup, Lena + Sync & Guard); `db:register` → the App database registered (pooled), `ops` schema v27 (+27), add-ons synced; the App's `public` tables and seed untouched (14 tables, 2 members). `theme:import --url http://localhost:3001` → saved, every pair readable, Nunito Sans / Zilla Slab. **Found and fixed:** the minifier ships `0.875rem` as `.875rem`, which theme:import refuses, so `--radius-field` is `14px`. The App appears in Kindling's clients report (`clientReport()`, the console's source). M2 and M3 done (below). Learned: the live health checks don't skip a `localhost` site, so a site is connected at a public address (here its `*.vercel.app`, user decision) |
| - | ⚠️ M2 Admin login (test email) | ☑ | Owner invite to the test email `chris+lawn@kindlingdigital.org` (run in the user's terminal, so the link never entered the chat); accepted, signed in 2026-11-15. Moves to the real admin email at go-live |
| - | ⚠️ M3 Connect this site | ☑ | Vercel project created by the user; first deploy failed (no database env on Vercel) → `lawn-care-app-db` connected to the project, redeployed: live at `https://lawn-care-app-xi.vercel.app` (200, no redirect). `site:connect` run in the user's terminal (the secret never entered the chat): connected, then "degraded" until the site module answers its ping. The user put the three values in `.env.local` and Vercel. Site module installed: `lib/pilot-light/` copied unchanged (11 files, module 2026-10-17, `diff -r` identical) + `app/api/pilot-light/[action]/route.ts` (`pilotLightRoute({})`, ping built in); `.env.example` documents the three names. Verified locally: tsc, lint, build (the route is dynamic); a ping signed like Pilot Light's → 200 `connected`, module 2026-10-17; unsigned → 401; wrong secret → 401. The user pushed; `site:check` → "answered in 697ms. Signatures match. Site module 2026-10-17 (current)"; the connection is `connected`, no errors |
| - | Checkpoint 0 | ☑ | 2026-11-15: the site runs locally (and at its vercel.app address) in the brand; the App database migrated, seeded (two test members) and registered (`ops` v27); the App in Kindling's console with its site `connected` and its admin login `active` |
| 5 | SaaS businesses & members | ☑ | Pilot Light, generic. Logged in full in Pilot Light's `plan.md` §11. **Members are closed by default:** `requireUser()` answers "not found" to a member unless a page opens to them (`{ members: true }`); the phone API, uploads and jobs refuse members the same way; production already rejected the unknown role before deploy. Master migration `0020_saas_members` applied (additive). The App is a SaaS business (`business:saas`). Test member: `green-acres@example.com` for seed member Green Acres (password in Claude's private scratch file; reset it with `password:reset` if needed). Verified locally: member menu Today · Activity · Manage · Settings + Lena; Settings = account only; every admin page "not found" for the member; phone sign-in refused; the owner's view unchanged. Disable the test member before go-live |
| 6a | Member-scoped connection & tripwire | ☑ | Pilot Light, generic (its `plan.md` §11 has the full note). **Found first:** the App's database user bypasses row-level security (`rolbypassrls`), so members run as a restricted role, `pilot_light_member`, switched to inside each transaction (stronger than policies alone; owners untouched). `lib/db/business/member.ts` + `connectBusinessDb(id, { member })` + `getBusinessDb({ members: true })` + the tripwire. Proven on a scratch database (made and removed, with the test role) over the pooled and the direct connection, 24 checks each: own rows only, stamping, forged ids refused by the database, ungranted tables refused, transactions (nested, READ ONLY) scoped, a failed one leaves nothing, 90 interleaved queries on 2 shared connections with no leak either way, a scope that can't be set refuses the statement, no connection lost. In a real member request (local): the whole database by id → tripwire; `getBusinessDb()` → not found; the members' way → refused until 6b makes the role. Owner: unchanged. Temporary script and route removed |
| 6b | The App's tables: row-level security | ☑ | **In this repo (2026-11-15):** `drizzle/0001_member_scope.sql` (custom, applied): the role `pilot_light_member` (kept if there; usable by the database's user), row-level security + the `member_scope` policy on all 14 tables, the member stamp (column default) on 13, grants (payments read-only; `members`: select + update of 12 safe columns only, never email, subscription, comp, payouts, status). `scripts/check-member-scope.ts` (`npm run db:check`, changes nothing): reads the live rules and attacks as each of two members; **152 checks pass**; proven to fail on a table granted without a policy and on an extra allow-everything policy (both made and removed). **In Pilot Light (generic):** `lib/db/business/member-role.ts` (`ensureMemberRole`, `memberScopeReport`); `business:saas` now prepares the role and **refuses a business whose members could reach anything without row-level security and a policy** (proven: a bare-granted table and a view, made and removed, both named and refused); the rule written into `docs/site-conventions.md` §8 (the role, the setting, the four statements per table, never a grant without a policy, no views, no TRUNCATE, the second foreign key). **End to end through Pilot Light's real member connection on the App's tables:** each member runs as the role and sees one member (themself); the two members' clients, jobs, invoices, payments and expenses add up exactly to the owner's (7+6=13, 45+29=74, 15+16=31, 4+8=12, 11+11=22); a new client is stamped as theirs; forging a member, changing a payment, comping themself and reading `ops` are refused. The site's own writes are unaffected (seed re-run, `db:check` again: holds). tsc, lint, build clean on both repos. `db:seed` and `db:check` documented in SETUP.md; the schema file says what a new table needs |
| 6c | Pilot Light's `ops` tables | ☑ | **2026-11-15** (Pilot Light, generic; its `plan.md` §11 has the full note). `member_id` on the 15 `ops` tables that hold members' content (ops migration 0027: additive, columns only, existing rows stay the business's); in a SaaS business's database only, each of Pilot Light's 28 tables is members' own rows (15), the business's shared setup, read-only (6), or the business's alone (7), enforced by row-level security and applied by `business:saas` and after every `ops:migrate`. **Proven:** 232 checks on a scratch database (removed); applied to the demo (nothing but the columns) and to the App (21 tables opened to members). **In this repo:** `npm run db:check` now also reads and attacks Pilot Light's own tables as both members (284 checks; shown to fail on a weakened policy, which `ops:migrate` then put back). **Client databases (the user's go, 2026-11-15):** the columns applied to all four, one at a time; every business database is at `ops` version 28, with no row-level security outside the App and no row carrying a member. |
| 6d | Background work & maps' `memberScope` | ☐ | Pilot Light, generic |
| 6e | Member pages open | ☐ | Pilot Light, generic |
| 6f | Isolation test | ☐ | After the core of Step 10 |
| 7 | Provisioning & subscription gates | ☐ | Pilot Light, generic |
| 8 | Daily add-on hook | ☐ | Pilot Light, platform |
| 9 | Kindling full control | ☐ | Pilot Light, platform |
| - | Checkpoint 1 | ☐ | |
| 10 | `lawn_care` module, maps & grant | ☐ | |
| 11 | Lawn rules | ☐ | |
| - | Checkpoint 2 | ☐ | |
| 12 | Site actions | ☐ | This repo |
| - | ⚠️ M4 Stripe (test) | ☐ | |
| 13 | Member payments | ☐ | Pilot Light, generic |
| 14 | Client portal | ☐ | This repo |
| - | Checkpoint 3 | ☐ | |
| - | ⚠️ M5 Google Maps keys | ☐ | |
| 15 | Estimator | ☐ | |
| 16 | Route | ☐ | |
| 17 | Weather | ☐ | |
| 18 | Calendar | ☐ | |
| 19 | Money | ☐ | Needs open question (a) |
| - | Checkpoint 4 | ☐ | |
| - | ⚠️ M6 Name & domain | ☐ | |
| 20 | Marketing site | ☐ | This repo |
| 21 | Signup & subscriptions | ☐ | This repo |
| - | Checkpoint 5 | ☐ | |
| 22 | Audit | ☐ | Both repos |
| - | ⚠️ M7 Terms & Privacy | ☐ | |
| 23 | Legal pages | ☐ | |
| 23a | Kindling's site: "Pilot Light for SaaS" plan | ☐ | Added 2026-11-15 (user request). One plan, three tiers inside its card: $600 / $800 / $1,000 a month for up to 25 / 50 / 100 members |
| - | ⚠️ M8 Sending domain | ☐ | |
| - | ⚠️ M9 The custom domain | ☐ | The Vercel project was created at M3 |
| - | ⚠️ M10 Prices | ☐ | |
| - | ⚠️ M11 Stripe live | ☐ | |
| 24 | Go-live | ☐ | |
| - | Checkpoint 6 | ☐ | |

---

## 7. Maintenance rules
- **Reuse first:** never copy Pilot Light code here or build a second version of anything it does; keep Section 3D current.
- **Generic SaaS layer:** Pilot Light's SaaS code never names this App's features; run the "second SaaS app" check on every change to it.
- **Member scope** on every query, tool, page, email and export; re-run the two-member isolation check at every checkpoint.
- **No phone-app changes.** If a need seems to require one, stop and ask.
- **Lena never writes.**
- **Customer-facing = website; admin = Pilot Light.**
- **Never commit or push.** After each step, say it's ready to commit (per repo) and suggest a message.
- After each step: mark ☑, add a note, update **Current phase**; log Pilot Light steps in Pilot Light's `plan.md` too.
- At each ⚠️ gate: walk the user through it; ☑ only when confirmed.
- If a decision changes, update Section 0. Keep this file for the life of the project.
