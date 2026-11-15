// What Pilot Light calls on this site (pilot-light/docs/site-conventions.md §3):
// every call is signed with the site's secret, recent, and never repeated, and
// the site module checks all of that before anything here runs. `ping` is built
// in (Pilot Light's health check and `site:check`). Site actions are added here
// as their steps declare them (`npm run site:actions`): the client emails come
// in plan.md Step 12.

import { pilotLightRoute } from "@/lib/pilot-light";

export const POST = pilotLightRoute({});
