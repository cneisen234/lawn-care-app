// The App database's `public` schema (plan.md Section 2C). This repo owns these
// tables and their migrations; Pilot Light manages the data through schema maps
// (it edits data, never structure) and the site reads it.
//
// Conventions:
//  - UUID ids, timestamps with time zone, money in whole cents, rates in basis
//    points (100 = 1%). Statuses are Postgres enums (Pilot Light's maps check
//    their values).
//  - MEMBER SCOPE: every table except `members` has `member_id`. The `members`
//    row's own `id` is its scope. The DATABASE enforces it for members
//    (drizzle/0001_member_scope.sql): Pilot Light runs a member's statements as
//    the restricted role `pilot_light_member`, for which row-level security
//    shows, changes and accepts only that member's rows, and a column default
//    stamps their new rows. This site's own user isn't bound by those policies,
//    so the site ALWAYS names the member it writes for (`memberId` stays
//    required here). A NEW TABLE needs the same four statements in its
//    migration before a member can reach it (pilot-light/docs/site-conventions.md
//    §8), and `npm run db:check` proves it.
//  - Two foreign keys on every link between member-owned records:
//      1. a single-column key (e.g. job.client_id → clients.id), which is what
//         Pilot Light's schema reader uses to see how records link;
//      2. a composite key that includes member_id (e.g. (member_id, client_id)
//         → clients(member_id, id)), so the DATABASE itself refuses to attach
//         one member's record to another member's, even if code has a bug.
//         Defense in depth behind Pilot Light's member scope (plan.md 3B).
//  - Deleting a member never cascades (restrict): a member's business is only
//    removed on purpose. A record's own parts (a job's checklist and photos,
//    an invoice's lines) go with it; money records (payments) never cascade.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ---- Enums ----

export const memberStatus = pgEnum("member_status", ["active", "disabled"]);
export const subscriptionStatus = pgEnum("subscription_status", ["trialing", "active", "past_due", "canceled"]);
/** How a client is billed: everything in a month on one invoice, or an invoice per visit. */
export const billingCadence = pgEnum("billing_cadence", ["monthly", "per_visit"]);
export const clientStatus = pgEnum("client_status", ["active", "archived"]);
/** hourly: rate per hour; per_visit: rate per visit; per_sqft: rate per 1,000 sq ft. */
export const servicePricing = pgEnum("service_pricing", ["hourly", "per_visit", "per_sqft"]);
export const scheduleCadence = pgEnum("schedule_cadence", ["weekly", "biweekly", "every_n_days", "monthly"]);
export const quoteRequestStatus = pgEnum("quote_request_status", ["new", "contacted", "quoted", "declined"]);
export const jobStatus = pgEnum("job_status", ["quoted", "scheduled", "in_progress", "done", "invoiced", "canceled"]);
export const photoKind = pgEnum("photo_kind", ["before", "after"]);
export const invoiceStatus = pgEnum("invoice_status", ["draft", "ready", "sent", "overdue", "paid", "void"]);
// voided: a payment recorded by hand and taken back (entered by mistake); it no longer counts. Never a card payment.
export const paymentStatus = pgEnum("payment_status", ["pending", "succeeded", "failed", "refunded", "voided"]);
/** How a payment recorded by hand came in (cash, a check…). A card payment (Stripe) has none. */
export const paymentMethod = pgEnum("payment_method", ["cash", "check", "bank_transfer", "other"]);
export const expenseKind = pgEnum("expense_kind", ["fuel", "materials", "equipment", "mileage", "other"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---- Members (the SaaS layer's members: here, lawn-care operators) ----

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name"),
    /** Their sign-in email (stored lowercase); Pilot Light's member login uses it. */
    email: text("email").notNull(),
    phone: text("phone"),
    address: text("address"),
    /** Their logo for invoices and the client portal (UploadThing: the image and its storage key). */
    logoUrl: text("logo_url"),
    logoKey: text("logo_key"),
    /** IANA timezone for their day: schedules, weather checks and month-end run on their clock. */
    timezone: text("timezone").notNull().default("America/Detroit"),
    /** The tax rate they enter themselves, in basis points (plan.md open question (a) decides how it's applied). */
    taxRateBp: integer("tax_rate_bp").notNull().default(0),
    /** What they count a mile as, for mileage expenses. */
    mileageRateCents: integer("mileage_rate_cents").notNull().default(0),
    /** A new client's billing unless the client says otherwise. */
    defaultBilling: billingCadence("default_billing").notNull().default("monthly"),
    invoiceDueDays: integer("invoice_due_days").notNull().default(15),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1001),
    // Subscription to the App (Stripe Billing, on this site).
    subscriptionStatus: subscriptionStatus("subscription_status").notNull().default("trialing"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    /** Free: no subscription needed (billing is skipped, access is full). */
    comped: boolean("comped").notNull().default(false),
    // Getting paid by their clients (Stripe Connect, Express).
    stripeAccountId: text("stripe_account_id"),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    status: memberStatus("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    unique("members_email_key").on(t.email),
    check("members_tax_rate_range", sql`${t.taxRateBp} between 0 and 10000`),
    check("members_money_nonnegative", sql`${t.mileageRateCents} >= 0`),
    check("members_due_days_range", sql`${t.invoiceDueDays} between 0 and 120`),
    check("members_invoice_number_positive", sql`${t.nextInvoiceNumber} > 0`),
  ],
);

const memberId = () =>
  uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "restrict" });

