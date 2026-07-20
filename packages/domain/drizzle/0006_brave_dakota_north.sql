ALTER TABLE "properties" DROP CONSTRAINT "properties_legal_entity_id_legal_entities_id_fk";
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "legal_entity_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_legal_entity_id_legal_entities_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" DROP COLUMN "legal_entity_id";--> statement-breakpoint
ALTER TABLE "properties" DROP COLUMN "type";