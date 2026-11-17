// The emails a member's customer gets: an invoice, a payment reminder, a quote. Each in the member's own name and
// logo, on the App's look (Forest & Stone), in THE design pattern: one card, its title, tidy rows (a quiet label on
// the left, the value on the right), one button. No explaining: the card says it. Every value is escaped; tables
// and inline styles, because that's what email clients render.

import { site } from "@/lib/site";

export type Sender = { businessName: string; logoUrl: string | null };
export type Row = { label: string; value: string };

const C = { page: "#F1EDE1", card: "#F8F5EC", edge: "#1C3323", ink: "#282722", muted: "#837E72", line: "#E4DCCB", button: "#2B4A34", buttonText: "#F8F5EC" };
const SERIF = "'Zilla Slab', Georgia, 'Times New Roman', serif";
const SANS = "'Nunito Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/** "… to reach Green Acres Lawn Co." without a second full stop. */
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** "Dec 16" (this year) or "Dec 16, 2027": a calendar day as written, never moved by a time zone. */
export function day(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const sameYear = y === new Date().getFullYear();
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(new Date(Date.UTC(y, m - 1, d)));
}

function card(from: Sender, title: string, rows: Row[], button: { label: string; href: string }): string {
  const logo = from.logoUrl && /^https:\/\//.test(from.logoUrl) ? `<img src="${esc(from.logoUrl)}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:10px;object-fit:cover;margin:0 0 12px 0">` : "";
  // A long value (an address) goes under its label, as the app's own forms do; a short one sits on the right.
  const lines = rows
    .map((r, i) => {
      const top = i ? `border-top:1px solid ${C.line};` : "";
      return r.value.length > 26
        ? `<tr><td colspan="2" style="padding:10px 0;${top}">
            <div style="font:15px ${SANS};color:${C.muted}">${esc(r.label)}</div>
            <div style="font:600 15px/1.4 ${SANS};color:${C.ink};margin-top:2px">${esc(r.value)}</div>
          </td></tr>`
        : `<tr>
            <td style="padding:10px 0;${top}font:15px ${SANS};color:${C.muted}">${esc(r.label)}</td>
            <td align="right" style="padding:10px 0;${top}font:600 15px ${SANS};color:${C.ink}">${esc(r.value)}</td>
          </tr>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${C.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border:2px solid ${C.edge};border-radius:18px">
    <tr><td style="padding:28px 24px 8px 24px">
      ${logo}
      <div style="font:600 15px ${SANS};color:${C.muted}">${esc(from.businessName)}</div>
      <div style="font:700 24px/1.25 ${SERIF};color:${C.ink};margin-top:4px">${esc(title)}</div>
    </td></tr>
    <tr><td style="padding:8px 24px 4px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}</table>
    </td></tr>
    <tr><td style="padding:16px 24px 28px 24px">
      <a href="${esc(button.href)}" style="display:inline-block;background:${C.button};color:${C.buttonText};font:600 16px ${SANS};text-decoration:none;padding:12px 22px;border-radius:999px">${esc(button.label)}</a>
    </td></tr>
  </table>
  <div style="max-width:520px;font:12px/1.5 ${SANS};color:${C.muted};padding:14px 8px 0 8px">Reply to this email to reach ${esc(sentence(from.businessName))}<br>Sent through ${esc(site.name)}.</div>
</td></tr></table>
</body></html>`;
}

const text = (from: Sender, title: string, rows: Row[], button: { label: string; href: string }) =>
  [from.businessName, "", title, "", ...rows.map((r) => `${r.label}: ${r.value}`), "", `${button.label}: ${button.href}`, "", `Reply to this email to reach ${sentence(from.businessName)}`].join("\n");

export type Rendered = { subject: string; html: string; text: string };

const rendered = (subject: string, from: Sender, title: string, rows: Row[], button: { label: string; href: string }): Rendered => ({
  subject,
  html: card(from, title, rows, button),
  text: text(from, title, rows, button),
});

export function invoiceEmail(from: Sender, inv: { number: number; totalCents: number; dueOn: string | null; periodStart: string | null; periodEnd: string | null }, link: string): Rendered {
  // "Nov 1–30" within a month, "Nov 24 – Dec 7" across two, one day as itself.
  const sameMonth = inv.periodStart && inv.periodEnd && inv.periodStart.slice(0, 7) === inv.periodEnd.slice(0, 7);
  const period =
    inv.periodStart && inv.periodEnd
      ? inv.periodStart === inv.periodEnd
        ? day(inv.periodStart)
        : sameMonth
          ? `${day(inv.periodStart)}–${Number(inv.periodEnd.slice(8, 10))}`
          : `${day(inv.periodStart)} – ${day(inv.periodEnd)}`
      : null;
  const rows: Row[] = [{ label: "Amount due", value: money(inv.totalCents) }, ...(inv.dueOn ? [{ label: "Due", value: day(inv.dueOn) }] : []), ...(period ? [{ label: "For", value: period }] : [])];
  return rendered(`Invoice #${inv.number} from ${from.businessName}`, from, `Invoice #${inv.number}`, rows, { label: "View invoice", href: link });
}

export function reminderEmail(from: Sender, inv: { number: number; totalCents: number; dueOn: string | null }, link: string): Rendered {
  const rows: Row[] = [{ label: "Amount due", value: money(inv.totalCents) }, ...(inv.dueOn ? [{ label: "Was due", value: day(inv.dueOn) }] : [])];
  return rendered(`Reminder: invoice #${inv.number} is past due`, from, `Invoice #${inv.number} is past due`, rows, { label: "View invoice", href: link });
}

export function quoteEmail(from: Sender, quote: { totalCents: number; address: string | null }, link: string): Rendered {
  const rows: Row[] = [{ label: "Quote", value: money(quote.totalCents) }, ...(quote.address ? [{ label: "For", value: quote.address }] : [])];
  return rendered(`Your quote from ${from.businessName}`, from, "Your quote", rows, { label: "View quote", href: link });
}
