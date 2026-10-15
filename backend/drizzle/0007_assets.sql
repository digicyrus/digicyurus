-- Organization asset register. No demo rows. No audit log.
CREATE TABLE "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "type" text NOT NULL,
  "vendor" text NOT NULL,
  "renewal_on" date NOT NULL,
  "cost_paise" bigint NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assets_type_check" CHECK ("type" in ('Domain', 'Hosting', 'SSL', 'License', 'Subscription')),
  CONSTRAINT "assets_status_check" CHECK ("status" in ('Active', 'Due Soon')),
  CONSTRAINT "assets_cost_check" CHECK ("cost_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "assets_org_name_unique" ON "assets" USING btree ("organization_id", lower("name"));
--> statement-breakpoint
CREATE INDEX "assets_org_type_idx" ON "assets" USING btree ("organization_id", "type");
--> statement-breakpoint
CREATE INDEX "assets_org_status_idx" ON "assets" USING btree ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX "assets_org_renewal_idx" ON "assets" USING btree ("organization_id", "renewal_on");
