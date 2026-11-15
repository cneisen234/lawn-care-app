CREATE TYPE "public"."billing_cadence" AS ENUM('monthly', 'per_visit');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."expense_kind" AS ENUM('fuel', 'materials', 'equipment', 'mileage', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'ready', 'sent', 'overdue', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('quoted', 'scheduled', 'in_progress', 'done', 'invoiced', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."photo_kind" AS ENUM('before', 'after');--> statement-breakpoint
CREATE TYPE "public"."quote_request_status" AS ENUM('new', 'contacted', 'quoted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."schedule_cadence" AS ENUM('weekly', 'biweekly', 'every_n_days', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."service_pricing" AS ENUM('hourly', 'per_visit', 'per_sqft');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "client_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"client_email" text,
	"number" integer NOT NULL,
	"period_start" date,
	"period_end" date,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"tax_rate_bp" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"due_on" date,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"portal_token_hash" text,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_invoices_member_id_id_key" UNIQUE("member_id","id"),
	CONSTRAINT "client_invoices_member_number_key" UNIQUE("member_id","number"),
	CONSTRAINT "client_invoices_portal_token_key" UNIQUE("portal_token_hash"),
	CONSTRAINT "client_invoices_money_nonnegative" CHECK ("client_invoices"."subtotal_cents" >= 0 and "client_invoices"."tax_cents" >= 0 and "client_invoices"."total_cents" >= 0 and "client_invoices"."tax_rate_bp" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "client_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"stripe_payment_intent" text NOT NULL,
	"stripe_account_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_payments_intent_key" UNIQUE("stripe_payment_intent"),
	CONSTRAINT "client_payments_money" CHECK ("client_payments"."amount_cents" > 0 and "client_payments"."refunded_cents" between 0 and "client_payments"."amount_cents")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"billing_address" text,
	"billing" "billing_cadence",
	"notes" text,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_member_id_id_key" UNIQUE("member_id","id")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "expense_kind" NOT NULL,
	"date" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"miles" numeric(10, 1),
	"job_id" uuid,
	"note" text,
	"receipt_url" text,
	"receipt_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_money_nonnegative" CHECK ("expenses"."amount_cents" >= 0 and ("expenses"."miles" is null or "expenses"."miles" >= 0))
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"job_id" uuid,
	"service_date" date,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT 1 NOT NULL,
	"unit_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_lines_money_nonnegative" CHECK ("invoice_lines"."unit_cents" >= 0 and "invoice_lines"."amount_cents" >= 0 and "invoice_lines"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "job_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"image_key" text,
	"kind" "photo_kind" NOT NULL,
	"on_invoice" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"service_id" uuid,
	"name" text NOT NULL,
	"pricing" "service_pricing" NOT NULL,
	"quantity" numeric(10, 2) DEFAULT 1 NOT NULL,
	"rate_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_services_money_nonnegative" CHECK ("job_services"."rate_cents" >= 0 and "job_services"."amount_cents" >= 0 and "job_services"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"schedule_id" uuid,
	"quote_request_id" uuid,
	"client_email" text,
	"status" "job_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" date,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"minutes" integer GENERATED ALWAYS AS (case when started_at is not null and completed_at is not null then (extract(epoch from (completed_at - started_at)) / 60)::integer end) STORED,
	"weather_note" text,
	"quote_cents" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_member_id_id_key" UNIQUE("member_id","id"),
	CONSTRAINT "jobs_quote_nonnegative" CHECK ("jobs"."quote_cents" is null or "jobs"."quote_cents" >= 0),
	CONSTRAINT "jobs_completed_after_started" CHECK ("jobs"."completed_at" is null or "jobs"."started_at" is null or "jobs"."completed_at" >= "jobs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"logo_url" text,
	"logo_key" text,
	"timezone" text DEFAULT 'America/Detroit' NOT NULL,
	"tax_rate_bp" integer DEFAULT 0 NOT NULL,
	"mileage_rate_cents" integer DEFAULT 0 NOT NULL,
	"default_billing" "billing_cadence" DEFAULT 'monthly' NOT NULL,
	"invoice_due_days" integer DEFAULT 15 NOT NULL,
	"next_invoice_number" integer DEFAULT 1001 NOT NULL,
	"subscription_status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"comped" boolean DEFAULT false NOT NULL,
	"stripe_account_id" text,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_email_key" UNIQUE("email"),
	CONSTRAINT "members_tax_rate_range" CHECK ("members"."tax_rate_bp" between 0 and 10000),
	CONSTRAINT "members_money_nonnegative" CHECK ("members"."mileage_rate_cents" >= 0),
	CONSTRAINT "members_due_days_range" CHECK ("members"."invoice_due_days" between 0 and 120),
	CONSTRAINT "members_invoice_number_positive" CHECK ("members"."next_invoice_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"lawn_polygon" jsonb,
	"lawn_sqft" integer,
	"measured_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_member_id_id_key" UNIQUE("member_id","id"),
	CONSTRAINT "properties_lawn_sqft_positive" CHECK ("properties"."lawn_sqft" is null or "properties"."lawn_sqft" > 0)
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"note" text,
	"status" "quote_request_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_requests_member_id_id_key" UNIQUE("member_id","id")
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"cadence" "schedule_cadence" NOT NULL,
	"every_n_days" integer,
	"weekday" integer,
	"day_of_month" integer,
	"service_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"package_id" uuid,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_member_id_id_key" UNIQUE("member_id","id"),
	CONSTRAINT "schedules_every_n_days_positive" CHECK ("schedules"."every_n_days" is null or "schedules"."every_n_days" between 1 and 365),
	CONSTRAINT "schedules_weekday_range" CHECK ("schedules"."weekday" is null or "schedules"."weekday" between 0 and 6),
	CONSTRAINT "schedules_day_of_month_range" CHECK ("schedules"."day_of_month" is null or "schedules"."day_of_month" between 1 and 28)
);
--> statement-breakpoint
CREATE TABLE "service_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"season" text,
	"start_month" integer NOT NULL,
	"end_month" integer NOT NULL,
	"service_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_packages_member_id_id_key" UNIQUE("member_id","id"),
	CONSTRAINT "service_packages_months_range" CHECK ("service_packages"."start_month" between 1 and 12 and "service_packages"."end_month" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"pricing" "service_pricing" NOT NULL,
	"rate_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_member_id_id_key" UNIQUE("member_id","id"),
	CONSTRAINT "services_rate_nonnegative" CHECK ("services"."rate_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_member_client_fk" FOREIGN KEY ("member_id","client_id") REFERENCES "public"."clients"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_invoice_id_client_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."client_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_member_invoice_fk" FOREIGN KEY ("member_id","invoice_id") REFERENCES "public"."client_invoices"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_member_job_fk" FOREIGN KEY ("member_id","job_id") REFERENCES "public"."jobs"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_client_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."client_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_member_invoice_fk" FOREIGN KEY ("member_id","invoice_id") REFERENCES "public"."client_invoices"("member_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_member_job_fk" FOREIGN KEY ("member_id","job_id") REFERENCES "public"."jobs"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_member_job_fk" FOREIGN KEY ("member_id","job_id") REFERENCES "public"."jobs"("member_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_services" ADD CONSTRAINT "job_services_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_services" ADD CONSTRAINT "job_services_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_services" ADD CONSTRAINT "job_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_services" ADD CONSTRAINT "job_services_member_job_fk" FOREIGN KEY ("member_id","job_id") REFERENCES "public"."jobs"("member_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_services" ADD CONSTRAINT "job_services_member_service_fk" FOREIGN KEY ("member_id","service_id") REFERENCES "public"."services"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_quote_request_id_quote_requests_id_fk" FOREIGN KEY ("quote_request_id") REFERENCES "public"."quote_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_member_client_fk" FOREIGN KEY ("member_id","client_id") REFERENCES "public"."clients"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_member_property_fk" FOREIGN KEY ("member_id","property_id") REFERENCES "public"."properties"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_member_schedule_fk" FOREIGN KEY ("member_id","schedule_id") REFERENCES "public"."schedules"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_member_quote_request_fk" FOREIGN KEY ("member_id","quote_request_id") REFERENCES "public"."quote_requests"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_member_client_fk" FOREIGN KEY ("member_id","client_id") REFERENCES "public"."clients"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_member_client_fk" FOREIGN KEY ("member_id","client_id") REFERENCES "public"."clients"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_member_property_fk" FOREIGN KEY ("member_id","property_id") REFERENCES "public"."properties"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_member_package_fk" FOREIGN KEY ("member_id","package_id") REFERENCES "public"."service_packages"("member_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_invoices_member_status_idx" ON "client_invoices" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "client_invoices_member_client_idx" ON "client_invoices" USING btree ("member_id","client_id");--> statement-breakpoint
CREATE INDEX "client_payments_member_invoice_idx" ON "client_payments" USING btree ("member_id","invoice_id");--> statement-breakpoint
CREATE INDEX "clients_member_name_idx" ON "clients" USING btree ("member_id","name");--> statement-breakpoint
CREATE INDEX "expenses_member_date_idx" ON "expenses" USING btree ("member_id","date");--> statement-breakpoint
CREATE INDEX "invoice_lines_member_invoice_idx" ON "invoice_lines" USING btree ("member_id","invoice_id");--> statement-breakpoint
CREATE INDEX "job_photos_member_job_idx" ON "job_photos" USING btree ("member_id","job_id");--> statement-breakpoint
CREATE INDEX "job_services_member_job_idx" ON "job_services" USING btree ("member_id","job_id");--> statement-breakpoint
CREATE INDEX "jobs_member_scheduled_idx" ON "jobs" USING btree ("member_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "jobs_member_status_idx" ON "jobs" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "jobs_member_client_idx" ON "jobs" USING btree ("member_id","client_id");--> statement-breakpoint
CREATE INDEX "properties_member_client_idx" ON "properties" USING btree ("member_id","client_id");--> statement-breakpoint
CREATE INDEX "quote_requests_member_status_idx" ON "quote_requests" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "schedules_member_client_idx" ON "schedules" USING btree ("member_id","client_id");--> statement-breakpoint
CREATE INDEX "service_packages_member_idx" ON "service_packages" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "services_member_idx" ON "services" USING btree ("member_id");