// ---- Clients & properties ----

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    name: text("name").notNull(),
    /** The customer link: how Lena and the client portal know a client by email. */
    email: text("email"),
    phone: text("phone"),
    billingAddress: text("billing_address"),
    /** Null = the member's default billing. */
    billing: billingCadence("billing"),
    notes: text("notes"),
    status: clientStatus("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [unique("clients_member_id_id_key").on(t.memberId, t.id), index("clients_member_name_idx").on(t.memberId, t.name)],
);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    address: text("address").notNull(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    /** The lawn as drawn on the satellite map (GeoJSON), and its measured size. */
    lawnPolygon: jsonb("lawn_polygon").$type<Record<string, unknown>>(),
    lawnSqft: integer("lawn_sqft"),
    measuredAt: timestamp("measured_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    unique("properties_member_id_id_key").on(t.memberId, t.id),
    foreignKey({ name: "properties_member_client_fk", columns: [t.memberId, t.clientId], foreignColumns: [clients.memberId, clients.id] }).onDelete("restrict"),
    index("properties_member_client_idx").on(t.memberId, t.clientId),
    check("properties_lawn_sqft_positive", sql`${t.lawnSqft} is null or ${t.lawnSqft} > 0`),
  ],
);

// ---- Services, seasonal packages, recurring visits ----

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    name: text("name").notNull(),
    pricing: servicePricing("pricing").notNull(),
    /** Per hour, per visit, or per 1,000 sq ft (by `pricing`). */
    rateCents: integer("rate_cents").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("services_member_id_id_key").on(t.memberId, t.id),
    index("services_member_idx").on(t.memberId),
    check("services_rate_nonnegative", sql`${t.rateCents} >= 0`),
  ],
);

/** Seasonal templates (spring cleanup, fall leaves): a set of services for some months of the year. */
export const servicePackages = pgTable(
  "service_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    name: text("name").notNull(),
    /** A label people read, e.g. "Spring". */
    season: text("season"),
    startMonth: integer("start_month").notNull(),
    endMonth: integer("end_month").notNull(),
    /** The services it includes (service ids). */
    serviceIds: jsonb("service_ids").$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    unique("service_packages_member_id_id_key").on(t.memberId, t.id),
    index("service_packages_member_idx").on(t.memberId),
    check("service_packages_months_range", sql`${t.startMonth} between 1 and 12 and ${t.endMonth} between 1 and 12`),
  ],
);

