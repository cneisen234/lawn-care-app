CREATE TYPE "public"."payment_method" AS ENUM('cash', 'check', 'bank_transfer', 'other');--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'voided';--> statement-breakpoint
ALTER TABLE "client_payments" ALTER COLUMN "stripe_payment_intent" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_payments" ALTER COLUMN "stripe_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_payments" ADD COLUMN "method" "payment_method";--> statement-breakpoint
ALTER TABLE "client_payments" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_kind" CHECK (("client_payments"."method" is null and "client_payments"."stripe_payment_intent" is not null and "client_payments"."stripe_account_id" is not null) or ("client_payments"."method" is not null and "client_payments"."stripe_payment_intent" is null and "client_payments"."stripe_account_id" is null));--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_by_hand" CHECK (("client_payments"."method" is null and "client_payments"."status"::text <> 'voided') or ("client_payments"."method" is not null and "client_payments"."status"::text in ('succeeded', 'voided') and "client_payments"."refunded_cents" = 0));--> statement-breakpoint
-- Mark as paid (plan.md Step 13): a member records payments that came in outside the app (cash, a check…) and can
-- void one entered by mistake. Only those parts are theirs to write: never Stripe's ids or refunds (so never a card
-- payment: client_payments_kind refuses one without them), and nothing is ever deleted. The member_scope policy and
-- the stamping default (0001) already keep every row their own.
GRANT INSERT ("invoice_id", "amount_cents", "method", "note", "paid_at", "status") ON "client_payments" TO pilot_light_member;--> statement-breakpoint
GRANT UPDATE ("status", "updated_at") ON "client_payments" TO pilot_light_member;
--> statement-breakpoint
-- And a member may change a payment in exactly one way: void one recorded by hand (received → voided). Card payments
-- and everything else are the site's, from Stripe.
CREATE OR REPLACE FUNCTION "client_payments_member_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'pilot_light_member' AND NOT (OLD.method IS NOT NULL AND OLD.status::text = 'succeeded' AND NEW.status::text = 'voided') THEN
    RAISE EXCEPTION 'a member can only void a payment recorded by hand' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER "client_payments_member_change" BEFORE UPDATE ON "client_payments" FOR EACH ROW EXECUTE FUNCTION "client_payments_member_change"();
