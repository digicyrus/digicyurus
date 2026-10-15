CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "singleton" boolean DEFAULT true NOT NULL,
  "legal_name" text NOT NULL,
  "brand_name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_singleton_unique" UNIQUE("singleton")
);
--> statement-breakpoint
CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "roles_key_unique" UNIQUE("key"),
  CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade,
  CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade,
  CONSTRAINT "role_permissions_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
);
--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "employee_id" uuid,
  "role_id" uuid NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_employee_id_unique" UNIQUE("employee_id"),
  CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "users_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id"),
  CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id"),
  CONSTRAINT "users_status_check" CHECK ("status" in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));
--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
  CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "sessions_user_expires_idx" ON "sessions" USING btree ("user_id","expires_at");
--> statement-breakpoint
INSERT INTO "roles" ("key", "name") VALUES
  ('super_admin', 'Super Admin'),
  ('admin', 'Admin'),
  ('sales_executive', 'Sales Executive'),
  ('project_manager', 'Project Manager'),
  ('developer', 'Developer'),
  ('marketing_executive', 'Marketing Executive'),
  ('hr', 'HR'),
  ('accountant', 'Accountant'),
  ('client', 'Client');
--> statement-breakpoint
INSERT INTO "permissions" ("key") VALUES
  ('dashboard:view'),
  ('clients:view'),
  ('clients:create'),
  ('clients:update'),
  ('leads:view'),
  ('leads:create'),
  ('leads:update'),
  ('leads:move_stage'),
  ('follow_ups:view'),
  ('follow_ups:create'),
  ('follow_ups:update'),
  ('sales:view'),
  ('proposals:view'),
  ('proposals:create'),
  ('proposals:update'),
  ('agreements:view'),
  ('agreements:create'),
  ('agreements:update'),
  ('projects:view'),
  ('projects:create'),
  ('projects:update'),
  ('tasks:view'),
  ('tasks:create'),
  ('tasks:update'),
  ('planner:view'),
  ('planner:update'),
  ('campaigns:view'),
  ('content:view'),
  ('finance:view'),
  ('invoices:view'),
  ('invoices:create'),
  ('invoices:update'),
  ('invoices:record_payment'),
  ('invoices:export'),
  ('expenses:view'),
  ('expenses:create'),
  ('expenses:update'),
  ('referrals:view'),
  ('referrals:create'),
  ('referrals:update'),
  ('reports:view'),
  ('reports:export'),
  ('assets:view'),
  ('assets:create'),
  ('assets:update'),
  ('employees:view'),
  ('employees:create'),
  ('employees:update'),
  ('attendance:view'),
  ('payroll:view'),
  ('daily_reports:view'),
  ('daily_reports:create'),
  ('daily_reports:update'),
  ('settings:view'),
  ('settings:update'),
  ('service_rates:view'),
  ('service_rates:update'),
  ('roles:view'),
  ('roles:update');
--> statement-breakpoint
-- role:super_admin
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."key" = 'super_admin';
--> statement-breakpoint
-- role:admin
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
INNER JOIN "permissions" p ON p."key" IN ('dashboard:view', 'clients:view', 'clients:create', 'clients:update', 'projects:view', 'projects:create', 'projects:update', 'tasks:view', 'tasks:create', 'tasks:update', 'finance:view', 'invoices:view', 'invoices:create', 'invoices:update', 'invoices:record_payment', 'invoices:export', 'expenses:view', 'expenses:create', 'expenses:update', 'referrals:view', 'referrals:create', 'referrals:update', 'employees:view', 'employees:create', 'employees:update', 'attendance:view', 'payroll:view', 'daily_reports:view', 'daily_reports:create', 'daily_reports:update', 'reports:view', 'reports:export')
WHERE r."key" = 'admin';
--> statement-breakpoint
-- role:sales_executive
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
INNER JOIN "permissions" p ON p."key" IN ('dashboard:view', 'clients:view', 'clients:create', 'clients:update', 'leads:view', 'leads:create', 'leads:update', 'leads:move_stage', 'follow_ups:view', 'follow_ups:create', 'follow_ups:update', 'sales:view', 'proposals:view', 'proposals:create', 'proposals:update', 'agreements:view', 'agreements:create', 'agreements:update')
WHERE r."key" = 'sales_executive';
--> statement-breakpoint
-- role:project_manager
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
INNER JOIN "permissions" p ON p."key" IN ('dashboard:view', 'clients:view', 'projects:view', 'projects:create', 'projects:update', 'tasks:view', 'tasks:create', 'tasks:update')
WHERE r."key" = 'project_manager';
--> statement-breakpoint
-- role:developer
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
INNER JOIN "permissions" p ON p."key" IN ('projects:view', 'tasks:view', 'tasks:update', 'planner:view', 'planner:update')
WHERE r."key" = 'developer';
--> statement-breakpoint
-- role:marketing_executive
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
INNER JOIN "permissions" p ON p."key" IN ('campaigns:view', 'content:view', 'leads:view', 'reports:view', 'reports:export')
WHERE r."key" = 'marketing_executive';
--> statement-breakpoint
-- role:hr
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
INNER JOIN "permissions" p ON p."key" IN ('employees:view', 'attendance:view', 'payroll:view', 'daily_reports:view')
WHERE r."key" = 'hr';
--> statement-breakpoint
-- role:accountant
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
INNER JOIN "permissions" p ON p."key" IN ('finance:view', 'invoices:view', 'invoices:create', 'invoices:update', 'invoices:record_payment', 'invoices:export', 'expenses:view', 'referrals:view', 'reports:view', 'reports:export')
WHERE r."key" = 'accountant';
-- role:client
-- Client receives no permission grants.
