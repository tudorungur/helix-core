CREATE TYPE "public"."account_type" AS ENUM('B2C_INDIVIDUAL', 'B2B_COMPANY');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('REGISTERED_ANAF', 'C2B_WITHHOLDING', 'UNREGISTERED_C2C');--> statement-breakpoint
CREATE TYPE "public"."currency_code" AS ENUM('EUR', 'RON');--> statement-breakpoint
CREATE TYPE "public"."deposit_photo_phase" AS ENUM('MOVE_IN', 'MOVE_OUT');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('HELD', 'RETAINED_RENT', 'RETAINED_DAMAGE', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'ISSUED', 'SENT_ANAF', 'PAID', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('AUTO_EFACTURA', 'MANUAL_DECONT');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('OWNER', 'COLLABORATOR', 'ACCOUNTANT_READONLY');--> statement-breakpoint
CREATE TYPE "public"."meter_reading_status" AS ENUM('PENDING_AI', 'PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('MANUAL', 'NETOPIA_CARD');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartment_building', 'house');--> statement-breakpoint
CREATE TYPE "public"."tariff_basis" AS ENUM('METER_INDEX', 'FIXED_COST', 'QUOTA_SHARE', 'PER_PERSON');--> statement-breakpoint
CREATE TYPE "public"."tenancy_membership_role" AS ENUM('PRIMARY_TENANT', 'CO_TENANT');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."utility_type" AS ENUM('COLD_WATER', 'HOT_WATER', 'GAS', 'ELECTRICITY', 'INTERNET', 'TRASH', 'MAINTENANCE', 'OTHER');--> statement-breakpoint
CREATE TABLE "account_membership_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"property_id" uuid,
	"unit_id" uuid
);
--> statement-breakpoint
CREATE TABLE "account_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "account_type" NOT NULL,
	"legal_name" varchar(200),
	"cui_cnp" varchar(20),
	"vat_payer" boolean DEFAULT false NOT NULL,
	"invoice_series" varchar(10),
	"invoice_next_number" integer DEFAULT 1 NOT NULL,
	"anaf_oauth_status" varchar(30),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bnr_exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_date" date NOT NULL,
	"currency" varchar(3) NOT NULL,
	"rate_to_ron" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_condition_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deposit_id" uuid NOT NULL,
	"phase" "deposit_photo_phase" NOT NULL,
	"photo_s3_key" varchar(500) NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"currency" "currency_code" NOT NULL,
	"status" "deposit_status" DEFAULT 'HELD' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"netopia_transaction_id" varchar(100),
	"paid_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"retained_amount" numeric,
	"retention_justification_s3_key" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"unit_utility_id" uuid,
	"description" varchar(200) NOT NULL,
	"quantity" numeric,
	"unit_price" numeric,
	"amount" numeric NOT NULL,
	"source_amount" numeric,
	"source_currency" varchar(3),
	"fx_rate_used" numeric,
	"fx_rate_date" date,
	"withholding_tax_rate" numeric,
	"withholding_tax_amount" numeric,
	"net_amount_due" numeric
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"invoice_type" "invoice_type" NOT NULL,
	"series" varchar(10) NOT NULL,
	"number" varchar(20) NOT NULL,
	"vat_amount" numeric DEFAULT '0' NOT NULL,
	"total_amount" numeric NOT NULL,
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"anaf_upload_id" varchar(100),
	"pdf_s3_key" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "maintenance_ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"reported_by_user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'OPEN' NOT NULL,
	"photo_s3_key" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_utility_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"photo_s3_key" varchar(500),
	"ai_extracted_value" numeric,
	"ai_confidence" numeric,
	"confirmed_value" numeric,
	"confirmed_by_user_id" uuid,
	"status" "meter_reading_status" DEFAULT 'PENDING_AI' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"method" "payment_method" NOT NULL,
	"marked_by_user_id" uuid,
	"netopia_transaction_id" varchar(100),
	"paid_at" timestamp with time zone,
	"status" varchar(30) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"address" text NOT NULL,
	"type" "property_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"contract_type" "contract_type" NOT NULL,
	"status" varchar(30) NOT NULL,
	"rent_amount" numeric NOT NULL,
	"rent_currency" "currency_code" NOT NULL,
	"anaf_c168_registered" boolean DEFAULT false NOT NULL,
	"anaf_c168_registration_date" date
);
--> statement-breakpoint
CREATE TABLE "tenancy_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "tenancy_membership_role" NOT NULL,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "unit_utilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"utility_type" "utility_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"tariff_basis" "tariff_basis" NOT NULL,
	"unit_price" numeric,
	"fixed_amount" numeric,
	"quota_percentage" numeric,
	"sequence_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"label" varchar(100) NOT NULL,
	"area_sqm" numeric,
	"rooms" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(30),
	"name" varchar(200)
);
--> statement-breakpoint
ALTER TABLE "account_membership_scopes" ADD CONSTRAINT "account_membership_scopes_membership_id_account_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."account_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_membership_scopes" ADD CONSTRAINT "account_membership_scopes_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_membership_scopes" ADD CONSTRAINT "account_membership_scopes_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_condition_photos" ADD CONSTRAINT "deposit_condition_photos_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_condition_photos" ADD CONSTRAINT "deposit_condition_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_unit_utility_id_unit_utilities_id_fk" FOREIGN KEY ("unit_utility_id") REFERENCES "public"."unit_utilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_ticket_comments" ADD CONSTRAINT "maintenance_ticket_comments_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_ticket_comments" ADD CONSTRAINT "maintenance_ticket_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_unit_utility_id_unit_utilities_id_fk" FOREIGN KEY ("unit_utility_id") REFERENCES "public"."unit_utilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_marked_by_user_id_users_id_fk" FOREIGN KEY ("marked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancy_memberships" ADD CONSTRAINT "tenancy_memberships_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancy_memberships" ADD CONSTRAINT "tenancy_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_utilities" ADD CONSTRAINT "unit_utilities_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;