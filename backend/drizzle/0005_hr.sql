-- Extend employees and add dated attendance. No demo rows. No payroll tables.
ALTER TABLE "employees" ADD COLUMN "code" text;
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "job_title" text;
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "department" text;
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "email" text;
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "salary_paise" bigint;
--> statement-breakpoint
UPDATE "employees" SET "code" = 'EMP-' || substr(replace("id"::text, '-', ''), 1, 8) WHERE "code" IS NULL;
--> statement-breakpoint
UPDATE "employees" SET "job_title" = '' WHERE "job_title" IS NULL;
--> statement-breakpoint
UPDATE "employees" SET "department" = '' WHERE "department" IS NULL;
--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "code" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "job_title" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "department" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_salary_check" CHECK ("salary_paise" is null or "salary_paise" >= 0);
--> statement-breakpoint
CREATE UNIQUE INDEX "employees_org_code_unique" ON "employees" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX "employees_email_lower_idx" ON "employees" USING btree ("organization_id", lower("email")) WHERE email IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "employees_org_name_idx" ON "employees" USING btree ("organization_id","name");
--> statement-breakpoint
CREATE INDEX "employees_org_department_idx" ON "employees" USING btree ("organization_id","department");
--> statement-breakpoint
CREATE TABLE "attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "work_date" date NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "attendance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_employee_date_unique" ON "attendance" USING btree ("employee_id","work_date");
--> statement-breakpoint
CREATE INDEX "attendance_org_date_idx" ON "attendance" USING btree ("organization_id","work_date");
--> statement-breakpoint
CREATE INDEX "attendance_org_employee_idx" ON "attendance" USING btree ("organization_id","employee_id");
