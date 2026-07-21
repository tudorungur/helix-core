ALTER TABLE "properties" ALTER COLUMN "type" SET DATA TYPE "unit_type" USING "type"::text::"unit_type";--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "street_number" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "street" varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "address_line2" varchar(200);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "postal_code" varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "city" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "county" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" DROP COLUMN "address";--> statement-breakpoint
DROP TYPE "public"."property_type";