-- Campaigns, content calendar, referrals, and service rates. No demo rows.
CREATE TABLE "campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "channel" text NOT NULL,
  "spend_paise" bigint NOT NULL,
  "leads" integer NOT NULL,
  "roi_hundredths" integer NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "campaigns_status_check" CHECK ("status" in ('Running', 'Paused')),
  CONSTRAINT "campaigns_spend_check" CHECK ("spend_paise" >= 0),
  CONSTRAINT "campaigns_leads_check" CHECK ("leads" >= 0),
  CONSTRAINT "campaigns_roi_check" CHECK ("roi_hundredths" between 0 and 100000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_org_name_unique" ON "campaigns" USING btree ("organization_id", lower("name"));
--> statement-breakpoint
CREATE INDEX "campaigns_org_status_idx" ON "campaigns" USING btree ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX "campaigns_org_channel_idx" ON "campaigns" USING btree ("organization_id", "channel");
--> statement-breakpoint
CREATE TABLE "content_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "title" text NOT NULL,
  "channel" text NOT NULL,
  "publish_date" date NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_items_status_check" CHECK ("status" in ('Draft', 'Scheduled', 'Published'))
);
--> statement-breakpoint
CREATE INDEX "content_items_org_date_idx" ON "content_items" USING btree ("organization_id", "publish_date");
--> statement-breakpoint
CREATE INDEX "content_items_org_status_idx" ON "content_items" USING btree ("organization_id", "status");
--> statement-breakpoint
CREATE TABLE "referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "code" text NOT NULL,
  "partner" text NOT NULL,
  "client_id" uuid REFERENCES "clients"("id"),
  "deals" integer NOT NULL,
  "revenue_paise" bigint NOT NULL,
  "commission_paise" bigint NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "referrals_status_check" CHECK ("status" in ('Pending', 'Paid')),
  CONSTRAINT "referrals_deals_check" CHECK ("deals" >= 0),
  CONSTRAINT "referrals_revenue_check" CHECK ("revenue_paise" >= 0),
  CONSTRAINT "referrals_commission_check" CHECK ("commission_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_org_code_unique" ON "referrals" USING btree ("organization_id", "code");
--> statement-breakpoint
CREATE INDEX "referrals_org_status_idx" ON "referrals" USING btree ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX "referrals_org_client_idx" ON "referrals" USING btree ("organization_id", "client_id");
--> statement-breakpoint
CREATE TABLE "service_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "unit" text NOT NULL,
  "rate_paise" bigint NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_rates_rate_check" CHECK ("rate_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "service_rates_org_name_unique" ON "service_rates" USING btree ("organization_id", lower("name"));
--> statement-breakpoint
CREATE INDEX "service_rates_org_active_idx" ON "service_rates" USING btree ("organization_id", "active");
