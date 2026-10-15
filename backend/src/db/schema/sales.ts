import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { clients, leads } from "./crm.js";
import { employees, organizations } from "./identity.js";

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    clientId: uuid("client_id").references(() => clients.id),
    leadId: uuid("lead_id").references(() => leads.id),
    ownerEmployeeId: uuid("owner_employee_id").references(() => employees.id),
    valuePaise: bigint("value_paise", { mode: "number" }).notNull(),
    expectedClose: date("expected_close", { mode: "string" }).notNull(),
    source: text("source").notNull(),
    priority: text("priority").notNull(),
    notes: text("notes").notNull().default(""),
    stage: text("stage").notNull(),
    lostReason: text("lost_reason"),
    closedOn: date("closed_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("opportunities_org_reference_unique").on(table.organizationId, table.reference),
    index("opportunities_org_stage_idx").on(table.organizationId, table.stage),
    index("opportunities_org_owner_idx").on(table.organizationId, table.ownerEmployeeId),
    index("opportunities_org_client_idx").on(table.organizationId, table.clientId),
    index("opportunities_org_lead_idx").on(table.organizationId, table.leadId),
    index("opportunities_org_expected_idx").on(table.organizationId, table.expectedClose),
    index("opportunities_org_closed_idx").on(table.organizationId, table.closedOn),
    check(
      "opportunities_stage_check",
      sql`${table.stage} in ('Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost')`,
    ),
    check("opportunities_priority_check", sql`${table.priority} in ('High', 'Medium', 'Low')`),
    check("opportunities_value_check", sql`${table.valuePaise} >= 0`),
    check(
      "opportunities_close_check",
      sql`(
        (${table.stage} = 'Lost' and ${table.lostReason} is not null and char_length(btrim(${table.lostReason})) > 0 and ${table.closedOn} is not null)
        or (${table.stage} = 'Won' and ${table.lostReason} is null and ${table.closedOn} is not null)
        or (${table.stage} not in ('Won', 'Lost') and ${table.lostReason} is null and ${table.closedOn} is null)
      )`,
    ),
  ],
);

export const opportunityStageEvents = pgTable(
  "opportunity_stage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    fromStage: text("from_stage"),
    toStage: text("to_stage").notNull(),
    lostReason: text("lost_reason"),
    closedOn: date("closed_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("opportunity_stage_events_opportunity_idx").on(table.organizationId, table.opportunityId, table.createdAt),
    check(
      "opportunity_stage_events_stage_check",
      sql`${table.toStage} in ('Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost')
        and (${table.fromStage} is null or ${table.fromStage} in ('Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'))`,
    ),
  ],
);

export const opportunityStageProbabilities = pgTable(
  "opportunity_stage_probabilities",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    stage: text("stage").notNull(),
    probability: integer("probability").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.stage] }),
    check(
      "opportunity_stage_probabilities_stage_check",
      sql`${table.stage} in ('Qualification', 'Discovery', 'Proposal', 'Negotiation')`,
    ),
    check("opportunity_stage_probabilities_probability_check", sql`${table.probability} between 0 and 100`),
  ],
);

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    number: text("number").notNull(),
    title: text("title").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id),
    status: text("status").notNull(),
    validityDate: date("validity_date", { mode: "string" }).notNull(),
    notes: text("notes").notNull().default(""),
    rateBps: integer("rate_bps").notNull(),
    subtotalPaise: bigint("subtotal_paise", { mode: "number" }).notNull(),
    discountPaise: bigint("discount_paise", { mode: "number" }).notNull(),
    taxPaise: bigint("tax_paise", { mode: "number" }).notNull(),
    totalPaise: bigint("total_paise", { mode: "number" }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("proposals_org_number_unique").on(table.organizationId, table.number),
    index("proposals_org_status_idx").on(table.organizationId, table.status),
    index("proposals_org_client_idx").on(table.organizationId, table.clientId),
    index("proposals_org_opportunity_idx").on(table.organizationId, table.opportunityId),
    index("proposals_org_validity_idx").on(table.organizationId, table.validityDate),
    check("proposals_status_check", sql`${table.status} in ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired')`),
    check("proposals_rate_check", sql`${table.rateBps} between 0 and 10000`),
    check(
      "proposals_money_check",
      sql`${table.subtotalPaise} >= 0 and ${table.discountPaise} >= 0 and ${table.discountPaise} <= ${table.subtotalPaise} and ${table.taxPaise} >= 0 and ${table.totalPaise} = ${table.subtotalPaise} - ${table.discountPaise} + ${table.taxPaise}`,
    ),
  ],
);

export const proposalLines = pgTable(
  "proposal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPricePaise: bigint("unit_price_paise", { mode: "number" }).notNull(),
    discountPaise: bigint("discount_paise", { mode: "number" }).notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  },
  (table) => [
    index("proposal_lines_proposal_idx").on(table.proposalId, table.position),
    check("proposal_lines_quantity_check", sql`${table.quantity} > 0`),
    check("proposal_lines_price_check", sql`${table.unitPricePaise} >= 0`),
    check(
      "proposal_lines_discount_check",
      sql`${table.discountPaise} >= 0 and ${table.discountPaise} <= ${table.quantity} * ${table.unitPricePaise}`,
    ),
    check(
      "proposal_lines_amount_check",
      sql`${table.amountPaise} = ${table.quantity} * ${table.unitPricePaise} - ${table.discountPaise}`,
    ),
  ],
);

export const proposalStatusEvents = pgTable(
  "proposal_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("proposal_status_events_proposal_idx").on(table.organizationId, table.proposalId, table.createdAt),
    check("proposal_status_events_status_check", sql`${table.toStatus} in ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired')`),
  ],
);

export const agreements = pgTable(
  "agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    number: text("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id),
    proposalId: uuid("proposal_id").references(() => proposals.id),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    valuePaise: bigint("value_paise", { mode: "number" }).notNull(),
    status: text("status").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("agreements_org_number_unique").on(table.organizationId, table.number),
    index("agreements_org_status_idx").on(table.organizationId, table.status),
    index("agreements_org_client_idx").on(table.organizationId, table.clientId),
    index("agreements_org_opportunity_idx").on(table.organizationId, table.opportunityId),
    index("agreements_org_proposal_idx").on(table.organizationId, table.proposalId),
    index("agreements_org_end_idx").on(table.organizationId, table.endDate),
    check("agreements_status_check", sql`${table.status} in ('Draft', 'Active', 'Completed', 'Terminated', 'Expired')`),
    check("agreements_dates_check", sql`${table.endDate} >= ${table.startDate}`),
    check("agreements_value_check", sql`${table.valuePaise} >= 0`),
  ],
);

export const agreementStatusEvents = pgTable(
  "agreement_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    agreementId: uuid("agreement_id")
      .notNull()
      .references(() => agreements.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("agreement_status_events_agreement_idx").on(table.organizationId, table.agreementId, table.createdAt),
    check(
      "agreement_status_events_status_check",
      sql`${table.toStatus} in ('Draft', 'Active', 'Completed', 'Terminated', 'Expired')`,
    ),
  ],
);
