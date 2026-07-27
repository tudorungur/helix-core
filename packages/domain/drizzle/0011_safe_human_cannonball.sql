ALTER TABLE "unit_utilities" DROP COLUMN "quota_percentage";--> statement-breakpoint
ALTER TABLE "public"."unit_utilities" ALTER COLUMN "tariff_basis" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."tariff_basis";--> statement-breakpoint
CREATE TYPE "public"."tariff_basis" AS ENUM('METER_INDEX', 'FIXED_COST', 'DECLARED');--> statement-breakpoint
ALTER TABLE "public"."unit_utilities" ALTER COLUMN "tariff_basis" SET DATA TYPE "public"."tariff_basis" USING "tariff_basis"::"public"."tariff_basis";