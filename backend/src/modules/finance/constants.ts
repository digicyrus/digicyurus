export const INVOICE_STATUSES = ["Draft", "Pending", "Paid", "Overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const STORED_INVOICE_STATUSES = ["Draft", "Pending", "Paid"] as const;
export type StoredInvoiceStatus = (typeof STORED_INVOICE_STATUSES)[number];

export const INVOICE_SORTS = ["number", "issueDate", "dueDate", "status", "total"] as const;
export const EXPENSE_SORTS = ["category", "amount", "date"] as const;

export function containsPattern(value: string): string {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

export function isStoredInvoiceStatus(value: string): value is StoredInvoiceStatus {
  return (STORED_INVOICE_STATUSES as readonly string[]).includes(value);
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function displayedStatus(status: StoredInvoiceStatus, dueDate: string, today: string): InvoiceStatus {
  if (status === "Pending" && dueDate < today) return "Overdue";
  return status;
}
