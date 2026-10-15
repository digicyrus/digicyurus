-- Append-only audit log. No demo rows. No update or delete.
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "actor_user_id" uuid REFERENCES "users"("id"),
  "action" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_org_created_idx" ON "audit_logs" USING btree ("organization_id", "created_at");
--> statement-breakpoint
CREATE INDEX "audit_logs_org_resource_idx" ON "audit_logs" USING btree ("organization_id", "resource_type");
--> statement-breakpoint
CREATE INDEX "audit_logs_org_actor_idx" ON "audit_logs" USING btree ("organization_id", "actor_user_id");
--> statement-breakpoint
CREATE INDEX "audit_logs_org_action_idx" ON "audit_logs" USING btree ("organization_id", "action");
