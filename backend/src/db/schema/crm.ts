import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { employees, organizations } from "./identity.js";

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name").notNull(),
    industry: text("industry").notNull(),
    status: text("status").notNull(),
    rating: integer("rating").notNull(),
    customerSince: date("customer_since", { mode: "string" }).notNull(),
    email: text("email"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("clients_org_code_unique").on(table.organizationId, table.code),
    uniqueIndex("clients_email_lower_idx")
      .on(table.organizationId, sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
    index("clients_org_name_idx").on(table.organizationId, table.name),
    index("clients_org_status_idx").on(table.organizationId, table.status),
    check("clients_status_check", sql`${table.status} in ('Active', 'On Hold', 'Prospect')`),
    check("clients_rating_check", sql`${table.rating} between 1 and 5`),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id").references(() => clients.id),
    code: text("code").notNull(),
    company: text("company").notNull(),
    person: text("person").notNull(),
    stage: text("stage").notNull(),
    valuePaise: bigint("value_paise", { mode: "number" }).notNull(),
    source: text("source").notNull(),
    priority: text("priority").notNull(),
    expectedClose: date("expected_close", { mode: "string" }).notNull(),
    probability: integer("probability").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("leads_org_code_unique").on(table.organizationId, table.code),
    index("leads_org_stage_idx").on(table.organizationId, table.stage),
    check(
      "leads_stage_check",
      sql`${table.stage} in ('New', 'Contacted', 'Qualified', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Won', 'Lost')`,
    ),
    check("leads_priority_check", sql`${table.priority} in ('High', 'Medium', 'Low')`),
    check("leads_probability_check", sql`${table.probability} between 0 and 100`),
    check("leads_value_check", sql`${table.valuePaise} >= 0`),
  ],
);

export const followUps = pgTable(
  "follow_ups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id").references(() => clients.id),
    leadId: uuid("lead_id").references(() => leads.id),
    ownerEmployeeId: uuid("owner_employee_id")
      .notNull()
      .references(() => employees.id),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("follow_ups_org_due_idx").on(table.organizationId, table.dueAt),
    index("follow_ups_client_idx").on(table.clientId),
    index("follow_ups_lead_idx").on(table.leadId),
    check("follow_ups_subject_check", sql`${table.clientId} is not null or ${table.leadId} is not null`),
    check("follow_ups_status_check", sql`${table.status} in ('Due', 'Missed', 'Upcoming', 'Completed')`),
  ],
);
