import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "./identity.js";

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    channel: text("channel").notNull(),
    spendPaise: bigint("spend_paise", { mode: "number" }).notNull(),
    leads: integer("leads").notNull(),
    roiHundredths: integer("roi_hundredths").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("campaigns_org_name_unique").on(table.organizationId, sql`lower(${table.name})`),
    index("campaigns_org_status_idx").on(table.organizationId, table.status),
    index("campaigns_org_channel_idx").on(table.organizationId, table.channel),
    check("campaigns_status_check", sql`${table.status} in ('Running', 'Paused')`),
    check("campaigns_spend_check", sql`${table.spendPaise} >= 0`),
    check("campaigns_leads_check", sql`${table.leads} >= 0`),
    check("campaigns_roi_check", sql`${table.roiHundredths} between 0 and 100000`),
  ],
);

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    title: text("title").notNull(),
    channel: text("channel").notNull(),
    publishDate: date("publish_date", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("content_items_org_date_idx").on(table.organizationId, table.publishDate),
    index("content_items_org_status_idx").on(table.organizationId, table.status),
    check("content_items_status_check", sql`${table.status} in ('Draft', 'Scheduled', 'Published')`),
  ],
);
