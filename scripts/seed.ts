// Dev seed (plan.md Step 3): two TEST members, each with a believable working
// history, so member isolation can be tested from day one.
//
//   npm run db:seed
//
// Member A (Green Acres Lawn Co.): active subscription, bills monthly.
// Member B (Northwoods Mowing): comped, bills per visit.
//
// SAFETY: it only ever touches these two members (fixed ids below): it removes
// their rows and writes them again, in one transaction, so it's re-runnable and
// can never change a real member's data. Every email is @example.com, every
// Stripe id is a fake "seed" id. Dates are relative to today, so the data stays
// current. Runs outside Next.js (no `server-only`), with its own connection.

import { config } from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { inArray, sql } from "drizzle-orm";
import ws from "ws";
import { randomUUID } from "node:crypto";
import * as s from "../lib/db/schema";

config({ path: ".env.local", quiet: true });
const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("No database URL: set DATABASE_URL (and DATABASE_URL_UNPOOLED) in .env.local (gate M1 in SETUP.md / plan.md).");
  process.exit(1);
}
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: url });
const db = drizzle(pool, { schema: s });

export const SEED_MEMBER_IDS = ["a1a1a1a1-0000-4000-8000-000000000001", "b2b2b2b2-0000-4000-8000-000000000002"] as const;

// ---- Dates (on the members' clock, America/Detroit) ----

