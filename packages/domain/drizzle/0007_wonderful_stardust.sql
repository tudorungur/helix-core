ALTER TABLE "units" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" DROP COLUMN "active";