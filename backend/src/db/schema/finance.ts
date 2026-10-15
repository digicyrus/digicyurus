import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { clients } from "./crm.js";
import { projects } from "./delivery.js";
import { organizations } from "./identity.js";

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    projectId: uuid("project_id").references(() => projects.id),
    number: text("number").notNull(),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    supply: text("supply").notNull(),
    rateBps: integer("rate_bps").notNull(),
    subtotalPaise: bigint("subtotal_paise", { mode: "number" }).notNull(),
    cgstPaise: bigint("cgst_paise", { mode: "number" }).notNull(),
    sgstPaise: bigint("sgst_paise", { mode: "number" }).notNull(),
    igstPaise: bigint("igst_paise", { mode: "number" }).notNull(),
    totalPaise: bigint("total_paise", { mode: "number" }).notNull(),
    amountPaidPaise: bigint("amount_paid_paise", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invoices_org_number_unique").on(table.organizationId, table.number),
    index("invoices_org_status_idx").on(table.organizationId, table.status),
    index("invoices_org_client_idx").on(table.organizationId, table.clientId),
    index("invoices_org_issue_idx").on(table.organizationId, table.issueDate),
    index("invoices_org_due_idx").on(table.organizationId, table.dueDate),
    check("invoices_status_check", sql`${table.status} in ('Draft', 'Pending', 'Paid')`),
    check("invoices_supply_check", sql`${table.supply} in ('cgst_sgst', 'igst')`),
    check("invoices_rate_check", sql`${table.rateBps} between 0 and 10000`),
    check("invoices_dates_check", sql`${table.dueDate} >= ${table.issueDate}`),
    check("invoices_subtotal_check", sql`${table.subtotalPaise} >= 0`),
    check("invoices_tax_nonnegative_check", sql`${table.cgstPaise} >= 0 and ${table.sgstPaise} >= 0 and ${table.igstPaise} >= 0`),
    check(
      "invoices_supply_split_check",
      sql`(${table.supply} = 'igst' and ${table.cgstPaise} = 0 and ${table.sgstPaise} = 0) or (${table.supply} = 'cgst_sgst' and ${table.igstPaise} = 0)`,
    ),
    check("invoices_total_check", sql`${table.totalPaise} = ${table.subtotalPaise} + ${table.cgstPaise} + ${table.sgstPaise} + ${table.igstPaise}`),
    check("invoices_paid_check", sql`${table.amountPaidPaise} >= 0 and ${table.amountPaidPaise} <= ${table.totalPaise}`),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPricePaise: bigint("unit_price_paise", { mode: "number" }).notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  },
  (table) => [
    index("invoice_lines_invoice_idx").on(table.invoiceId, table.position),
    check("invoice_lines_quantity_check", sql`${table.quantity} > 0`),
    check("invoice_lines_price_check", sql`${table.unitPricePaise} >= 0`),
    check("invoice_lines_amount_check", sql`${table.amountPaise} = ${table.quantity} * ${table.unitPricePaise}`),
  ],
);

export const invoicePayments = pgTable(
  "invoice_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    method: text("method").notNull(),
    reference: text("reference").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invoice_payments_invoice_reference_unique").on(table.invoiceId, table.reference),
    index("invoice_payments_org_idx").on(table.organizationId, table.paidOn),
    check("invoice_payments_amount_check", sql`${table.amountPaise} > 0`),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    category: text("category").notNull(),
    vendor: text("vendor"),
    description: text("description").notNull().default(""),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    spentOn: date("spent_on", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("expenses_org_date_idx").on(table.organizationId, table.spentOn),
    index("expenses_org_category_idx").on(table.organizationId, table.category),
    check("expenses_amount_check", sql`${table.amountPaise} >= 0`),
  ],
);
