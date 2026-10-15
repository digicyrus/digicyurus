-- Company profile fields and user notification preferences.
-- No role grants are changed.
ALTER TABLE "organizations" ADD COLUMN "gstin" text;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_email" text;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address_line1" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address_line2" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "state" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "postal_code" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "country" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_gstin_check" CHECK ("gstin" is null or "gstin" ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "category" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
  CONSTRAINT "notification_preferences_category_check" CHECK ("category" in ('invoices', 'proposals', 'agreements', 'assets', 'tasks'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_category_unique" ON "notification_preferences" USING btree ("organization_id","user_id","category");
--> statement-breakpoint
CREATE INDEX "notification_preferences_org_user_idx" ON "notification_preferences" USING btree ("organization_id","user_id");