/** Recurring visits: the daily rule creates each coming visit as a job (plan.md Step 11). */
export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    cadence: scheduleCadence("cadence").notNull(),
    /** For every_n_days. */
    everyNDays: integer("every_n_days"),
    /** For weekly / biweekly: 0 = Sunday … 6 = Saturday. */
    weekday: integer("weekday"),
    /** For monthly: 1–28. */
    dayOfMonth: integer("day_of_month"),
    /** The services each visit includes (service ids); a package can fill them. */
    serviceIds: jsonb("service_ids").$type<string[]>().notNull().default([]),
    packageId: uuid("package_id").references(() => servicePackages.id, { onDelete: "restrict" }),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    unique("schedules_member_id_id_key").on(t.memberId, t.id),
    foreignKey({ name: "schedules_member_client_fk", columns: [t.memberId, t.clientId], foreignColumns: [clients.memberId, clients.id] }).onDelete("restrict"),
    foreignKey({ name: "schedules_member_property_fk", columns: [t.memberId, t.propertyId], foreignColumns: [properties.memberId, properties.id] }).onDelete("restrict"),
    foreignKey({ name: "schedules_member_package_fk", columns: [t.memberId, t.packageId], foreignColumns: [servicePackages.memberId, servicePackages.id] }).onDelete("restrict"),
    index("schedules_member_client_idx").on(t.memberId, t.clientId),
    check("schedules_every_n_days_positive", sql`${t.everyNDays} is null or ${t.everyNDays} between 1 and 365`),
    check("schedules_weekday_range", sql`${t.weekday} is null or ${t.weekday} between 0 and 6`),
    check("schedules_day_of_month_range", sql`${t.dayOfMonth} is null or ${t.dayOfMonth} between 1 and 28`),
  ],
);

// ---- Quote requests (from the client portal) ----

export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    name: text("name").notNull(),
    /** The customer link: a new request waits on the member's Today (Pilot Light). */
    email: text("email").notNull(),
    phone: text("phone"),
    address: text("address"),
    note: text("note"),
    status: quoteRequestStatus("status").notNull().default("new"),
    ...timestamps,
  },
  (t) => [unique("quote_requests_member_id_id_key").on(t.memberId, t.id), index("quote_requests_member_status_idx").on(t.memberId, t.status)],
);

// ---- Jobs ----

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    scheduleId: uuid("schedule_id").references(() => schedules.id, { onDelete: "restrict" }),
    quoteRequestId: uuid("quote_request_id").references(() => quoteRequests.id, { onDelete: "restrict" }),
    /** The client's email, copied: the customer link lives on the record itself. */
    clientEmail: text("client_email"),
    status: jobStatus("status").notNull().default("scheduled"),
    scheduledFor: date("scheduled_for"),
    /** Stamped by the status change to in_progress (first time) and to done (Pilot Light map stamps). */
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Time on the job, from the two stamps. */
    minutes: integer("minutes").generatedAlwaysAs(
      sql`case when started_at is not null and completed_at is not null then (extract(epoch from (completed_at - started_at)) / 60)::integer end`,
    ),
    /** Set by the weather check (null = no warning), e.g. "Rain likely (70%)". */
    weatherNote: text("weather_note"),
    /** For a quoted job: the price quoted. */
    quoteCents: integer("quote_cents"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    unique("jobs_member_id_id_key").on(t.memberId, t.id),
    foreignKey({ name: "jobs_member_client_fk", columns: [t.memberId, t.clientId], foreignColumns: [clients.memberId, clients.id] }).onDelete("restrict"),
    foreignKey({ name: "jobs_member_property_fk", columns: [t.memberId, t.propertyId], foreignColumns: [properties.memberId, properties.id] }).onDelete("restrict"),
    foreignKey({ name: "jobs_member_schedule_fk", columns: [t.memberId, t.scheduleId], foreignColumns: [schedules.memberId, schedules.id] }).onDelete("restrict"),
    foreignKey({ name: "jobs_member_quote_request_fk", columns: [t.memberId, t.quoteRequestId], foreignColumns: [quoteRequests.memberId, quoteRequests.id] }).onDelete("restrict"),
    index("jobs_member_scheduled_idx").on(t.memberId, t.scheduledFor),
    index("jobs_member_status_idx").on(t.memberId, t.status),
    index("jobs_member_client_idx").on(t.memberId, t.clientId),
    check("jobs_quote_nonnegative", sql`${t.quoteCents} is null or ${t.quoteCents} >= 0`),
    check("jobs_completed_after_started", sql`${t.completedAt} is null or ${t.startedAt} is null or ${t.completedAt} >= ${t.startedAt}`),
  ],
);

