import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import type { AuditRequest } from "../audit/types.js";
import { insertAudit } from "../audit/write.js";
import { invoiceLines, invoicePayments, invoices } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { rupeesToPaise } from "../crm/constants.js";
import { rethrowConstraint } from "./conflicts.js";
import { containsPattern, isStoredInvoiceStatus, type StoredInvoiceStatus } from "./constants.js";
import type { InvoiceListQuery, RecordPaymentBody, UpdateInvoiceBody } from "./invoices.schema.js";
import { calculateInvoice, isSupply, type Supply } from "./money.js";

export type InvoiceLineRecord = {
  id: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  amountPaise: number;
};

export type InvoiceRecord = {
  id: string;
  organizationId: string;
  clientId: string;
  projectId: string | null;
  number: string;
  issueDate: string;
  dueDate: string;
  status: StoredInvoiceStatus;
  supply: Supply;
  rateBps: number;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  amountPaidPaise: number;
  lines: InvoiceLineRecord[];
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentRecord = {
  id: string;
  organizationId: string;
  invoiceId: string;
  paidOn: string;
  amountPaise: number;
  method: string;
  reference: string;
  notes: string | null;
  createdAt: Date;
};

export type NewInvoice = {
  organizationId: string;
  clientId: string;
  projectId: string | null;
  number: string;
  issueDate: string;
  dueDate: string;
  status: "Draft" | "Pending";
  supply: Supply;
  rateBps: number;
  lines: { description: string; quantity: number; unitPriceRupees: number }[];
};

export type InvoiceStore = {
  list(organizationId: string, query: InvoiceListQuery, today: string): Promise<{ items: InvoiceRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<InvoiceRecord | null>;
  findByNumber(organizationId: string, number: string): Promise<{ id: string } | null>;
  payments(organizationId: string, invoiceId: string): Promise<PaymentRecord[]>;
  insert(input: NewInvoice): Promise<InvoiceRecord>;
  update(organizationId: string, id: string, patch: UpdateInvoiceBody): Promise<InvoiceRecord | null>;
  recordPayment(organizationId: string, invoiceId: string, input: RecordPaymentBody, audit?: AuditRequest | null): Promise<{ invoice: InvoiceRecord; payment: PaymentRecord } | null>;
};

function asLine(row: typeof invoiceLines.$inferSelect): InvoiceLineRecord {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitPricePaise: row.unitPricePaise,
    amountPaise: row.amountPaise,
  };
}

function asInvoice(row: typeof invoices.$inferSelect, lines: InvoiceLineRecord[]): InvoiceRecord {
  if (!isStoredInvoiceStatus(row.status)) throw new Error("Stored invoice status is invalid");
  if (!isSupply(row.supply)) throw new Error("Stored invoice supply is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    projectId: row.projectId,
    number: row.number,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    status: row.status,
    supply: row.supply,
    rateBps: row.rateBps,
    subtotalPaise: row.subtotalPaise,
    cgstPaise: row.cgstPaise,
    sgstPaise: row.sgstPaise,
    igstPaise: row.igstPaise,
    totalPaise: row.totalPaise,
    amountPaidPaise: row.amountPaidPaise,
    lines,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function asPayment(row: typeof invoicePayments.$inferSelect): PaymentRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    invoiceId: row.invoiceId,
    paidOn: row.paidOn,
    amountPaise: row.amountPaise,
    method: row.method,
    reference: row.reference,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function invoiceWhere(organizationId: string, query: InvoiceListQuery, today: string): SQL | undefined {
  const filters: SQL[] = [eq(invoices.organizationId, organizationId)];
  if (query.status === "Overdue") {
    filters.push(eq(invoices.status, "Pending"), sql`${invoices.dueDate} < ${today}`);
  } else if (query.status === "Pending") {
    filters.push(eq(invoices.status, "Pending"), sql`${invoices.dueDate} >= ${today}`);
  } else if (query.status) {
    filters.push(eq(invoices.status, query.status));
  }
  if (query.clientId) filters.push(eq(invoices.clientId, query.clientId));
  if (query.issueFrom) filters.push(gte(invoices.issueDate, query.issueFrom));
  if (query.issueTo) filters.push(lte(invoices.issueDate, query.issueTo));
  if (query.dueFrom) filters.push(gte(invoices.dueDate, query.dueFrom));
  if (query.dueTo) filters.push(lte(invoices.dueDate, query.dueTo));
  if (query.search) filters.push(sql`${invoices.number} ilike ${containsPattern(query.search)} escape '\\'`);
  return and(...filters);
}

function invoiceOrder(query: InvoiceListQuery) {
  const column = {
    number: invoices.number,
    issueDate: invoices.issueDate,
    dueDate: invoices.dueDate,
    status: invoices.status,
    total: invoices.totalPaise,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(invoices.id) : asc(invoices.id);
  return [primary, tie];
}

type InvoiceWriter = Pick<Database["db"], "select" | "insert" | "update" | "delete">;

async function linesFor(db: InvoiceWriter, invoiceId: string): Promise<InvoiceLineRecord[]> {
  const rows = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(asc(invoiceLines.position));
  return rows.map(asLine);
}

async function replaceLines(db: InvoiceWriter, invoiceId: string, lines: CalculatedLineInput[]): Promise<void> {
  await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
  if (lines.length === 0) return;
  await db.insert(invoiceLines).values(lines.map((line, position) => ({
    invoiceId,
    position,
    description: line.description,
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    amountPaise: line.amountPaise,
  })));
}

type CalculatedLineInput = {
  description: string;
  quantity: number;
  unitPricePaise: number;
  amountPaise: number;
};

export function createDrizzleInvoiceStore(database: Database): InvoiceStore {
  const { db } = database;
  return {
    async list(organizationId, query, today) {
      const where = invoiceWhere(organizationId, query, today);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(invoices).where(where);
      const rows = await db
        .select()
        .from(invoices)
        .where(where)
        .orderBy(...invoiceOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map((row) => asInvoice(row, [])), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(invoices).where(and(eq(invoices.organizationId, organizationId), eq(invoices.id, id))).limit(1);
      if (!row) return null;
      return asInvoice(row, await linesFor(db, id));
    },
    async findByNumber(organizationId, number) {
      const [row] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.organizationId, organizationId), eq(invoices.number, number)))
        .limit(1);
      return row ?? null;
    },
    async payments(organizationId, invoiceId) {
      const rows = await db
        .select()
        .from(invoicePayments)
        .where(and(eq(invoicePayments.organizationId, organizationId), eq(invoicePayments.invoiceId, invoiceId)))
        .orderBy(asc(invoicePayments.paidOn), asc(invoicePayments.id));
      return rows.map(asPayment);
    },
    async insert(input) {
      const totals = calculateInvoice(input);
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx.insert(invoices).values({
            organizationId: input.organizationId,
            clientId: input.clientId,
            projectId: input.projectId,
            number: input.number,
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            status: input.status,
            supply: input.supply,
            rateBps: input.rateBps,
            subtotalPaise: totals.subtotalPaise,
            cgstPaise: totals.cgstPaise,
            sgstPaise: totals.sgstPaise,
            igstPaise: totals.igstPaise,
            totalPaise: totals.totalPaise,
            amountPaidPaise: 0,
          }).returning();
          if (!row) throw new Error("Insert did not return a row");
          await replaceLines(tx, row.id, totals.lines);
          return asInvoice(row, await linesFor(tx, row.id));
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch) {
      try {
        return await db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(invoices)
            .where(and(eq(invoices.organizationId, organizationId), eq(invoices.id, id), eq(invoices.status, "Draft")))
            .for("update")
            .limit(1);
          if (!current) return null;
          const existingLines = await linesFor(tx, id);
          const pricingChanged = patch.lines !== undefined || patch.rateBps !== undefined || patch.supply !== undefined;
          const supply = patch.supply ?? (isSupply(current.supply) ? current.supply : "cgst_sgst");
          const rateBps = patch.rateBps ?? current.rateBps;
          const lines = patch.lines
            ? patch.lines.map((line) => ({ description: line.description, quantity: line.quantity, unitPriceRupees: line.unitPrice }))
            : existingLines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPriceRupees: Math.trunc(line.unitPricePaise / 100),
            }));
          const totals = pricingChanged ? calculateInvoice({ supply, rateBps, lines }) : null;
          const [row] = await tx.update(invoices).set({
            ...(patch.number !== undefined ? { number: patch.number } : {}),
            ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
            ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
            ...(patch.issueDate !== undefined ? { issueDate: patch.issueDate } : {}),
            ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.supply !== undefined ? { supply: patch.supply } : {}),
            ...(patch.rateBps !== undefined ? { rateBps: patch.rateBps } : {}),
            ...(totals ? {
              subtotalPaise: totals.subtotalPaise,
              cgstPaise: totals.cgstPaise,
              sgstPaise: totals.sgstPaise,
              igstPaise: totals.igstPaise,
              totalPaise: totals.totalPaise,
            } : {}),
            updatedAt: new Date(),
          }).where(and(eq(invoices.organizationId, organizationId), eq(invoices.id, id), eq(invoices.status, "Draft"))).returning();
          if (!row) return null;
          if (totals) await replaceLines(tx, id, totals.lines);
          return asInvoice(row, await linesFor(tx, id));
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async recordPayment(organizationId, invoiceId, input, audit) {
      try {
        return await db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(invoices)
            .where(and(eq(invoices.organizationId, organizationId), eq(invoices.id, invoiceId)))
            .for("update")
            .limit(1);
          if (!current || !isStoredInvoiceStatus(current.status)) return null;
          if (current.status === "Draft") throw new AppError(409, "CONFLICT", "Draft invoices cannot accept payments");
          const balance = current.totalPaise - current.amountPaidPaise;
          if (balance <= 0 || current.status === "Paid") throw new AppError(409, "CONFLICT", "This invoice is already paid");
          const amountPaise = rupeesToPaise(input.amount);
          if (amountPaise > balance) {
            throw new AppError(409, "CONFLICT", "Payment exceeds the outstanding balance", { amount: "Exceeds the outstanding balance" });
          }
          const [existing] = await tx
            .select({ id: invoicePayments.id })
            .from(invoicePayments)
            .where(and(eq(invoicePayments.invoiceId, invoiceId), eq(invoicePayments.reference, input.reference)))
            .limit(1);
          if (existing) throw new AppError(409, "CONFLICT", "This reference is already in use", { reference: "Already in use" });
          const [payment] = await tx.insert(invoicePayments).values({
            organizationId,
            invoiceId,
            paidOn: input.paidOn,
            amountPaise,
            method: input.method,
            reference: input.reference,
            notes: input.notes ?? null,
          }).returning();
          if (!payment) throw new Error("Insert did not return a row");
          const amountPaidPaise = current.amountPaidPaise + amountPaise;
          const [row] = await tx.update(invoices).set({
            amountPaidPaise,
            status: amountPaidPaise === current.totalPaise ? "Paid" : "Pending",
            updatedAt: new Date(),
          }).where(eq(invoices.id, invoiceId)).returning();
          if (!row) throw new Error("Update did not return a row");
          if (audit) {
            await insertAudit(tx, {
              organizationId,
              actorUserId: audit.draft.actorUserId,
              action: audit.draft.action,
              resourceType: "invoice",
              resourceId: invoiceId,
              metadata: { amount: input.amount, paidOn: input.paidOn, reference: input.reference },
            });
          }
          return { invoice: asInvoice(row, await linesFor(tx, invoiceId)), payment: asPayment(payment) };
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
