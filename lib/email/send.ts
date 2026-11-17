// The site's emails to members' customers (invoices, quotes, reminders), through SendGrid's v3 API. Every one names
// what it is (Pilot Light's site convention §5: `siteEmailHeaders(kind)`, required here so no email leaves it out),
// comes from Kindling's authenticated domain under the member's business name, and replies go to the member.

import "server-only";
import { siteEmailHeaders, type SiteEmailKind } from "@/lib/pilot-light";
import { getEmailFrom, getSendgridKey } from "@/lib/env";

export type Email = {
  kind: SiteEmailKind;
  to: { email: string; name?: string | null };
  /** The member's business name (the sender's name the customer sees). */
  fromName: string;
  /** The member's own email: where the customer's reply goes. */
  replyTo: { email: string; name?: string | null };
  subject: string;
  html: string;
  text: string;
};

export class EmailError extends Error {}

export async function sendEmail(e: Email): Promise<void> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { authorization: `Bearer ${getSendgridKey()}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: e.to.email, ...(e.to.name ? { name: e.to.name } : {}) }] }],
      from: { email: getEmailFrom(), name: e.fromName },
      reply_to: { email: e.replyTo.email, ...(e.replyTo.name ? { name: e.replyTo.name } : {}) },
      subject: e.subject,
      content: [
        { type: "text/plain", value: e.text },
        { type: "text/html", value: e.html },
      ],
      headers: siteEmailHeaders(e.kind),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    // SendGrid's reason, never the message itself (it holds a customer's details).
    const why = await res.text().catch(() => "");
    console.error(`[email] SendGrid refused (${res.status}): ${why.slice(0, 300)}`);
    throw new EmailError(res.status === 401 || res.status === 403 ? "the email service refused the site's key" : "the email couldn't be sent");
  }
}
