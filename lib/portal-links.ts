// The links in the emails to members' customers: an invoice or a quote, opened without signing in. Each link is
// the record's id and a signature over it (HMAC-SHA256 with PORTAL_LINK_SECRET), so it can't be guessed or changed
// to another record, and every email for the same record carries the same working link (a reminder never breaks
// the first email's link). The client portal (plan.md Step 14) checks it with `verifyPortalToken`.

import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getPortalLinkSecret, getSiteUrl } from "@/lib/env";

export type PortalKind = "invoice" | "quote";

const sign = (kind: PortalKind, id: string) => createHmac("sha256", getPortalLinkSecret()).update(`${kind}:${id}`).digest("base64url").slice(0, 32);

/** The token in a link: "<id>.<signature>". */
export function portalToken(kind: PortalKind, id: string): string {
  return `${id}.${sign(kind, id)}`;
}

/** The link to send. */
export function portalLink(kind: PortalKind, id: string): string {
  return `${getSiteUrl()}/${kind}/${portalToken(kind, id)}`;
}

/** What's stored on the record (never the token itself): its SHA-256, so a stored value can't be used as a link. */
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** The record a token opens, or null when it isn't one this site signed. */
export function verifyPortalToken(kind: PortalKind, token: string): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig || sig.length !== 32) return null;
  const expected = Buffer.from(sign(kind, id));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}
