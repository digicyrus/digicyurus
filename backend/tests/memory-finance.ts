import { randomUUID } from "node:crypto";

import { AppError } from "../src/lib/errors.js";
import { rupeesToPaise } from "../src/modules/crm/constants.js";
import type { ExpenseListQuery, UpdateExpenseBody } from "../src/modules/finance/expenses.schema.js";
import type { ExpenseRecord, ExpenseStore, NewExpense } from "../src/modules/finance/expenses.store.js";
import type { InvoiceListQuery, RecordPaymentBody, UpdateInvoiceBody } from "../src/modules/finance/invoices.schema.js";
import type { InvoiceRecord, InvoiceStore, NewInvoice, PaymentRecord } from "../src/modules/finance/invoices.store.js";
import { displayedStatus } from "../src/modules/finance/constants.js";
import { calculateInvoice, isSupply } from "../src/modules/finance/money.js";
import type { FinanceSummaryStore } from "../src/modules/finance/summary.store.js";

function paginate<T>(items: T[], page: number, pageSize: number) {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
}

function compare(left: string | number, right: string | number, direction: "asc" | "desc"): number {
  const result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  return direction === "desc" ? -result : result;
}

function includes(search: string | undefined, values: Array<string | null>): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return values.filter((value) => value !== null).join("\n").toLowerCase().includes(needle);
}

function lineRecords(lines: { description: string; quantity: number; unitPricePaise: number; amountPaise: number }[]) {
  return lines.map((line) => ({ ...line, id: randomUUID() }));
}

export function createMemoryInvoiceStore(): InvoiceStore & { records: InvoiceRecord[]; paymentRecords: PaymentRecord[] } {
  const records: InvoiceRecord[] = [];
  const paymentRecords: PaymentRecord[] = [];
  return {
    records,
    paymentRecords,
    async list(organizationId, query: InvoiceListQuery, today) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.status ? displayedStatus(record.status, record.dueDate, today) === query.status : true))
        .filter((record) => (query.clientId ? record.clientId === query.clientId : true))
        .filter((record) => (query.issueFrom ? record.issueDate >= query.issueFrom : true))
        .filter((record) => (query.issueTo ? record.issueDate <= query.issueTo : true))
        .filter((record) => (query.dueFrom ? record.dueDate >= query.dueFrom : true))
        .filter((record) => (query.dueTo ? record.dueDate <= query.dueTo : true))
        .filter((record) => includes(query.search, [record.number]))
        .sort((left, right) => {
          const value = {
            number: [left.number, right.number],
            issueDate: [left.issueDate, right.issueDate],
            dueDate: [left.dueDate, right.dueDate],
            status: [left.status, right.status],
            total: [left.totalPaise, right.totalPaise],
          }[query.sort] as [string | number, string | number];
          const primary = compare(value[0], value[1], query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findByNumber(organizationId, number) {
      const record = records.find((item) => item.organizationId === organizationId && item.number === number);
      return record ? { id: record.id } : null;
    },
    async payments(organizationId, invoiceId) {
      return paymentRecords
        .filter((payment) => payment.organizationId === organizationId && payment.invoiceId === invoiceId)
        .sort((left, right) => compare(left.paidOn, right.paidOn, "asc") || compare(left.id, right.id, "asc"));
    },
    async insert(input: NewInvoice) {
      const totals = calculateInvoice(input);
      const now = new Date();
      const record: InvoiceRecord = {
        id: randomUUID(),
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
        lines: lineRecords(totals.lines),
        createdAt: now,
        updatedAt: now,
      };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch: UpdateInvoiceBody) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id && item.status === "Draft");
      if (!record) return null;
      if (patch.number !== undefined) record.number = patch.number;
      if (patch.clientId !== undefined) record.clientId = patch.clientId;
      if (patch.projectId !== undefined) record.projectId = patch.projectId;
      if (patch.issueDate !== undefined) record.issueDate = patch.issueDate;
      if (patch.dueDate !== undefined) record.dueDate = patch.dueDate;
      if (patch.status !== undefined) record.status = patch.status;
      if (patch.supply !== undefined) record.supply = patch.supply;
      if (patch.rateBps !== undefined) record.rateBps = patch.rateBps;
      if (patch.lines !== undefined || patch.rateBps !== undefined || patch.supply !== undefined) {
        const totals = calculateInvoice({
          supply: record.supply,
          rateBps: record.rateBps,
          lines: patch.lines
            ? patch.lines.map((line) => ({ description: line.description, quantity: line.quantity, unitPriceRupees: line.unitPrice }))
            : record.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPriceRupees: Math.trunc(line.unitPricePaise / 100),
            })),
        });
        record.subtotalPaise = totals.subtotalPaise;
        record.cgstPaise = totals.cgstPaise;
        record.sgstPaise = totals.sgstPaise;
        record.igstPaise = totals.igstPaise;
        record.totalPaise = totals.totalPaise;
        record.lines = lineRecords(totals.lines);
      }
      if (!isSupply(record.supply)) throw new Error("Stored invoice supply is invalid");
      record.updatedAt = new Date();
      return record;
    },
    async recordPayment(organizationId, invoiceId, input: RecordPaymentBody, audit) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === invoiceId);
      if (!record) return null;
      if (record.status === "Draft") throw new AppError(409, "CONFLICT", "Draft invoices cannot accept payments");
      const balance = record.totalPaise - record.amountPaidPaise;
      if (balance <= 0 || record.status === "Paid") throw new AppError(409, "CONFLICT", "This invoice is already paid");
      const amountPaise = rupeesToPaise(input.amount);
      if (amountPaise > balance) {
        throw new AppError(409, "CONFLICT", "Payment exceeds the outstanding balance", { amount: "Exceeds the outstanding balance" });
      }
      if (paymentRecords.some((payment) => payment.invoiceId === invoiceId && payment.reference === input.reference)) {
        throw new AppError(409, "CONFLICT", "This reference is already in use", { reference: "Already in use" });
      }
      const payment: PaymentRecord = {
        id: randomUUID(),
        organizationId,
        invoiceId,
        paidOn: input.paidOn,
        amountPaise,
        method: input.method,
        reference: input.reference,
        notes: input.notes ?? null,
        createdAt: new Date(),
      };
      paymentRecords.push(payment);
      const previousPaid = record.amountPaidPaise;
      const previousStatus = record.status;
      record.amountPaidPaise += amountPaise;
      record.status = record.amountPaidPaise === record.totalPaise ? "Paid" : "Pending";
      record.updatedAt = new Date();
      if (audit?.persist) {
        try {
          await audit.persist({
            organizationId,
            actorUserId: audit.draft.actorUserId,
            action: audit.draft.action,
            resourceType: "invoice",
            resourceId: invoiceId,
            metadata: { amount: input.amount, paidOn: input.paidOn, reference: input.reference },
          });
        } catch (error) {
          paymentRecords.pop();
          record.amountPaidPaise = previousPaid;
          record.status = previousStatus;
          throw error;
        }
      }
      return { invoice: record, payment };
    },
  };
}