const TZ = "America/Detroit";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const monthKey = (ymd: string) => ymd.slice(0, 7);
const monthStart = (key: string) => `${key}-01`;
const monthEnd = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
/** A time on that day, Detroit-ish (UTC−4); good enough for test data. */
const at = (ymd: string, hour: number, minute = 0) => new Date(`${ymd}T${String(hour + 4).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Small deterministic random numbers, so a re-run makes the same shape of data. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- The two test members ----

type Pricing = "hourly" | "per_visit" | "per_sqft";
type ServiceSpec = { key: string; name: string; pricing: Pricing; rateCents: number };
type ClientSpec = {
  name: string;
  email: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  sqft: number;
  billing?: "monthly" | "per_visit";
  schedule?: { cadence: "weekly" | "biweekly"; weekday: number; services: string[] };
};
type MemberSpec = {
  id: string;
  seed: number;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  taxRateBp: number;
  mileageRateCents: number;
  defaultBilling: "monthly" | "per_visit";
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled";
  comped: boolean;
  stripeAccountId: string;
  services: ServiceSpec[];
  packages: { name: string; season: string; startMonth: number; endMonth: number; services: string[] }[];
  clients: ClientSpec[];
  quoteRequests: { name: string; email: string; phone: string; address: string; note: string; status: "new" | "contacted" }[];
  quotedLead: ClientSpec & { note: string; services: string[] };
};

const MEMBERS: MemberSpec[] = [
  {
    id: SEED_MEMBER_IDS[0],
    seed: 11,
    businessName: "Green Acres Lawn Co.",
    contactName: "Sam Rivera",
    email: "green-acres@example.com",
    phone: "(231) 555-0142",
    address: "88 Birch Hollow Rd, Traverse City, MI 49686",
    taxRateBp: 0,
    mileageRateCents: 70,
    defaultBilling: "monthly",
    subscriptionStatus: "active",
    comped: false,
    stripeAccountId: "acct_seed_green_acres",
    services: [
      { key: "mow", name: "Mowing", pricing: "per_sqft", rateCents: 900 },
      { key: "trim", name: "Trimming", pricing: "per_visit", rateCents: 1500 },
      { key: "edge", name: "Edging", pricing: "per_visit", rateCents: 1500 },
      { key: "blow", name: "Blowing", pricing: "per_visit", rateCents: 1000 },
      { key: "leaves", name: "Leaf cleanup", pricing: "hourly", rateCents: 4500 },
      { key: "aerate", name: "Aeration", pricing: "per_sqft", rateCents: 1200 },
      { key: "mulch", name: "Mulching", pricing: "hourly", rateCents: 5000 },
    ],
    packages: [
      { name: "Spring cleanup", season: "Spring", startMonth: 3, endMonth: 5, services: ["leaves", "mulch", "edge"] },
      { name: "Fall leaves", season: "Fall", startMonth: 10, endMonth: 11, services: ["leaves", "blow"] },
    ],
    clients: [
      { name: "Hannah Whitaker", email: "hannah.whitaker@example.com", phone: "(231) 555-0101", address: "412 Cedar Ln, Traverse City, MI 49686", lat: 44.7712, lng: -85.6011, sqft: 5200, schedule: { cadence: "weekly", weekday: 1, services: ["mow", "trim", "blow"] } },
      { name: "Marcus Bell", email: "marcus.bell@example.com", phone: "(231) 555-0102", address: "1907 Ridgeview Dr, Traverse City, MI 49684", lat: 44.7489, lng: -85.6412, sqft: 7400, schedule: { cadence: "weekly", weekday: 1, services: ["mow", "trim", "edge"] } },
      { name: "Oakview HOA", email: "board@oakview-hoa.example.com", phone: "(231) 555-0103", address: "1 Oakview Common, Traverse City, MI 49686", lat: 44.7834, lng: -85.5893, sqft: 18500, schedule: { cadence: "weekly", weekday: 2, services: ["mow", "trim", "edge", "blow"] } },
      { name: "Diane Kowalski", email: "diane.k@example.com", phone: "(231) 555-0104", address: "56 Maple St, Traverse City, MI 49684", lat: 44.7601, lng: -85.6234, sqft: 4100, schedule: { cadence: "biweekly", weekday: 3, services: ["mow", "trim"] } },
      { name: "Robert & Elise Tran", email: "tran.family@example.com", phone: "(231) 555-0105", address: "2310 Peninsula Dr, Traverse City, MI 49686", lat: 44.8102, lng: -85.5788, sqft: 9800, billing: "per_visit", schedule: { cadence: "weekly", weekday: 4, services: ["mow", "trim", "blow"] } },
      { name: "Lakeside Dental", email: "office@lakeside-dental.example.com", phone: "(231) 555-0106", address: "740 Front St, Traverse City, MI 49684", lat: 44.7645, lng: -85.6172, sqft: 6300, schedule: { cadence: "weekly", weekday: 5, services: ["mow", "edge", "blow"] } },
    ],
    quoteRequests: [
      { name: "Pat Morgan", email: "pat.morgan@example.com", phone: "(231) 555-0181", address: "88 Sunset Ct, Traverse City, MI 49686", note: "Looking for weekly mowing starting next month. Corner lot.", status: "new" },
      { name: "Lee Hartman", email: "lee.hartman@example.com", phone: "(231) 555-0182", address: "15 Willow Way, Traverse City, MI 49684", note: "Fall leaf cleanup, big maple in the back.", status: "contacted" },
    ],
    quotedLead: {
      name: "Casey Brooks",
      email: "casey.brooks@example.com",
      phone: "(231) 555-0183",
      address: "302 Lakeview Ave, Traverse City, MI 49686",
      lat: 44.7921,
      lng: -85.6022,
      sqft: 7800,
      note: "Weekly mowing and trimming, May through October.",
      services: ["mow", "trim"],
    },
  },
  {
    id: SEED_MEMBER_IDS[1],
    seed: 29,
    businessName: "Northwoods Mowing",
    contactName: "Jordan Lee",
    email: "northwoods@example.com",
    phone: "(231) 555-0242",
    address: "5 Jack Pine Trl, Kingsley, MI 49649",
    taxRateBp: 600,
    mileageRateCents: 67,
    defaultBilling: "per_visit",
    subscriptionStatus: "active",
    comped: true,
    stripeAccountId: "acct_seed_northwoods",
    services: [
      { key: "mow", name: "Mowing", pricing: "per_visit", rateCents: 4500 },
      { key: "trim", name: "Trimming", pricing: "per_visit", rateCents: 1200 },
      { key: "edge", name: "Edging", pricing: "per_visit", rateCents: 1200 },
      { key: "spring", name: "Spring cleanup", pricing: "hourly", rateCents: 5500 },
      { key: "hedge", name: "Hedge trimming", pricing: "hourly", rateCents: 5000 },
      { key: "fert", name: "Fertilizing", pricing: "per_sqft", rateCents: 800 },
    ],
    packages: [
      { name: "Spring cleanup", season: "Spring", startMonth: 4, endMonth: 5, services: ["spring", "edge"] },
      { name: "Summer mow", season: "Summer", startMonth: 5, endMonth: 9, services: ["mow", "trim"] },
    ],
    clients: [
      { name: "Gloria Svensson", email: "gloria.s@example.com", phone: "(231) 555-0201", address: "118 Elm St, Kingsley, MI 49649", lat: 44.5853, lng: -85.5361, sqft: 6100, schedule: { cadence: "weekly", weekday: 1, services: ["mow", "trim"] } },
      { name: "Tom Hadley", email: "tom.hadley@example.com", phone: "(231) 555-0202", address: "4410 County Rd 611, Kingsley, MI 49649", lat: 44.6021, lng: -85.5109, sqft: 12200, schedule: { cadence: "weekly", weekday: 2, services: ["mow", "trim", "edge"] } },
      { name: "Pine Street Apartments", email: "manager@pinestreet-apts.example.com", phone: "(231) 555-0203", address: "300 Pine St, Kingsley, MI 49649", lat: 44.5809, lng: -85.5402, sqft: 15800, billing: "monthly", schedule: { cadence: "weekly", weekday: 3, services: ["mow", "trim", "edge"] } },
      { name: "Nina Okafor", email: "nina.okafor@example.com", phone: "(231) 555-0204", address: "27 Brook Ln, Kingsley, MI 49649", lat: 44.5902, lng: -85.5288, sqft: 5400, schedule: { cadence: "biweekly", weekday: 4, services: ["mow", "trim"] } },
      { name: "Carl Lindqvist", email: "carl.lindqvist@example.com", phone: "(231) 555-0205", address: "9 Hemlock Ct, Kingsley, MI 49649", lat: 44.5778, lng: -85.5476, sqft: 4800 },
    ],
    quoteRequests: [
      { name: "Riley Parsons", email: "riley.parsons@example.com", phone: "(231) 555-0281", address: "71 Fox Run, Kingsley, MI 49649", note: "Need someone for hedges and a spring cleanup.", status: "new" },
    ],
    quotedLead: {
      name: "Morgan Ellis",
      email: "morgan.ellis@example.com",
      phone: "(231) 555-0282",
      address: "640 Main St, Kingsley, MI 49649",
      lat: 44.5841,
      lng: -85.5357,
      sqft: 8800,
      note: "Fertilizing program for a large front lawn.",
      services: ["fert"],
    },
  },
];

// ---- Build each member's rows in memory, then write them ----

type Rows = {
  members: (typeof s.members.$inferInsert)[];
  services: (typeof s.services.$inferInsert)[];
  packages: (typeof s.servicePackages.$inferInsert)[];
  clients: (typeof s.clients.$inferInsert)[];
  properties: (typeof s.properties.$inferInsert)[];
  schedules: (typeof s.schedules.$inferInsert)[];
  quoteRequests: (typeof s.quoteRequests.$inferInsert)[];
  jobs: (typeof s.jobs.$inferInsert)[];
  jobServices: (typeof s.jobServices.$inferInsert)[];
  invoices: (typeof s.clientInvoices.$inferInsert)[];
  lines: (typeof s.invoiceLines.$inferInsert)[];
  payments: (typeof s.clientPayments.$inferInsert)[];
  expenses: (typeof s.expenses.$inferInsert)[];
};

function buildMember(m: MemberSpec, rows: Rows) {
  const rnd = rng(m.seed);
  const now = new Date();

  const svcByKey = new Map(m.services.map((sv, i) => [sv.key, { ...sv, id: randomUUID(), sortOrder: i }]));
  for (const sv of svcByKey.values()) rows.services.push({ id: sv.id, memberId: m.id, name: sv.name, pricing: sv.pricing, rateCents: sv.rateCents, sortOrder: sv.sortOrder });

  const packageIds: string[] = [];
  for (const p of m.packages) {
    const id = randomUUID();
    packageIds.push(id);
    rows.packages.push({ id, memberId: m.id, name: p.name, season: p.season, startMonth: p.startMonth, endMonth: p.endMonth, serviceIds: p.services.map((k) => svcByKey.get(k)!.id) });
  }

  /** A job's checklist line for one service, priced from the member's own rates. */
  const priceService = (key: string, sqft: number) => {
    const sv = svcByKey.get(key)!;
    if (sv.pricing === "per_visit") return { sv, quantity: 1, amountCents: sv.rateCents, label: sv.name };
    if (sv.pricing === "per_sqft") {
      return { sv, quantity: sqft, amountCents: Math.round((sv.rateCents * sqft) / 1000), label: `${sv.name} (${sqft.toLocaleString("en-US")} sq ft)` };
    }
    const hours = 1 + 0.5 * Math.floor(rnd() * 4);
    return { sv, quantity: hours, amountCents: Math.round(sv.rateCents * hours), label: `${sv.name} (${hours} h)` };
  };

  type Visit = { jobId: string; clientIdx: number; day: string; lines: { label: string; quantity: number; unitCents: number; amountCents: number; pricing: Pricing }[] };
  const visits: Visit[] = [];
  const clientIds: string[] = [];
  const billingOf: ("monthly" | "per_visit")[] = [];
  let todayStarted = false;
  const slotOnDay = new Map<string, number>();

  m.clients.forEach((c, ci) => {
    const clientId = randomUUID();
    const propertyId = randomUUID();
    clientIds.push(clientId);
    billingOf.push(c.billing ?? m.defaultBilling);
    rows.clients.push({ id: clientId, memberId: m.id, name: c.name, email: c.email, phone: c.phone, billingAddress: c.address, billing: c.billing ?? null });
    rows.properties.push({ id: propertyId, memberId: m.id, clientId, address: c.address, lat: c.lat, lng: c.lng, lawnSqft: c.sqft, measuredAt: at(addDays(TODAY, -120), 10) });
    if (!c.schedule) return;

    const sc = c.schedule;
    // Starts on the schedule's weekday, about 9 weeks back.
    let startsOn = addDays(TODAY, -63);
    while (weekdayOf(startsOn) !== sc.weekday) startsOn = addDays(startsOn, 1);
    const scheduleId = randomUUID();
    rows.schedules.push({ id: scheduleId, memberId: m.id, clientId, propertyId, cadence: sc.cadence, weekday: sc.weekday, serviceIds: sc.services.map((k) => svcByKey.get(k)!.id), startsOn });

    for (let d = -42; d <= 14; d++) {
      const day = addDays(TODAY, d);
      if (weekdayOf(day) !== sc.weekday) continue;
      if (sc.cadence === "biweekly" && (daysBetween(startsOn, day) / 7) % 2 !== 0) continue;

      const jobId = randomUUID();
      const past = day < TODAY;
      const canceled = past && rnd() < 0.07;
      let status: "scheduled" | "in_progress" | "done" | "canceled" = "scheduled";
      let startedAt: Date | null = null;
      let completedAt: Date | null = null;
      let notes: string | null = null;

      if (canceled) {
        status = "canceled";
        notes = "Rained out; picked up next visit.";
      } else if (past) {
        const slot = slotOnDay.get(day) ?? 0;
        slotOnDay.set(day, slot + 1);
        startedAt = at(day, 8 + slot * 2, Math.floor(rnd() * 4) * 15);
        completedAt = new Date(startedAt.getTime() + (25 + Math.floor(rnd() * 50)) * 60_000);
        status = "done";
      } else if (day === TODAY && !todayStarted) {
        todayStarted = true;
        status = "in_progress";
        startedAt = new Date(now.getTime() - 20 * 60_000);
      }

      rows.jobs.push({ id: jobId, memberId: m.id, clientId, propertyId, scheduleId, clientEmail: c.email, status, scheduledFor: day, startedAt, completedAt, notes });

      const priced = sc.services.map((k) => priceService(k, c.sqft));
      priced.forEach((p, i) =>
        rows.jobServices.push({
          memberId: m.id,
          jobId,
          serviceId: p.sv.id,
          name: p.sv.name,
          pricing: p.sv.pricing,
          quantity: p.quantity,
          rateCents: p.sv.rateCents,
          amountCents: p.amountCents,
          done: status === "done",
          sortOrder: i,
        }),
      );
      if (status === "done") {
        visits.push({
          jobId,
          clientIdx: ci,
          day,
          lines: priced.map((p) =>
            p.sv.pricing === "hourly"
              ? { label: p.label, quantity: p.quantity, unitCents: p.sv.rateCents, amountCents: p.amountCents, pricing: p.sv.pricing }
              : { label: p.label, quantity: 1, unitCents: p.amountCents, amountCents: p.amountCents, pricing: p.sv.pricing },
          ),
        });
      }
    }
  });

  // ---- Quote requests, and one lead already quoted ----
  for (const q of m.quoteRequests) {
    rows.quoteRequests.push({ memberId: m.id, name: q.name, email: q.email, phone: q.phone, address: q.address, note: q.note, status: q.status, createdAt: at(addDays(TODAY, q.status === "new" ? -1 : -6), 19) });
  }
  {
    const lead = m.quotedLead;
    const requestId = randomUUID();
    const clientId = randomUUID();
    const propertyId = randomUUID();
    rows.quoteRequests.push({ id: requestId, memberId: m.id, name: lead.name, email: lead.email, phone: lead.phone, address: lead.address, note: lead.note, status: "quoted", createdAt: at(addDays(TODAY, -9), 18) });
    rows.clients.push({ id: clientId, memberId: m.id, name: lead.name, email: lead.email, phone: lead.phone, billingAddress: lead.address });
    rows.properties.push({ id: propertyId, memberId: m.id, clientId, address: lead.address, lat: lead.lat, lng: lead.lng, lawnSqft: lead.sqft, measuredAt: at(addDays(TODAY, -8), 11) });
    const quoteCents = lead.services.reduce((sum, k) => sum + priceService(k, lead.sqft).amountCents, 0);
    rows.jobs.push({ memberId: m.id, clientId, propertyId, quoteRequestId: requestId, clientEmail: lead.email, status: "quoted", quoteCents, notes: "Quoted from the satellite measurement." });
  }

  // ---- Invoices: monthly clients get one per month, per-visit clients one per visit ----
  let number = 1001;
  const dueDays = 15;
  const currentMonth = monthKey(TODAY);
  const invoiced = new Set<string>();

  type Draft = { clientIdx: number; periodStart: string; periodEnd: string; visits: Visit[]; status: "draft" | "ready" | "sent" | "overdue" | "paid"; sentOn: string | null };
  const drafts: Draft[] = [];

  const monthlyGroups = new Map<string, Visit[]>();
  for (const v of visits) {
    if (billingOf[v.clientIdx] === "monthly") {
      const key = `${v.clientIdx}|${monthKey(v.day)}`;
      monthlyGroups.set(key, [...(monthlyGroups.get(key) ?? []), v]);
    } else {
      // Every state shows whatever day it's run: a slow payer's older visits are overdue (past the due date),
      // older ones paid, recent ones sent, the last few days' ready to send.
      const age = daysBetween(v.day, TODAY);
      const status = age >= 17 && v.clientIdx % 3 === 1 ? "overdue" : age > 10 ? "paid" : age > 3 ? "sent" : "ready";
      drafts.push({ clientIdx: v.clientIdx, periodStart: v.day, periodEnd: v.day, visits: [v], status, sentOn: status === "ready" ? null : addDays(v.day, 1) });
    }
  }
  for (const [key, group] of monthlyGroups) {
    const [ci, month] = key.split("|");
    const clientIdx = Number(ci);
    if (month === currentMonth) {
      drafts.push({ clientIdx, periodStart: monthStart(month), periodEnd: monthEnd(month), visits: group, status: "draft", sentOn: null });
    } else {
      const sentOn = addDays(monthEnd(month), 1);
      const unpaid = clientIdx % 3 === 1;
      const status = unpaid ? (addDays(sentOn, dueDays) < TODAY ? "overdue" : "sent") : "paid";
      drafts.push({ clientIdx, periodStart: monthStart(month), periodEnd: monthEnd(month), visits: group, status, sentOn });
    }
  }
  drafts.sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.clientIdx - b.clientIdx);

  for (const d of drafts) {
    const id = randomUUID();
    const subtotal = d.visits.flatMap((v) => v.lines).reduce((sum, l) => sum + l.amountCents, 0);
    const tax = Math.round((subtotal * m.taxRateBp) / 10000);
    const sentAt = d.sentOn ? at(d.sentOn, 14) : null;
    let paidAt: Date | null = null;
    if (d.status === "paid" && d.sentOn) {
      const paidOn = addDays(d.sentOn, 3 + Math.floor(rnd() * 5));
      paidAt = at(paidOn < TODAY ? paidOn : addDays(TODAY, -1), 20);
    }
    rows.invoices.push({
      id,
      memberId: m.id,
      clientId: clientIds[d.clientIdx],
      clientEmail: m.clients[d.clientIdx].email,
      number: number++,
      periodStart: d.periodStart,
      periodEnd: d.periodEnd,
      status: d.status,
      subtotalCents: subtotal,
      taxRateBp: m.taxRateBp,
      taxCents: tax,
      totalCents: subtotal + tax,
      dueOn: d.sentOn ? addDays(d.sentOn, dueDays) : null,
      sentAt,
      paidAt,
    });
    let order = 0;
    for (const v of d.visits) {
      for (const l of v.lines) {
        rows.lines.push({ memberId: m.id, invoiceId: id, jobId: v.jobId, serviceDate: v.day, description: `${l.label}, ${fmtDay(v.day)}`, quantity: l.quantity, unitCents: l.unitCents, amountCents: l.amountCents, sortOrder: order++ });
      }
      if (d.status !== "draft" && d.status !== "ready") invoiced.add(v.jobId);
    }
    if (d.status === "paid") {
      rows.payments.push({
        memberId: m.id,
        invoiceId: id,
        stripePaymentIntent: `pi_seed_${id.replace(/-/g, "").slice(0, 20)}`,
        stripeAccountId: m.stripeAccountId,
        amountCents: subtotal + tax,
        status: "succeeded",
        paidAt,
      });
    }
  }
  // Jobs on a sent or paid invoice are invoiced.
  for (const j of rows.jobs) if (j.id && invoiced.has(j.id)) j.status = "invoiced";

  // ---- Expenses: weekly fuel, some materials, mileage ----
  for (let d = -42; d <= -1; d += 7) {
    rows.expenses.push({ memberId: m.id, kind: "fuel", date: addDays(TODAY, d), amountCents: 4500 + Math.floor(rnd() * 40) * 100, note: "Truck + mower fuel" });
  }
  rows.expenses.push({ memberId: m.id, kind: "materials", date: addDays(TODAY, -30), amountCents: 18900, note: "Trimmer line and blades" });
  rows.expenses.push({ memberId: m.id, kind: "equipment", date: addDays(TODAY, -18), amountCents: 12450, note: "Mower tune-up" });
  for (const d of [-26, -12, -4]) {
    const miles = 20 + Math.floor(rnd() * 40);
    rows.expenses.push({ memberId: m.id, kind: "mileage", date: addDays(TODAY, d), miles, amountCents: miles * m.mileageRateCents, note: "Supply run" });
  }

  rows.members.push({
    id: m.id,
    businessName: m.businessName,
    contactName: m.contactName,
    email: m.email,
    phone: m.phone,
    address: m.address,
    timezone: TZ,
    taxRateBp: m.taxRateBp,
    mileageRateCents: m.mileageRateCents,
    defaultBilling: m.defaultBilling,
    invoiceDueDays: dueDays,
    nextInvoiceNumber: number,
    subscriptionStatus: m.subscriptionStatus,
    comped: m.comped,
    stripeAccountId: m.stripeAccountId,
    payoutsEnabled: true,
    stripeCustomerId: m.comped ? null : `cus_seed_${m.id.slice(0, 8)}`,
    stripeSubscriptionId: m.comped ? null : `sub_seed_${m.id.slice(0, 8)}`,
    currentPeriodEnd: m.comped ? null : at(addDays(TODAY, 18), 0),
  });
}

async function main() {
  const rows: Rows = { members: [], services: [], packages: [], clients: [], properties: [], schedules: [], quoteRequests: [], jobs: [], jobServices: [], invoices: [], lines: [], payments: [], expenses: [] };
  for (const m of MEMBERS) buildMember(m, rows);

  const ids = [...SEED_MEMBER_IDS];
  await db.transaction(async (tx) => {
    // Remove only the seed members' rows, children first.
    await tx.delete(s.clientPayments).where(inArray(s.clientPayments.memberId, ids));
    await tx.delete(s.invoiceLines).where(inArray(s.invoiceLines.memberId, ids));
    await tx.delete(s.clientInvoices).where(inArray(s.clientInvoices.memberId, ids));
    await tx.delete(s.expenses).where(inArray(s.expenses.memberId, ids));
    await tx.delete(s.jobPhotos).where(inArray(s.jobPhotos.memberId, ids));
    await tx.delete(s.jobServices).where(inArray(s.jobServices.memberId, ids));
    await tx.delete(s.jobs).where(inArray(s.jobs.memberId, ids));
    await tx.delete(s.schedules).where(inArray(s.schedules.memberId, ids));
    await tx.delete(s.quoteRequests).where(inArray(s.quoteRequests.memberId, ids));
    await tx.delete(s.properties).where(inArray(s.properties.memberId, ids));
    await tx.delete(s.servicePackages).where(inArray(s.servicePackages.memberId, ids));
    await tx.delete(s.services).where(inArray(s.services.memberId, ids));
    await tx.delete(s.clients).where(inArray(s.clients.memberId, ids));
    await tx.delete(s.members).where(inArray(s.members.id, ids));

    // Write them again, parents first.
    await tx.insert(s.members).values(rows.members);
    await tx.insert(s.services).values(rows.services);
    await tx.insert(s.servicePackages).values(rows.packages);
    await tx.insert(s.clients).values(rows.clients);
    await tx.insert(s.properties).values(rows.properties);
    await tx.insert(s.schedules).values(rows.schedules);
    await tx.insert(s.quoteRequests).values(rows.quoteRequests);
    await tx.insert(s.jobs).values(rows.jobs);
    await tx.insert(s.jobServices).values(rows.jobServices);
    await tx.insert(s.clientInvoices).values(rows.invoices);
    await tx.insert(s.invoiceLines).values(rows.lines);
    if (rows.payments.length) await tx.insert(s.clientPayments).values(rows.payments);
    await tx.insert(s.expenses).values(rows.expenses);
  });

  // What's in the database now, per member (read back, not what was meant to be written).
  const counts = await db.execute(sql`
    select m.business_name,
      (select count(*) from clients c where c.member_id = m.id) as clients,
      (select count(*) from jobs j where j.member_id = m.id) as jobs,
      (select count(*) from client_invoices i where i.member_id = m.id) as invoices,
      (select count(*) from client_payments p where p.member_id = m.id) as payments,
      (select count(*) from expenses e where e.member_id = m.id) as expenses
    from members m where m.id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) order by m.business_name`);
  console.log(`Seeded the two test members (today is ${TODAY} on their clock):`);
  console.table(counts.rows);
}

main()
  .catch((err) => {
    console.error("Seed failed, nothing was changed (one transaction):", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
