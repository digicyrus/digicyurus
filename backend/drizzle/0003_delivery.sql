-- Projects, tasks, and personal planner entries. No demo rows.
CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "manager_employee_id" uuid,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "status" text NOT NULL,
  "priority" text NOT NULL,
  "start_date" date NOT NULL,
  "due_date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id"),
  CONSTRAINT "projects_manager_employee_id_employees_id_fk" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id"),
  CONSTRAINT "projects_status_check" CHECK ("status" in ('On Track', 'At Risk', 'Delayed', 'Completed')),
  CONSTRAINT "projects_priority_check" CHECK ("priority" in ('High', 'Medium', 'Low')),
  CONSTRAINT "projects_dates_check" CHECK ("due_date" >= "start_date")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_code_unique" ON "projects" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE INDEX "projects_org_status_idx" ON "projects" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "projects_org_client_idx" ON "projects" USING btree ("organization_id","client_id");
--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");
--> statement-breakpoint
CREATE TABLE "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "assignee_employee_id" uuid,
  "assignee_user_id" uuid,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "status" text NOT NULL,
  "priority" text NOT NULL,
  "due_date" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id"),
  CONSTRAINT "tasks_assignee_employee_id_employees_id_fk" FOREIGN KEY ("assignee_employee_id") REFERENCES "public"."employees"("id"),
  CONSTRAINT "tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id"),
  CONSTRAINT "tasks_status_check" CHECK ("status" in ('Backlog', 'In Progress', 'Review', 'Done')),
  CONSTRAINT "tasks_priority_check" CHECK ("priority" in ('High', 'Medium', 'Low'))
);
--> statement-breakpoint
CREATE INDEX "tasks_org_project_idx" ON "tasks" USING btree ("organization_id","project_id");
--> statement-breakpoint
CREATE INDEX "tasks_org_status_idx" ON "tasks" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "tasks_org_due_idx" ON "tasks" USING btree ("organization_id","due_date");
--> statement-breakpoint
CREATE INDEX "tasks_assignee_employee_idx" ON "tasks" USING btree ("assignee_employee_id");
--> statement-breakpoint
CREATE INDEX "tasks_assignee_user_idx" ON "tasks" USING btree ("assignee_user_id");
--> statement-breakpoint
CREATE TABLE "planner_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "entry_date" date NOT NULL,
  "time_of_day" text,
  "done" boolean DEFAULT false NOT NULL,
  "tag" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "planner_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id"),
  CONSTRAINT "planner_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"),
  CONSTRAINT "planner_entries_time_check" CHECK ("time_of_day" is null or "time_of_day" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE INDEX "planner_entries_owner_date_idx" ON "planner_entries" USING btree ("organization_id","user_id","entry_date");
