ALTER TABLE "public"."accounts" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."account_type";--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('REGISTERED_INDIVIDUAL', 'REGISTERED_COMPANY', 'UNREGISTERED_INDIVIDUAL');--> statement-breakpoint
ALTER TABLE "public"."accounts" ALTER COLUMN "type" SET DATA TYPE "public"."account_type" USING "type"::"public"."account_type";