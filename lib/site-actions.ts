// The site actions Pilot Light calls (plan.md Step 12; declared with Pilot Light's `npm run site:actions`). Each one
// emails a member's customer in the member's name and logo, with a link to view it, and only then makes the change,
// so nothing is marked sent unless the email went:
//  - invoice-send: an invoice moving to sent (from Manage, Today's "Send all", or Lena's Allow card);
//  - invoice-remind: Invoicing's daily reminder on an overdue invoice (its reminder count going up);
//  - quote-send: a quote request moving to quoted, with the member's quoted job for it.
// Pilot Light has checked who asked and whether they may; this site's own database user isn't bound by the members'
// row-level security, so every read here is by the record's own member (and the database's composite keys keep a
// record's links within one member).

import "server-only";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientInvoices, clients, jobs, members, properties, quoteRequests } from "@/lib/db/schema";
import { SiteActionRefused, type SiteActionHandler } from "@/lib/pilot-light";
import { EmailError, sendEmail } from "@/lib/email/send";
import { invoiceEmail, quoteEmail, reminderEmail, type Sender } from "@/lib/email/templates";
import { portalLink, portalToken, tokenHash } from "@/lib/portal-links";

const sender = (m: typeof members.$inferSelect): Sender => ({ businessName: m.businessName, logoUrl: m.logoUrl });

async function memberOf(memberId: string) {
  const [m] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!m) throw new SiteActionRefused("its business couldn't be found");
  return m;
}

async function send(kind: Parameters<typeof sendEmail>[0]["kind"], m: typeof members.$inferSelect, to: { email: string; name: string }, mail: { subject: string; html: string; text: string }) {
  try {
    await sendEmail({ kind, to, fromName: m.businessName, replyTo: { email: m.email, name: m.contactName ?? m.businessName }, ...mail });
  } catch (err) {
    if (err instanceof EmailError) throw new SiteActionRefused(err.message);
    throw err;
  }
}

/** The invoice, its customer and their email (the one copied onto the invoice, else the customer's own). */
async function invoiceFor(id: string | undefined) {
  if (!id) throw new SiteActionRefused("no invoice was named");
  const [inv] = await db.select().from(clientInvoices).where(eq(clientInvoices.id, id)).limit(1);
  if (!inv) throw new SiteActionRefused("that invoice no longer exists");
  const [client] = await db.select().from(clients).where(and(eq(clients.id, inv.clientId), eq(clients.memberId, inv.memberId))).limit(1);
  const email = (inv.clientEmail ?? client?.email ?? "").trim();
  if (!email.includes("@")) throw new SiteActionRefused(`${client?.name ?? "this customer"} has no email address`);
  return { inv, client, to: { email, name: client?.name ?? "" } };
}

export const invoiceSend: SiteActionHandler = async (req) => {
  if (req.operation !== "status" || req.to !== "sent") throw new SiteActionRefused("this only sends an invoice");
  const { inv, client, to } = await invoiceFor(req.id);
  if (inv.status !== "ready") throw new SiteActionRefused("only a ready invoice can be sent");
  if (inv.totalCents <= 0) throw new SiteActionRefused("this invoice has nothing to pay");
  const m = await memberOf(inv.memberId);
  const link = portalLink("invoice", inv.id);
  await send("invoice", m, to, invoiceEmail(sender(m), { number: inv.number, totalCents: inv.totalCents, dueOn: inv.dueOn, periodStart: inv.periodStart, periodEnd: inv.periodEnd }, link));
  await db
    .update(clientInvoices)
    .set({ status: "sent", sentAt: new Date(), portalTokenHash: tokenHash(portalToken("invoice", inv.id)), updatedAt: new Date() })
    .where(and(eq(clientInvoices.id, inv.id), eq(clientInvoices.memberId, inv.memberId)));
  return { message: `emailed invoice #${inv.number} to ${client?.name ?? to.email}` };
};

export const invoiceRemind: SiteActionHandler = async (req) => {
  if (req.operation !== "update") throw new SiteActionRefused("this only sends a reminder");
  const { inv, client, to } = await invoiceFor(req.id);
  if (inv.status !== "overdue") throw new SiteActionRefused("only an overdue invoice gets a reminder");
  const count = Number(req.values?.reminders_sent);
  // The next reminder only (a repeated or stale request never sends twice).
  if (!Number.isInteger(count) || count !== inv.remindersSent + 1) throw new SiteActionRefused("that reminder was already sent");
  const m = await memberOf(inv.memberId);
  await send("payment_reminder", m, to, reminderEmail(sender(m), { number: inv.number, totalCents: inv.totalCents, dueOn: inv.dueOn }, portalLink("invoice", inv.id)));
  await db
    .update(clientInvoices)
    .set({ remindersSent: count, lastReminderAt: new Date(), updatedAt: new Date() })
    .where(and(eq(clientInvoices.id, inv.id), eq(clientInvoices.memberId, inv.memberId)));
  return { message: `reminded ${client?.name ?? to.email} about invoice #${inv.number}` };
};

export const quoteSend: SiteActionHandler = async (req) => {
  if (req.operation !== "status" || req.to !== "quoted") throw new SiteActionRefused("this only sends a quote");
  if (!req.id) throw new SiteActionRefused("no quote request was named");
  const [request] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, req.id)).limit(1);
  if (!request) throw new SiteActionRefused("that quote request no longer exists");
  // The member's quoted job for this request, with its price: that's the quote.
  const [job] = await db
    .select({ id: jobs.id, quoteCents: jobs.quoteCents, propertyId: jobs.propertyId })
    .from(jobs)
    .where(and(eq(jobs.quoteRequestId, request.id), eq(jobs.memberId, request.memberId), eq(jobs.status, "quoted"), isNotNull(jobs.quoteCents)))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  if (!job?.quoteCents) throw new SiteActionRefused("add the quote first: a job for this request, marked Quoted, with its price");
  const [place] = await db.select({ address: properties.address }).from(properties).where(and(eq(properties.id, job.propertyId), eq(properties.memberId, request.memberId))).limit(1);
  const m = await memberOf(request.memberId);
  await send("quote", m, { email: request.email, name: request.name }, quoteEmail(sender(m), { totalCents: job.quoteCents, address: place?.address ?? request.address }, portalLink("quote", job.id)));
  await db.update(quoteRequests).set({ status: "quoted", updatedAt: sql`now()` }).where(and(eq(quoteRequests.id, request.id), eq(quoteRequests.memberId, request.memberId)));
  return { message: `emailed ${request.name} their quote` };
};
