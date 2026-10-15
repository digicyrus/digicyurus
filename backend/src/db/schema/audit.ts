import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations, users } from "./identity.js";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_org_created_idx").on(table.organizationId, table.createdAt),
    index("audit_logs_org_resource_idx").on(table.organizationId, table.resourceType),
    index("audit_logs_org_actor_idx").on(table.organizationId, table.actorUserId),
    index("audit_logs_org_action_idx").on(table.organizationId, table.action),
  ],
);