export function createMemoryExpenseStore(): ExpenseStore & { records: ExpenseRecord[] } {
  const records: ExpenseRecord[] = [];
  return {
    records,
    async list(organizationId, query: ExpenseListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.category ? record.category.toLowerCase() === query.category.toLowerCase() : true))
        .filter((record) => (query.from ? record.spentOn >= query.from : true))
        .filter((record) => (query.to ? record.spentOn <= query.to : true))
        .filter((record) => includes(query.search, [record.category, record.description, record.vendor]))
        .sort((left, right) => {
          const value = {
            category: [left.category, right.category],
            amount: [left.amountPaise, right.amountPaise],
            date: [left.spentOn, right.spentOn],
          }[query.sort] as [string | number, string | number];
          const primary = compare(value[0], value[1], query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async insert(input: NewExpense) {
      const now = new Date();
      const record: ExpenseRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        category: input.category,
        vendor: input.vendor,
        description: input.description,
        amountPaise: rupeesToPaise(input.amountRupees),
        spentOn: input.spentOn,
        createdAt: now,
        updatedAt: now,
      };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch: UpdateExpenseBody) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.category !== undefined) record.category = patch.category;
      if (patch.vendor !== undefined) record.vendor = patch.vendor;
      if (patch.description !== undefined) record.description = patch.description;
      if (patch.amount !== undefined) record.amountPaise = rupeesToPaise(patch.amount);
      if (patch.date !== undefined) record.spentOn = patch.date;
      record.updatedAt = new Date();
      return record;
    },
  };
}

export function createMemoryFinanceSummary(invoices: InvoiceRecord[], expenses: ExpenseRecord[]): FinanceSummaryStore {
  return {
    async summary(organizationId) {
      const issued = invoices.filter((invoice) => invoice.organizationId === organizationId && invoice.status !== "Draft");
      const issuedPaise = issued.reduce((sum, invoice) => sum + invoice.totalPaise, 0);
      const collectedPaise = issued.reduce((sum, invoice) => sum + invoice.amountPaidPaise, 0);
      const expensePaise = expenses.filter((expense) => expense.organizationId === organizationId).reduce((sum, expense) => sum + expense.amountPaise, 0);
      return {
        issuedPaise,
        collectedPaise,
        outstandingPaise: issuedPaise - collectedPaise,
        expensePaise,
      };
    },
  };
}