/** The job's checklist: each service done on it, priced from the member's own rates. */
export const jobServices = pgTable(
  "job_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    /**
     * The service it came from (null for one added by hand). A service that's been used can't be deleted, only
     * switched off (`services.active`); the name and price below are kept as they were on the day.
     */
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    pricing: servicePricing("pricing").notNull(),
    /** Hours, square feet, or 1 (by `pricing`). */
    quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" }).notNull().default(1),
    rateCents: integer("rate_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
    done: boolean("done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({ name: "job_services_member_job_fk", columns: [t.memberId, t.jobId], foreignColumns: [jobs.memberId, jobs.id] }).onDelete("cascade"),
    foreignKey({ name: "job_services_member_service_fk", columns: [t.memberId, t.serviceId], foreignColumns: [services.memberId, services.id] }).onDelete("restrict"),
    index("job_services_member_job_idx").on(t.memberId, t.jobId),
    check("job_services_money_nonnegative", sql`${t.rateCents} >= 0 and ${t.amountCents} >= 0 and ${t.quantity} >= 0`),
  ],
);

export const jobPhotos = pgTable(
  "job_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    imageKey: text("image_key"),
    kind: photoKind("kind").notNull(),
    /** Shown on the client's invoice when they asked for photos. */
    onInvoice: boolean("on_invoice").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    foreignKey({ name: "job_photos_member_job_fk", columns: [t.memberId, t.jobId], foreignColumns: [jobs.memberId, jobs.id] }).onDelete("cascade"),
    index("job_photos_member_job_idx").on(t.memberId, t.jobId),
  ],
);

// ---- Invoices & payments ----
// `client_invoices`, not `invoices`: Pilot Light's `invoices` feature already means vendor invoices.

