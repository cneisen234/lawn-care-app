-- Member scope (plan.md Section 3B, Step 6b; pilot-light/docs/site-conventions.md, SaaS sites).
--
-- Pilot Light runs a member's statements as the restricted role pilot_light_member, inside a
-- transaction that names the member in pilot_light.member_id. This migration is the
-- database's half: for that role, every table shows, changes and accepts ONLY the
-- member's own rows (row-level security), a new row is stamped with their id, and the
-- role can do nothing it isn't granted here. The site, the owner and jobs use the
-- database's own user, which these policies don't bind: nothing changes for them.
--
-- A NEW TABLE gets the same four statements before a member can reach it. Never grant
-- the role a table without its policy: `npm run db:check` fails if one is.

-- The role (kept if it's there), usable by this database's own user (Postgres 16+).
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pilot_light_member') THEN
    CREATE ROLE pilot_light_member NOLOGIN;
  END IF;
END $$;--> statement-breakpoint
GRANT pilot_light_member TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO pilot_light_member;--> statement-breakpoint

-- members: a member sees their own row, and may change only what's theirs to change
-- (never their email, subscription, comp, payouts or status).
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "members" FOR ALL TO pilot_light_member USING ("id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT ON "members" TO pilot_light_member;--> statement-breakpoint
GRANT UPDATE ("business_name", "contact_name", "phone", "address", "logo_url", "logo_key", "timezone", "tax_rate_bp", "mileage_rate_cents", "default_billing", "invoice_due_days", "updated_at") ON "members" TO pilot_light_member;--> statement-breakpoint

-- clients
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "clients" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "clients" TO pilot_light_member;--> statement-breakpoint

-- properties
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "properties" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "properties" TO pilot_light_member;--> statement-breakpoint

-- services
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "services" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "services" TO pilot_light_member;--> statement-breakpoint

-- service_packages
ALTER TABLE "service_packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "service_packages" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "service_packages" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "service_packages" TO pilot_light_member;--> statement-breakpoint

-- schedules
ALTER TABLE "schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "schedules" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "schedules" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "schedules" TO pilot_light_member;--> statement-breakpoint

-- quote_requests
ALTER TABLE "quote_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "quote_requests" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "quote_requests" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quote_requests" TO pilot_light_member;--> statement-breakpoint

-- jobs
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "jobs" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "jobs" TO pilot_light_member;--> statement-breakpoint

-- job_services
ALTER TABLE "job_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "job_services" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "job_services" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "job_services" TO pilot_light_member;--> statement-breakpoint

-- job_photos
ALTER TABLE "job_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "job_photos" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "job_photos" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "job_photos" TO pilot_light_member;--> statement-breakpoint

-- client_invoices
ALTER TABLE "client_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "client_invoices" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "client_invoices" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_invoices" TO pilot_light_member;--> statement-breakpoint

-- invoice_lines
ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "invoice_lines" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "invoice_lines" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoice_lines" TO pilot_light_member;--> statement-breakpoint

-- client_payments: read only (payments are recorded by the site from Stripe, never by a member)
ALTER TABLE "client_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "client_payments" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "client_payments" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT ON "client_payments" TO pilot_light_member;--> statement-breakpoint

-- expenses
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_scope" ON "expenses" FOR ALL TO pilot_light_member USING ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid) WITH CHECK ("member_id" = nullif(current_setting('pilot_light.member_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "member_id" SET DEFAULT nullif(current_setting('pilot_light.member_id', true), '')::uuid;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "expenses" TO pilot_light_member;
