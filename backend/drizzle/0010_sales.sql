-- Sales pipeline, proposals, and agreements. No demo rows.
-- New permissions are inserted without changing existing role grants.
CREATE TABLE "opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "reference" text NOT NULL,
  "title" text NOT NULL,
  "client_id" uuid REFERENCES "clients"("id"),
  "lead_id" uuid REFERENCES "leads"("id"),
  "owner_employee_id" uuid REFERENCES "employees"("id"),
  "value_paise" bigint NOT NULL,
  "expected_close" date NOT NULL,
  "source" text NOT NULL,
  "priority" text NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "stage" text NOT NULL,
  "lost_reason" text,
  "closed_on" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "opportunities_stage_check" CHECK ("stage" in ('Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost')),
  CONSTRAINT "opportunities_priority_check" CHECK ("priority" in ('High', 'Medium', 'Low')),
  CONSTRAINT "opportunities_value_check" CHECK ("value_paise" >= 0),
  CONSTRAINT "opportunities_close_check" CHECK (
    ("stage" = 'Lost' AND "lost_reason" IS NOT NULL AND char_length(btrim("lost_reason")) > 0 AND "closed_on" IS NOT NULL)
    OR ("stage" = 'Won' AND "lost_reason" IS NULL AND "closed_on" IS NOT NULL)
    OR ("stage" NOT IN ('Won', 'Lost') AND "lost_reason" IS NULL AND "closed_on" IS NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_org_reference_unique" ON "opportunities" USING btree ("organization_id","reference");
--> statement-breakpoint
CREATE INDEX "opportunities_org_stage_idx" ON "opportunities" USING btree ("organization_id","stage");
--> statement-breakpoint
CREATE INDEX "opportunities_org_owner_idx" ON "opportunities" USING btree ("organization_id","owner_employee_id");
--> statement-breakpoint
CREATE INDEX "opportunities_org_client_idx" ON "opportunities" USING btree ("organization_id","client_id");
--> statement-breakpoint
CREATE INDEX "opportunities_org_lead_idx" ON "opportunities" USING btree ("organization_id","lead_id");
--> statement-breakpoint
CREATE INDEX "opportunities_org_expected_idx" ON "opportunities" USING btree ("organization_id","expected_close");
--> statement-breakpoint
CREATE INDEX "opportunities_org_closed_idx" ON "opportunities" USING btree ("organization_id","closed_on");
--> statement-breakpoint
CREATE TABLE "opportunity_stage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id") ON DELETE cascade,
  "from_stage" text,
  "to_stage" text NOT NULL,
  "lost_reason" text,
  "closed_on" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "opportunity_stage_events_stage_check" CHECK (
    "to_stage" in ('Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost')
    AND ("from_stage" IS NULL OR "from_stage" in ('Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'))
  )
);
--> statement-breakpoint
CREATE INDEX "opportunity_stage_events_opportunity_idx" ON "opportunity_stage_events" USING btree ("organization_id","opportunity_id","created_at");
--> statement-breakpoint
CREATE TABLE "opportunity_stage_probabilities" (
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "stage" text NOT NULL,
  "probability" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "opportunity_stage_probabilities_pkey" PRIMARY KEY ("organization_id","stage"),
  CONSTRAINT "opportunity_stage_probabilities_stage_check" CHECK ("stage" in ('Qualification', 'Discovery', 'Proposal', 'Negotiation')),
  CONSTRAINT "opportunity_stage_probabilities_probability_check" CHECK ("probability" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "number" text NOT NULL,
  "title" text NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "opportunity_id" uuid REFERENCES "opportunities"("id"),
  "status" text NOT NULL,
  "validity_date" date NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "rate_bps" integer NOT NULL,
  "subtotal_paise" bigint NOT NULL,
  "discount_paise" bigint NOT NULL,
  "tax_paise" bigint NOT NULL,
  "total_paise" bigint NOT NULL,
  "sent_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "expired_at" timestamp with time zone,
  "status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "proposals_status_check" CHECK ("status" in ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired')),
  CONSTRAINT "proposals_rate_check" CHECK ("rate_bps" between 0 and 10000),
  CONSTRAINT "proposals_money_check" CHECK (
    "subtotal_paise" >= 0
    AND "discount_paise" >= 0
    AND "discount_paise" <= "subtotal_paise"
    AND "tax_paise" >= 0
    AND "total_paise" = "subtotal_paise" - "discount_paise" + "tax_paise"
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_org_number_unique" ON "proposals" USING btree ("organization_id","number");
--> statement-breakpoint
CREATE INDEX "proposals_org_status_idx" ON "proposals" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "proposals_org_client_idx" ON "proposals" USING btree ("organization_id","client_id");
--> statement-breakpoint
CREATE INDEX "proposals_org_opportunity_idx" ON "proposals" USING btree ("organization_id","opportunity_id");
--> statement-breakpoint
CREATE INDEX "proposals_org_validity_idx" ON "proposals" USING btree ("organization_id","validity_date");
--> statement-breakpoint
CREATE TABLE "proposal_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "proposal_id" uuid NOT NULL REFERENCES "proposals"("id") ON DELETE cascade,
  "position" integer NOT NULL,
  "description" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price_paise" bigint NOT NULL,
  "discount_paise" bigint NOT NULL,
  "amount_paise" bigint NOT NULL,
  CONSTRAINT "proposal_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "proposal_lines_price_check" CHECK ("unit_price_paise" >= 0),
  CONSTRAINT "proposal_lines_discount_check" CHECK ("discount_paise" >= 0 AND "discount_paise" <= "quantity" * "unit_price_paise"),
  CONSTRAINT "proposal_lines_amount_check" CHECK ("amount_paise" = "quantity" * "unit_price_paise" - "discount_paise")
);
--> statement-breakpoint
CREATE INDEX "proposal_lines_proposal_idx" ON "proposal_lines" USING btree ("proposal_id","position");
--> statement-breakpoint
CREATE TABLE "proposal_status_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "proposal_id" uuid NOT NULL REFERENCES "proposals"("id") ON DELETE cascade,
  "from_status" text,
  "to_status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "proposal_status_events_status_check" CHECK ("to_status" in ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'))
);
--> statement-breakpoint
CREATE INDEX "proposal_status_events_proposal_idx" ON "proposal_status_events" USING btree ("organization_id","proposal_id","created_at");
--> statement-breakpoint
CREATE TABLE "agreements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "number" text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "opportunity_id" uuid REFERENCES "opportunities"("id"),
  "proposal_id" uuid REFERENCES "proposals"("id"),
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "value_paise" bigint NOT NULL,
  "status" text NOT NULL,
  "activated_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "terminated_at" timestamp with time zone,
  "expired_at" timestamp with time zone,
  "status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agreements_status_check" CHECK ("status" in ('Draft', 'Active', 'Completed', 'Terminated', 'Expired')),
  CONSTRAINT "agreements_dates_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "agreements_value_check" CHECK ("value_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agreements_org_number_unique" ON "agreements" USING btree ("organization_id","number");
--> statement-breakpoint
CREATE INDEX "agreements_org_status_idx" ON "agreements" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "agreements_org_client_idx" ON "agreements" USING btree ("organization_id","client_id");
--> statement-breakpoint
CREATE INDEX "agreements_org_opportunity_idx" ON "agreements" USING btree ("organization_id","opportunity_id");
--> statement-breakpoint
CREATE INDEX "agreements_org_proposal_idx" ON "agreements" USING btree ("organization_id","proposal_id");
--> statement-breakpoint
CREATE INDEX "agreements_org_end_idx" ON "agreements" USING btree ("organization_id","end_date");
--> statement-breakpoint
CREATE TABLE "agreement_status_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "agreement_id" uuid NOT NULL REFERENCES "agreements"("id") ON DELETE cascade,
  "from_status" text,
  "to_status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agreement_status_events_status_check" CHECK ("to_status" in ('Draft', 'Active', 'Completed', 'Terminated', 'Expired'))
);
--> statement-breakpoint
CREATE INDEX "agreement_status_events_agreement_idx" ON "agreement_status_events" USING btree ("organization_id","agreement_id","created_at");
--> statement-breakpoint
INSERT INTO "permissions" ("key")
SELECT v."key"
FROM (
  VALUES
    ('pipeline:view'),
    ('pipeline:create'),
    ('pipeline:update'),
    ('pipeline:move_stage'),
    ('forecast:view'),
    ('proposals:change_status'),
    ('agreements:change_status')
) AS v("key")
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" existing WHERE existing."key" = v."key"
);
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
INNER JOIN "permissions" p ON p."key" IN (
  'pipeline:view',
  'pipeline:create',
  'pipeline:update',
  'pipeline:move_stage',
  'forecast:view',
  'proposals:change_status',
  'agreements:change_status'
)
WHERE r."key" IN ('super_admin', 'sales_executive')
AND NOT EXISTS (
  SELECT 1 FROM "role_permissions" existing
  WHERE existing."role_id" = r."id" AND existing."permission_id" = p."id"
);
