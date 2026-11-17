// What Pilot Light calls on this site (pilot-light/docs/site-conventions.md §3): every call is signed with the site's
// secret, recent, and never repeated, and the site module checks all of that before anything here runs. `ping` is
// built in (Pilot Light's health check and `site:check`). Each site action is declared in Pilot Light
// (`npm run site:actions`); what they do is lib/site-actions.ts (plan.md Step 12).

import { pilotLightRoute } from "@/lib/pilot-light";
import { invoiceRemind, invoiceSend, quoteSend } from "@/lib/site-actions";

export const POST = pilotLightRoute({ "invoice-send": invoiceSend, "invoice-remind": invoiceRemind, "quote-send": quoteSend });