export const clientInvoices = pgTable(
  "client_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    /** The client's email, copied: the customer link lives on the record itself. */
    clientEmail: text("client_email"),
    /** The member's own invoice number (unique per member). */
    number: integer("number").notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    status: invoiceStatus("status").notNull().default("draft"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    /** The member's tax rate when the invoice was made, kept with it. */
    taxRateBp: integer("tax_rate_bp").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    dueOn: date("due_on"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** SHA-256 of the client-portal link's token; the token itself is only ever in the link. */
    portalTokenHash: text("portal_token_hash"),
    remindersSent: integer("reminders_sent").notNull().default(0),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    unique("client_invoices_member_id_id_key").on(t.memberId, t.id),
    unique("client_invoices_member_number_key").on(t.memberId, t.number),
    unique("client_invoices_portal_token_key").on(t.portalTokenHash),
    foreignKey({ name: "client_invoices_member_client_fk", columns: [t.memberId, t.clientId], foreignColumns: [clients.memberId, clients.id] }).onDelete("restrict"),
    index("client_invoices_member_status_idx").on(t.memberId, t.status),
    index("client_invoices_member_client_idx").on(t.memberId, t.clientId),
    check(
      "client_invoices_money_nonnegative",
      sql`${t.subtotalCents} >= 0 and ${t.taxCents} >= 0 and ${t.totalCents} >= 0 and ${t.taxRateBp} between 0 and 10000`,
    ),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => clientInvoices.id, { onDelete: "cascade" }),
    /** The job it came from (null for a line added by hand). */
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    serviceDate: date("service_date"),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" }).notNull().default(1),
    unitCents: integer("unit_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({ name: "invoice_lines_member_invoice_fk", columns: [t.memberId, t.invoiceId], foreignColumns: [clientInvoices.memberId, clientInvoices.id] }).onDelete("cascade"),
    foreignKey({ name: "invoice_lines_member_job_fk", columns: [t.memberId, t.jobId], foreignColumns: [jobs.memberId, jobs.id] }).onDelete("restrict"),
    index("invoice_lines_member_invoice_idx").on(t.memberId, t.invoiceId),
    check("invoice_lines_money_nonnegative", sql`${t.unitCents} >= 0 and ${t.amountCents} >= 0 and ${t.quantity} >= 0`),
  ],
);

/**
 * A client's payment of an invoice: by card, charged on the member's own Stripe account (Connect) and recorded by the
 * site from Stripe's messages; or recorded by hand (Mark as paid: cash, a check…), which the member may add and void,
 * never a card one. Never cascades.
 */
export const clientPayments = pgTable(
  "client_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => clientInvoices.id, { onDelete: "restrict" }),
    /** A card payment's Stripe PaymentIntent id (pi_…): how Pilot Light finds it to show or refund it. */
    stripePaymentIntent: text("stripe_payment_intent"),
    /** A card payment's Stripe account: the member's own (acct_…). */
    stripeAccountId: text("stripe_account_id"),
    /** How a payment recorded by hand came in; null for a card payment. */
    method: paymentMethod("method"),
    /** A payment recorded by hand: anything worth keeping (a check number). */
    note: text("note"),
    amountCents: integer("amount_cents").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedCents: integer("refunded_cents").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("client_payments_intent_key").on(t.stripePaymentIntent),
    foreignKey({ name: "client_payments_member_invoice_fk", columns: [t.memberId, t.invoiceId], foreignColumns: [clientInvoices.memberId, clientInvoices.id] }).onDelete("restrict"),
    index("client_payments_member_invoice_idx").on(t.memberId, t.invoiceId),
    check("client_payments_money", sql`${t.amountCents} > 0 and ${t.refundedCents} between 0 and ${t.amountCents}`),
    // Exactly one kind: a card payment (both Stripe ids, no method) or one recorded by hand (a method, no Stripe ids).
    check(
      "client_payments_kind",
      sql`(${t.method} is null and ${t.stripePaymentIntent} is not null and ${t.stripeAccountId} is not null) or (${t.method} is not null and ${t.stripePaymentIntent} is null and ${t.stripeAccountId} is null)`,
    ),
    // One recorded by hand is received or voided, never refunded through Stripe; only it can be voided.
    check(
      "client_payments_by_hand",
      sql`(${t.method} is null and ${t.status}::text <> 'voided') or (${t.method} is not null and ${t.status}::text in ('succeeded', 'voided') and ${t.refundedCents} = 0)`,
    ),
  ],
);

// ---- Expenses ----

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: memberId(),
    kind: expenseKind("kind").notNull(),
    date: date("date").notNull(),
    /** For mileage: miles × the member's mileage rate, worked out when it's logged. */
    amountCents: integer("amount_cents").notNull(),
    miles: numeric("miles", { precision: 10, scale: 1, mode: "number" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    note: text("note"),
    receiptUrl: text("receipt_url"),
    receiptKey: text("receipt_key"),
    ...timestamps,
  },
  (t) => [
    foreignKey({ name: "expenses_member_job_fk", columns: [t.memberId, t.jobId], foreignColumns: [jobs.memberId, jobs.id] }).onDelete("restrict"),
    index("expenses_member_date_idx").on(t.memberId, t.date),
    check("expenses_money_nonnegative", sql`${t.amountCents} >= 0 and (${t.miles} is null or ${t.miles} >= 0)`),
  ],
);
