-- CRM clients, leads, and follow-ups. No demo rows.
CREATE TABLE "clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "contact_name" text NOT NULL,
  "industry" text NOT NULL,
  "status" text NOT NULL,
  "rating" integer NOT NULL,
  "customer_since" date NOT NULL,
  "email" text,
  "phone" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "clients_status_check" CHECK ("status" in ('Active', 'On Hold', 'Prospect')),
  CONSTRAINT "clients_rating_check" CHECK ("rating" between 1 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "clients_org_code_unique" ON "clients" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX "clients_email_lower_idx" ON "clients" USING btree ("organization_id", lower("email")) WHERE email IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "clients_org_name_idx" ON "clients" USING btree ("organization_id","name");
--> statement-breakpoint
CREATE INDEX "clients_org_status_idx" ON "clients" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE TABLE "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "client_id" uuid,
  "code" text NOT NULL,
  "company" text NOT NULL,
  "person" text NOT NULL,
  "stage" text NOT NULL,
  "value_paise" bigint NOT NULL,
  "source" text NOT NULL,
  "priority" text NOT NULL,
  "expected_close" date NOT NULL,
  "probability" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id"),
  CONSTRAINT "leads_stage_check" CHECK ("stage" in ('New', 'Contacted', 'Qualified', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Won', 'Lost')),
  CONSTRAINT "leads_priority_check" CHECK ("priority" in ('High', 'Medium', 'Low')),
  CONSTRAINT "leads_probability_check" CHECK ("probability" between 0 and 100),
  CONSTRAINT "leads_value_check" CHECK ("value_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "leads_org_code_unique" ON "leads" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE INDEX "leads_org_stage_idx" ON "leads" USING btree ("organization_id","stage");
--> statement-breakpoint
CREATE TABLE "follow_ups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "client_id" uuid,
  "lead_id" uuid,
  "owner_employee_id" uuid NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "follow_ups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "follow_ups_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id"),
  CONSTRAINT "follow_ups_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id"),
  CONSTRAINT "follow_ups_owner_employee_id_employees_id_fk" FOREIGN KEY ("owner_employee_id") REFERENCES "public"."employees"("id"),
  CONSTRAINT "follow_ups_subject_check" CHECK ("client_id" is not null or "lead_id" is not null),
  CONSTRAINT "follow_ups_status_check" CHECK ("status" in ('Due', 'Missed', 'Upcoming', 'Completed'))
);
--> statement-breakpoint
CREATE INDEX "follow_ups_org_due_idx" ON "follow_ups" USING btree ("organization_id","due_at");
--> statement-breakpoint
CREATE INDEX "follow_ups_client_idx" ON "follow_ups" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX "follow_ups_lead_idx" ON "follow_ups" USING btree ("lead_id");
