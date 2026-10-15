import { api } from "./api";
import { toQuery, type Page } from "./crm";

export const INVOICE_STATUSES = ["Draft", "Pending", "Paid", "Overdue"] as const;
export const EDITABLE_INVOICE_STATUSES = ["Draft", "Pending"] as const;
export const SUPPLIES = ["cgst_sgst", "igst"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type EditableInvoiceStatus = (typeof EDITABLE_INVOICE_STATUSES)[number];
export type Supply = (typeof SUPPLIES)[number];

export type Invoice = {
    id: string;
    number: string;
    clientId: string;
    projectId: string | null;
    issueDate: string;
    dueDate: string;
    status: InvoiceStatus;
    supply: Supply;
    rateBps: number;
    subtotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    tax: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
    createdAt: string;
    updatedAt: string;
};

export type InvoiceLine = {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
};

export type Payment = {
    id: string;
    invoiceId: string;
    paidOn: string;
    amount: number;
    method: string;
    reference: string;
    notes: string | null;
    createdAt: string;
};

export type InvoiceDetail = Invoice & {
    lines: InvoiceLine[];
    payments: Payment[];
};

export type Expense = {
    id: string;
    category: string;
    vendor: string | null;
    description: string;
    amount: number;
    date: string;
    createdAt: string;
    updatedAt: string;
};

export type FinanceSummary = {
    issued: number;
    collected: number;
    outstanding: number;
    expenses: number;
};

export type InvoiceLineInput = {
    description: string;
    quantity: number;
    unitPrice: number;
};

export type InvoiceDraft = {
    number: string;
    clientId: string;
    projectId?: string | null;
    issueDate: string;
    dueDate: string;
    status: EditableInvoiceStatus;
    supply: Supply;
    rateBps: number;
    lines: InvoiceLineInput[];
};

export type ExpenseDraft = {
    category: string;
    vendor?: string | null;
    description: string;
    amount: number;
    date: string;
};

export type PaymentDraft = {
    paidOn: string;
    amount: number;
    method: string;
    reference: string;
    notes?: string | null;
};

export type LineForm = {
    description: string;
    quantity: string;
    unitPrice: string;
};

export type PaymentForm = {
    paidOn: string;
    amount: string;
    method: string;
    reference: string;
    notes: string;
};

export type Checked<T> = { ok: true; body: T } | { ok: false; message: string; fields: Record<string, string> };

export function wholeRupees(value: string): number | null {
    const text = value.trim();
    if (!/^\d+$/.test(text)) return null;
    const amount = Number(text);
    return Number.isSafeInteger(amount) ? amount : null;
}

export function basisPoints(percent: string): number | null {
    const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(percent.trim());
    if (!match?.[1]) return null;
    const rate = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
    if (!Number.isSafeInteger(rate) || rate > 10_000) return null;
    return rate;
}

export function percentFromBps(rateBps: number): string {
    const whole = Math.trunc(rateBps / 100);
    const fraction = Math.abs(rateBps % 100);
    if (fraction === 0) return String(whole);
    return `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}

export function canRecordPayment(status: string): boolean {
    return status === "Pending" || status === "Overdue";
}

export function invoiceBody(input: {
    number: string;
    clientId: string;
    projectId: string;
    issueDate: string;
    dueDate: string;
    status: EditableInvoiceStatus;
    supply: Supply;
    ratePercent: string;
    lines: LineForm[];
}): Checked<InvoiceDraft> {
    const fields: Record<string, string> = {};
    const rateBps = basisPoints(input.ratePercent);
    if (rateBps === null) fields.rateBps = "Enter a tax rate up to 100 percent";
    if (!input.clientId.trim()) fields.clientId = "Choose a client";
    if (input.lines.length < 1) fields.lines = "Add at least one line";
    const lines = input.lines.map((line, index) => {
        const quantity = wholeRupees(line.quantity);
        const unitPrice = wholeRupees(line.unitPrice);
        if (!line.description.trim()) fields[`lines.${index}.description`] = "Enter a description";
        if (quantity === null || quantity < 1) fields[`lines.${index}.quantity`] = "Enter a whole quantity";
        if (unitPrice === null) fields[`lines.${index}.unitPrice`] = "Enter a whole number of rupees";
        return {
            description: line.description.trim(),
            quantity: quantity ?? 0,
            unitPrice: unitPrice ?? 0,
        };
    });
    if (Object.keys(fields).length > 0 || rateBps === null) {
        return { ok: false, message: "Check the invoice", fields };
    }
    return {
        ok: true,
        body: {
            number: input.number.trim(),
            clientId: input.clientId,
            projectId: input.projectId || null,
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            status: input.status,
            supply: input.supply,
            rateBps,
            lines,
        },
    };
}

export function paymentBody(invoice: { status: string; balanceDue: number }, input: PaymentForm): Checked<PaymentDraft> {
    if (invoice.status === "Draft") return { ok: false, message: "Draft invoices cannot accept payments", fields: {} };
    if (invoice.status === "Paid" || invoice.balanceDue <= 0) return { ok: false, message: "This invoice is already paid", fields: {} };
    const fields: Record<string, string> = {};
    const amount = wholeRupees(input.amount);
    if (amount === null || amount < 1) fields.amount = "Enter a whole number of rupees";
    else if (amount > invoice.balanceDue) fields.amount = "Exceeds the outstanding balance";
    if (!input.method.trim()) fields.method = "Enter a method";
    if (!input.reference.trim()) fields.reference = "Enter a reference";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) fields.paidOn = "Enter a valid date";
    if (Object.keys(fields).length > 0) return { ok: false, message: "Check the payment", fields };
    return {
        ok: true,
        body: {
            paidOn: input.paidOn,
            amount: amount ?? 0,
            method: input.method.trim(),
            reference: input.reference.trim(),
            notes: input.notes.trim() || null,
        },
    };
}

export function expenseBody(input: { category: string; vendor: string; description: string; amount: string; date: string }): Checked<ExpenseDraft> {
    const fields: Record<string, string> = {};
    const amount = wholeRupees(input.amount);
    if (!input.category.trim()) fields.category = "Enter a category";
    if (amount === null) fields.amount = "Enter a whole number of rupees";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) fields.date = "Enter a valid date";
    if (Object.keys(fields).length > 0) return { ok: false, message: "Check the expense", fields };
    return {
        ok: true,
        body: {
            category: input.category.trim(),
            vendor: input.vendor.trim() || null,
            description: input.description.trim(),
            amount: amount ?? 0,
            date: input.date,
        },
    };
}

type RequestClient = {
    request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
};

export function createFinanceApi(client: RequestClient) {
    return {
        summary() {
            return client.request<FinanceSummary>("/api/finance/summary");
        },
        invoices: {
            list(query: { page?: number; pageSize?: number; search?: string; status?: InvoiceStatus; clientId?: string; issueFrom?: string; issueTo?: string; dueFrom?: string; dueTo?: string } = {}) {
                return client.request<Page<Invoice>>(`/api/invoices${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<InvoiceDetail>(`/api/invoices/${encodeURIComponent(id)}`);
            },
            create(body: InvoiceDraft) {
                return client.request<InvoiceDetail>("/api/invoices", { method: "POST", body });
            },
            update(id: string, body: Partial<InvoiceDraft>) {
                return client.request<InvoiceDetail>(`/api/invoices/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
            recordPayment(id: string, body: PaymentDraft) {
                return client.request<{ invoice: InvoiceDetail; payment: Payment }>(`/api/invoices/${encodeURIComponent(id)}/payments`, { method: "POST", body });
            },
        },
        expenses: {
            list(query: { page?: number; pageSize?: number; search?: string; category?: string; from?: string; to?: string } = {}) {
                return client.request<Page<Expense>>(`/api/expenses${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<Expense>(`/api/expenses/${encodeURIComponent(id)}`);
            },
            create(body: ExpenseDraft) {
                return client.request<Expense>("/api/expenses", { method: "POST", body });
            },
            update(id: string, body: Partial<ExpenseDraft>) {
                return client.request<Expense>(`/api/expenses/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
    };
}

export const finance = createFinanceApi(api);
