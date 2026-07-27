ALTER TABLE "tenancy_memberships" DROP CONSTRAINT "tenancy_memberships_tenancy_id_tenancies_id_fk";
--> statement-breakpoint
ALTER TABLE "tenancy_memberships" ADD CONSTRAINT "tenancy_memberships_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE cascade ON UPDATE no action;