import { displayedStatus } from "./constants.js";
import type { ExpenseRecord } from "./expenses.store.js";
import type { InvoiceRecord, PaymentRecord } from "./invoices.store.js";
import { rupees } from "./money.js";
import type { FinanceSummary } from "./summary.store.js";

export function presentInvoice(record: InvoiceRecord, today: string) {
  return {
    id: record.id,
    number: record.number,
    clientId: record.clientId,
    projectId: record.projectId,
    issueDate: record.issueDate,
    dueDate: record.dueDate,
    status: displayedStatus(record.status, record.dueDate, today),
    supply: record.supply,
    rateBps: record.rateBps,
    subtotal: rupees(record.subtotalPaise),
    cgst: rupees(record.cgstPaise),
    sgst: rupees(record.sgstPaise),
    igst: rupees(record.igstPaise),
    tax: rupees(record.cgstPaise + record.sgstPaise + record.igstPaise),
    total: rupees(record.totalPaise),
    amountPaid: rupees(record.amountPaidPaise),
    balanceDue: rupees(record.totalPaise - record.amountPaidPaise),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentInvoiceDetail(record: InvoiceRecord, payments: PaymentRecord[], today: string) {
  return {
    ...presentInvoice(record, today),
    lines: record.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: line.quantity,
      unitPrice: rupees(line.unitPricePaise),
      amount: rupees(line.amountPaise),
    })),
    payments: payments.map(presentPayment),
  };
}

export function presentPayment(record: PaymentRecord) {
  return {
    id: record.id,
    invoiceId: record.invoiceId,
    paidOn: record.paidOn,
    amount: rupees(record.amountPaise),
    method: record.method,
    reference: record.reference,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
  };
}

export function presentExpense(record: ExpenseRecord) {
  return {
    id: record.id,
    category: record.category,
    vendor: record.vendor,
    description: record.description,
    amount: rupees(record.amountPaise),
    date: record.spentOn,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentSummary(summary: FinanceSummary) {
  return {
    issued: rupees(summary.issuedPaise),
    collected: rupees(summary.collectedPaise),
    outstanding: rupees(summary.outstandingPaise),
    expenses: rupees(summary.expensePaise),
  };
}
