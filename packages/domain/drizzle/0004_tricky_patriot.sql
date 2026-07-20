CREATE TYPE "public"."unit_type" AS ENUM('APARTMENT', 'HOUSE', 'RETAIL', 'WAREHOUSE', 'OFFICE');--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'commercial_building';--> statement-breakpoint
CREATE TABLE "legal_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" "account_type" NOT NULL,
	"legal_name" varchar(200),
	"cui_cnp" varchar(20),
	"vat_payer" boolean DEFAULT false NOT NULL,
	"invoice_series" varchar(10),
	"invoice_next_number" integer DEFAULT 1 NOT NULL,
	"anaf_oauth_status" varchar(30),
	CONSTRAINT "legal_entities_cui_cnp_unique" UNIQUE("cui_cnp")
);
--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_cui_cnp_unique";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "legal_entity_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "legal_entity_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "type" "unit_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_legal_entity_id_legal_entities_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_legal_entity_id_legal_entities_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "legal_name";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "cui_cnp";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "vat_payer";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "invoice_series";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "invoice_next_number";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "anaf_oauth_status";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "account_id";