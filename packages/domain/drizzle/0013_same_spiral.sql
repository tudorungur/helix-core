ALTER TABLE "legal_entities" ALTER COLUMN "account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_entities" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "tenancies" ADD COLUMN "tenant_legal_entity_id" uuid;--> statement-breakpoint
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_tenant_legal_entity_id_legal_entities_id_fk" FOREIGN KEY ("tenant_legal_entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: the one existing claimed tenancy (dev test data, tudor.ungur@gmail.com claiming as
-- Persoană Fizică "Anton Pann") gets a real user-scoped legal_entities row instead of losing its
-- identity to the column drop below.
INSERT INTO "legal_entities" ("id", "account_id", "user_id", "type", "legal_name", "vat_payer", "invoice_next_number")
VALUES (gen_random_uuid(), NULL, '02155464-3011-704c-fccf-be83f3884c5b', 'UNREGISTERED_INDIVIDUAL', 'Anton Pann', false, 1);--> statement-breakpoint
UPDATE "tenancies" SET "tenant_legal_entity_id" = (SELECT "id" FROM "legal_entities" WHERE "user_id" = '02155464-3011-704c-fccf-be83f3884c5b' AND "legal_name" = 'Anton Pann')
WHERE "id" = '1834f84e-6771-40f6-b6b1-8a09c67cd3e5';--> statement-breakpoint
ALTER TABLE "tenancies" DROP COLUMN "tenant_type";--> statement-breakpoint
ALTER TABLE "tenancies" DROP COLUMN "tenant_company_name";--> statement-breakpoint
ALTER TABLE "tenancies" DROP COLUMN "tenant_company_cui";--> statement-breakpoint
ALTER TABLE "tenancies" DROP COLUMN "tenant_individual_name";--> statement-breakpoint
DROP TYPE "public"."tenant_type";