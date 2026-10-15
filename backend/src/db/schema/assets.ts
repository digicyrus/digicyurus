import { sql } from "drizzle-orm";
import { bigint, check, date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "./identity.js";

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    type: text("type").notNull(),
    vendor: text("vendor").notNull(),
    renewalOn: date("renewal_on", { mode: "string" }).notNull(),
    costPaise: bigint("cost_paise", { mode: "number" }).notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("assets_org_name_unique").on(table.organizationId, sql`lower(${table.name})`),
    index("assets_org_type_idx").on(table.organizationId, table.type),
    index("assets_org_status_idx").on(table.organizationId, table.status),
    index("assets_org_renewal_idx").on(table.organizationId, table.renewalOn),
    check("assets_type_check", sql`${table.type} in ('Domain', 'Hosting', 'SSL', 'License', 'Subscription')`),
    check("assets_status_check", sql`${table.status} in ('Active', 'Due Soon')`),
    check("assets_cost_check", sql`${table.costPaise} >= 0`),
  ],
);
