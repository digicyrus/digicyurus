import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { clients } from "./crm.js";
import { organizations } from "./identity.js";

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    partner: text("partner").notNull(),
    clientId: uuid("client_id").references(() => clients.id),
    deals: integer("deals").notNull(),
    revenuePaise: bigint("revenue_paise", { mode: "number" }).notNull(),
    commissionPaise: bigint("commission_paise", { mode: "number" }).notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("referrals_org_code_unique").on(table.organizationId, table.code),
    index("referrals_org_status_idx").on(table.organizationId, table.status),
    index("referrals_org_client_idx").on(table.organizationId, table.clientId),
    check("referrals_status_check", sql`${table.status} in ('Pending', 'Paid')`),
    check("referrals_deals_check", sql`${table.deals} >= 0`),
    check("referrals_revenue_check", sql`${table.revenuePaise} >= 0`),
    check("referrals_commission_check", sql`${table.commissionPaise} >= 0`),
  ],
);

export const serviceRates = pgTable(
  "service_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    unit: text("unit").notNull(),
    ratePaise: bigint("rate_paise", { mode: "number" }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("service_rates_org_name_unique").on(table.organizationId, sql`lower(${table.name})`),
    index("service_rates_org_active_idx").on(table.organizationId, table.active),
    check("service_rates_rate_check", sql`${table.ratePaise} >= 0`),
  ],
);
