-- Invoices, manual payments, and expenses. No demo rows.
CREATE TABLE "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "project_id" uuid,
  "number" text NOT NULL,
  "issue_date" date NOT NULL,
  "due_date" date NOT NULL,
  "status" text NOT NULL,
  "supply" text NOT NULL,
  "rate_bps" integer NOT NULL,
  "subtotal_paise" bigint NOT NULL,
  "cgst_paise" bigint NOT NULL,
  "sgst_paise" bigint NOT NULL,
  "igst_paise" bigint NOT NULL,
  "total_paise" bigint NOT NULL,
  "amount_paid_paise" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id"),
  CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id"),
  CONSTRAINT "invoices_status_check" CHECK ("status" in ('Draft', 'Pending', 'Paid')),
  CONSTRAINT "invoices_supply_check" CHECK ("supply" in ('cgst_sgst', 'igst')),
  CONSTRAINT "invoices_rate_check" CHECK ("rate_bps" between 0 and 10000),
  CONSTRAINT "invoices_dates_check" CHECK ("due_date" >= "issue_date"),
  CONSTRAINT "invoices_subtotal_check" CHECK ("subtotal_paise" >= 0),
  CONSTRAINT "invoices_tax_nonnegative_check" CHECK ("cgst_paise" >= 0 and "sgst_paise" >= 0 and "igst_paise" >= 0),
  CONSTRAINT "invoices_supply_split_check" CHECK (("supply" = 'igst' and "cgst_paise" = 0 and "sgst_paise" = 0) or ("supply" = 'cgst_sgst' and "igst_paise" = 0)),
  CONSTRAINT "invoices_total_check" CHECK ("total_paise" = "subtotal_paise" + "cgst_paise" + "sgst_paise" + "igst_paise"),
  CONSTRAINT "invoices_paid_check" CHECK ("amount_paid_paise" >= 0 and "amount_paid_paise" <= "total_paise")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_number_unique" ON "invoices" USING btree ("organization_id","number");
--> statement-breakpoint
CREATE INDEX "invoices_org_status_idx" ON "invoices" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "invoices_org_client_idx" ON "invoices" USING btree ("organization_id","client_id");
--> statement-breakpoint
CREATE INDEX "invoices_org_issue_idx" ON "invoices" USING btree ("organization_id","issue_date");
--> statement-breakpoint
CREATE INDEX "invoices_org_due_idx" ON "invoices" USING btree ("organization_id","due_date");
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "description" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price_paise" bigint NOT NULL,
  "amount_paise" bigint NOT NULL,
  CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade,
  CONSTRAINT "invoice_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "invoice_lines_price_check" CHECK ("unit_price_paise" >= 0),
  CONSTRAINT "invoice_lines_amount_check" CHECK ("amount_paise" = "quantity" * "unit_price_paise")
);
--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id","position");
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "paid_on" date NOT NULL,
  "amount_paise" bigint NOT NULL,
  "method" text NOT NULL,
  "reference" text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invoice_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade,
  CONSTRAINT "invoice_payments_amount_check" CHECK ("amount_paise" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_payments_invoice_reference_unique" ON "invoice_payments" USING btree ("invoice_id","reference");
--> statement-breakpoint
CREATE INDEX "invoice_payments_org_idx" ON "invoice_payments" USING btree ("organization_id","paid_on");
--> statement-breakpoint
CREATE TABLE "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "category" text NOT NULL,
  "vendor" text,
  "description" text DEFAULT '' NOT NULL,
  "amount_paise" bigint NOT NULL,
  "spent_on" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "expenses_amount_check" CHECK ("amount_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX "expenses_org_date_idx" ON "expenses" USING btree ("organization_id","spent_on");
--> statement-breakpoint
CREATE INDEX "expenses_org_category_idx" ON "expenses" USING btree ("organization_id","category");
