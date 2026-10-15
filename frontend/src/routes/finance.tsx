import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { RelationPicker, useResolvedLabels } from "@/components/relation-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { apiFailure, formatDay } from "@/lib/crm";
import {
    canRecordPayment,
    EDITABLE_INVOICE_STATUSES,
    expenseBody,
    finance,
    INVOICE_STATUSES,
    invoiceBody,
    paymentBody,
    percentFromBps,
    type EditableInvoiceStatus,
    type Expense,
    type FinanceSummary,
    type Invoice,
    type InvoiceDetail,
    type InvoiceStatus,
    type LineForm,
    type Supply,
} from "@/lib/finance";
import { canBrowseClients, canBrowseProjects, linkedLabel, loadClientOptions, loadProjectOptions, lookupClientName, lookupProjectName } from "@/lib/relations";
import { ReferralPanel } from "@/components/referral-panel";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/finance")({
    head: () => ({
        meta: [
            { title: "Finance & Invoicing — DigiCyrus ERP" },
            { name: "description", content: "Issued invoices, collections, outstanding balances, and expenses." },
            { property: "og:title", content: "Finance & Invoicing — DigiCyrus ERP" },
            { property: "og:description", content: "Invoices, payments, and expenses for the agency." },
        ],
    }),
    component: FinancePage,
});

const PAGE_SIZE = 20;

function todayIso(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function FinancePage() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canViewSummary = permissions.includes("finance:view");
    const canViewInvoices = permissions.includes("invoices:view");
    const canCreateInvoice = permissions.includes("invoices:create");
    const canUpdateInvoice = permissions.includes("invoices:update");
    const canPay = permissions.includes("invoices:record_payment");
    const canViewExpenses = permissions.includes("expenses:view");
    const canCreateExpense = permissions.includes("expenses:create");
    const canUpdateExpense = permissions.includes("expenses:update");
    const canViewClients = canBrowseClients(permissions);
    const canViewProjects = canBrowseProjects(permissions);
    const [summary, setSummary] = useState<FinanceSummary | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [invoiceTotal, setInvoiceTotal] = useState(0);
    const [invoicePage, setInvoicePage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<InvoiceStatus | "">("");
    const [clientId, setClientId] = useState("");
    const [issueFrom, setIssueFrom] = useState("");
    const [issueTo, setIssueTo] = useState("");
    const [dueFrom, setDueFrom] = useState("");
    const [dueTo, setDueTo] = useState("");
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expenseTotal, setExpenseTotal] = useState(0);
    const [expensePage, setExpensePage] = useState(1);
    const [expenseSearch, setExpenseSearch] = useState("");
    const [expenseQuery, setExpenseQuery] = useState("");
    const [category, setCategory] = useState("");
    const [spentFrom, setSpentFrom] = useState("");
    const [spentTo, setSpentTo] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editor, setEditor] = useState<InvoiceDetail | "new" | null>(null);
    const [expenseEditor, setExpenseEditor] = useState<Expense | "new" | null>(null);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setInvoicePage(1);
            setQuery(search.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setExpensePage(1);
            setExpenseQuery(expenseSearch.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [expenseSearch]);

    useEffect(() => {
        if (!canViewSummary) {
            setSummary(null);
            return;
        }
        let active = true;
        void finance.summary().then((result) => {
            if (active) setSummary(result);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setSummary(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [canViewSummary, revision, auth.refresh]);

    useEffect(() => {
        if (!canViewInvoices) {
            setLoading(false);
            setInvoices([]);
            return;
        }
        let active = true;
        setLoading(true);
        void finance.invoices.list({
            page: invoicePage,
            pageSize: PAGE_SIZE,
            search: query || undefined,
            status: status || undefined,
            clientId: clientId || undefined,
            issueFrom: issueFrom || undefined,
            issueTo: issueTo || undefined,
            dueFrom: dueFrom || undefined,
            dueTo: dueTo || undefined,
        }).then((result) => {
            if (!active) return;
            setInvoices(result.items);
            setInvoiceTotal(result.total);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setInvoices([]);
            setInvoiceTotal(0);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [canViewInvoices, invoicePage, query, status, clientId, issueFrom, issueTo, dueFrom, dueTo, revision, auth.refresh]);

    useEffect(() => {
        if (!canViewExpenses) {
            setExpenses([]);
            setExpenseTotal(0);
            return;
        }
        let active = true;
        void finance.expenses.list({
            page: expensePage,
            pageSize: PAGE_SIZE,
            search: expenseQuery || undefined,
            category: category.trim() || undefined,
            from: spentFrom || undefined,
            to: spentTo || undefined,
        }).then((result) => {
            if (!active) return;
            setExpenses(result.items);
            setExpenseTotal(result.total);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setExpenses([]);
            setExpenseTotal(0);
        });
        return () => {
            active = false;
        };
    }, [canViewExpenses, expensePage, expenseQuery, category, spentFrom, spentTo, revision, auth.refresh]);

    const clientLabels = useResolvedLabels(invoices.map((invoice) => invoice.clientId), canViewClients, lookupClientName);
    const invoicePages = Math.max(1, Math.ceil(invoiceTotal / PAGE_SIZE));
    const expensePages = Math.max(1, Math.ceil(expenseTotal / PAGE_SIZE));
    const cards = summary
        ? [
            { label: "Issued", value: inr(summary.issued) },
            { label: "Collected", value: inr(summary.collected) },
            { label: "Outstanding", value: inr(summary.outstanding) },
            { label: "Expenses", value: inr(summary.expenses) },
        ]
        : [];

    return (
        <AppShell>
            <PageHeader
                title="Finance"
                subtitle={summary ? `Outstanding ${inr(summary.outstanding)}` : canViewSummary ? "Loading summary…" : "Finance summary is not available for this role"}
                actions={canCreateInvoice ? (
                    <Button size="sm" onClick={() => setEditor("new")}>
                        <Plus className="h-4 w-4" /> New invoice
                    </Button>
                ) : null}
            />
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            {cards.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {cards.map((card) => (
                        <div key={card.label} className="surface lift p-4">
                            <p className="text-xs text-muted-foreground">{card.label}</p>
                            <p className="mt-2 text-xl font-semibold">{card.value}</p>
                        </div>
                    ))}
                </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Monthly profit, cash flow, and GST payable are not part of the finance summary.</p>

            <Panel title="Invoices" description={canViewInvoices ? `${invoiceTotal} invoices` : "Invoice access is not available for this role"}>
                {canViewInvoices ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                        <Input className="max-w-xs" placeholder="Search invoices…" value={search} onChange={(event) => setSearch(event.target.value)} />
                        <select aria-label="Invoice status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as InvoiceStatus | ""); setInvoicePage(1); }}>
                            <option value="">All statuses</option>
                            {INVOICE_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                        <div className="min-w-56">
                            <RelationPicker label="Client" value={clientId} emptyLabel="All clients" enabled={canViewClients} selectedLabel={clientLabels[clientId]} load={loadClientOptions} onChange={(id) => { setClientId(id); setInvoicePage(1); }} unavailable="Client filter needs client access." />
                        </div>
                        <Input aria-label="Issued from" type="date" className="w-40" value={issueFrom} onChange={(event) => { setIssueFrom(event.target.value); setInvoicePage(1); }} />
                        <Input aria-label="Issued to" type="date" className="w-40" value={issueTo} onChange={(event) => { setIssueTo(event.target.value); setInvoicePage(1); }} />
                        <Input aria-label="Due from" type="date" className="w-40" value={dueFrom} onChange={(event) => { setDueFrom(event.target.value); setInvoicePage(1); }} />
                        <Input aria-label="Due to" type="date" className="w-40" value={dueTo} onChange={(event) => { setDueTo(event.target.value); setInvoicePage(1); }} />
                    </div>
                ) : null}
                {loading && canViewInvoices ? <p className="text-sm text-muted-foreground">Loading invoices…</p> : null}
                {canViewInvoices && !loading && invoices.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No invoices</p> : null}
                {invoices.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Subtotal</TableHead>
                                    <TableHead>Tax</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Balance</TableHead>
                                    <TableHead>Due</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((invoice) => (
                                    <TableRow key={invoice.id} className="cursor-pointer" onClick={() => setSelectedId(invoice.id)}>
                                        <TableCell className="font-mono text-xs">{invoice.number}</TableCell>
                                        <TableCell className="font-medium">{linkedLabel(invoice.clientId, clientLabels, "Client name unavailable", "Client name unavailable")}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(invoice.subtotal)}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(invoice.tax)}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(invoice.total)}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(invoice.balanceDue)}</TableCell>
                                        <TableCell className="text-muted-foreground">{formatDay(invoice.dueDate)}</TableCell>
                                        <TableCell><StatusPill status={invoice.status} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : null}
                {canViewInvoices ? (
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Page {invoicePage} of {invoicePages}</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={invoicePage <= 1} onClick={() => setInvoicePage((current) => current - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={invoicePage >= invoicePages} onClick={() => setInvoicePage((current) => current + 1)}>Next</Button>
                        </div>
                    </div>
                ) : null}
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                    title="Expenses"
                    description={canViewExpenses ? `${expenseTotal} expenses` : "Expense access is not available for this role"}
                    actions={canCreateExpense ? <Button size="sm" variant="outline" onClick={() => setExpenseEditor("new")}><Plus className="h-4 w-4" /> New expense</Button> : null}
                >
                    {canViewExpenses ? (
                        <div className="mb-3 flex flex-wrap gap-2">
                            <Input className="max-w-xs" placeholder="Search expenses…" value={expenseSearch} onChange={(event) => setExpenseSearch(event.target.value)} />
                            <Input aria-label="Category" className="max-w-[10rem]" placeholder="Category" value={category} onChange={(event) => { setCategory(event.target.value); setExpensePage(1); }} />
                            <Input aria-label="Spent from" type="date" className="w-40" value={spentFrom} onChange={(event) => { setSpentFrom(event.target.value); setExpensePage(1); }} />
                            <Input aria-label="Spent to" type="date" className="w-40" value={spentTo} onChange={(event) => { setSpentTo(event.target.value); setExpensePage(1); }} />
                        </div>
                    ) : null}
                    {canViewExpenses && expenses.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No expenses</p> : null}
                    <div className="divide-y">
                        {expenses.map((expense) => (
                            <button key={expense.id} type="button" className="flex w-full items-center justify-between gap-3 py-3 text-left" disabled={!canUpdateExpense} onClick={() => setExpenseEditor(expense)}>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{expense.category}</p>
                                    <p className="truncate text-xs text-muted-foreground">{expense.vendor ?? "No vendor"} · {formatDay(expense.date)}</p>
                                </div>
                                <span className="font-mono text-sm">{inr(expense.amount)}</span>
                            </button>
                        ))}
                    </div>
                    {canViewExpenses ? (
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Page {expensePage} of {expensePages}</span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={expensePage <= 1} onClick={() => setExpensePage((current) => current - 1)}>Previous</Button>
                                <Button variant="outline" size="sm" disabled={expensePage >= expensePages} onClick={() => setExpensePage((current) => current + 1)}>Next</Button>
                            </div>
                        </div>
                    ) : null}
                </Panel>
                <ReferralPanel />
            </div>

            <InvoiceDetailDialog
                invoiceId={selectedId}
                labels={clientLabels}
                canEdit={canUpdateInvoice}
                canPay={canPay}
                revision={revision}
                onOpenChange={(open) => { if (!open) setSelectedId(null); }}
                onEdit={(invoice) => { setSelectedId(null); setEditor(invoice); }}
                onPaid={() => setRevision((current) => current + 1)}
            />
            <InvoiceDialog
                open={editor !== null}
                invoice={editor === "new" ? null : editor}
                canClients={canViewClients}
                canProjects={canViewProjects}
                onOpenChange={(open) => { if (!open) setEditor(null); }}
                onSaved={() => { setEditor(null); setRevision((current) => current + 1); }}
            />
            <ExpenseDialog
                open={expenseEditor !== null}
                expense={expenseEditor === "new" ? null : expenseEditor}
                onOpenChange={(open) => { if (!open) setExpenseEditor(null); }}
                onSaved={() => { setExpenseEditor(null); setRevision((current) => current + 1); }}
            />
        </AppShell>
    );
}

function InvoiceDetailDialog({ invoiceId, labels, canEdit, canPay, revision, onOpenChange, onEdit, onPaid }: {
    invoiceId: string | null;
    labels: Record<string, string | null>;
    canEdit: boolean;
    canPay: boolean;
    revision: number;
    onOpenChange: (open: boolean) => void;
    onEdit: (invoice: InvoiceDetail) => void;
    onPaid: () => void;
}) {
    const auth = useAuth();
    const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [fields, setFields] = useState<Record<string, string>>({});
    const [paidOn, setPaidOn] = useState(todayIso());
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState("");
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!invoiceId) {
            setInvoice(null);
            return;
        }
        let active = true;
        setMessage(null);
        setFields({});
        void finance.invoices.get(invoiceId).then((result) => {
            if (active) setInvoice(result);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setInvoice(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [invoiceId, revision, auth.refresh]);

    async function pay(event: FormEvent) {
        event.preventDefault();
        if (!invoice) return;
        const checked = paymentBody(invoice, { paidOn, amount, method, reference, notes });
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            const result = await finance.invoices.recordPayment(invoice.id, checked.body);
            setInvoice(result.invoice);
            setAmount("");
            setReference("");
            setNotes("");
            setFields({});
            onPaid();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setFields(failure.fields);
            setMessage(failure.message);
        } finally {
            setSaving(false);
        }
    }

    const showPayment = invoice !== null && canPay && canRecordPayment(invoice.status);

    return (
        <Dialog open={invoiceId !== null} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{invoice ? invoice.number : "Invoice"}</DialogTitle></DialogHeader>
                {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                {!invoice && !message ? <p className="text-sm text-muted-foreground">Loading invoice…</p> : null}
                {invoice ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm">{linkedLabel(invoice.clientId, labels, "Client name unavailable", "Client name unavailable")} · Due {formatDay(invoice.dueDate)}</p>
                            <StatusPill status={invoice.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <p>Subtotal {inr(invoice.subtotal)}</p>
                            <p>Tax {inr(invoice.tax)} · {percentFromBps(invoice.rateBps)}%</p>
                            <p>CGST {inr(invoice.cgst)}</p>
                            <p>SGST {inr(invoice.sgst)}</p>
                            <p>IGST {inr(invoice.igst)}</p>
                            <p>Total {inr(invoice.total)}</p>
                            <p>Paid {inr(invoice.amountPaid)}</p>
                            <p>Balance {inr(invoice.balanceDue)}</p>
                        </div>
                        <ul className="divide-y text-sm">
                            {invoice.lines.map((line) => (
                                <li key={line.id} className="flex justify-between gap-3 py-2">
                                    <span>{line.description} · {line.quantity} × {inr(line.unitPrice)}</span>
                                    <span className="font-mono">{inr(line.amount)}</span>
                                </li>
                            ))}
                        </ul>
                        {invoice.payments.length > 0 ? (
                            <ul className="space-y-1 text-xs text-muted-foreground">
                                {invoice.payments.map((payment) => (
                                    <li key={payment.id}>{formatDay(payment.paidOn)} · {inr(payment.amount)} · {payment.method} · {payment.reference}</li>
                                ))}
                            </ul>
                        ) : null}
                        {canEdit && invoice.status === "Draft" ? <Button size="sm" variant="outline" onClick={() => onEdit(invoice)}>Edit draft</Button> : null}
                        {showPayment ? (
                            <form className="space-y-3" onSubmit={(event) => void pay(event)}>
                                <p className="text-sm font-medium">Record payment</p>
                                <Field label="Paid on" type="date" value={paidOn} error={fields.paidOn} onChange={setPaidOn} />
                                <Field label="Amount (₹)" value={amount} error={fields.amount} onChange={setAmount} />
                                <Field label="Method" value={method} error={fields.method} onChange={setMethod} />
                                <Field label="Reference" value={reference} error={fields.reference} onChange={setReference} />
                                <Field label="Notes" value={notes} error={fields.notes} onChange={setNotes} required={false} />
                                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Record payment"}</Button>
                            </form>
                        ) : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function InvoiceDialog({ open, invoice, canClients, canProjects, onOpenChange, onSaved }: {
    open: boolean;
    invoice: InvoiceDetail | null;
    canClients: boolean;
    canProjects: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}) {
    const auth = useAuth();
    const [number, setNumber] = useState("");
    const [clientId, setClientId] = useState("");
    const [projectId, setProjectId] = useState("");
    const [issueDate, setIssueDate] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [status, setStatus] = useState<EditableInvoiceStatus>("Draft");
    const [supply, setSupply] = useState<Supply>("cgst_sgst");
    const [ratePercent, setRatePercent] = useState("18");
    const [lines, setLines] = useState<LineForm[]>([{ description: "", quantity: "1", unitPrice: "" }]);
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setNumber(invoice?.number ?? "");
        setClientId(invoice?.clientId ?? "");
        setProjectId(invoice?.projectId ?? "");
        setIssueDate(invoice?.issueDate ?? "");
        setDueDate(invoice?.dueDate ?? "");
        setStatus(invoice?.status === "Pending" ? "Pending" : "Draft");
        setSupply(invoice?.supply ?? "cgst_sgst");
        setRatePercent(invoice ? percentFromBps(invoice.rateBps) : "18");
        setLines(invoice?.lines.map((line) => ({ description: line.description, quantity: String(line.quantity), unitPrice: String(line.unitPrice) })) ?? [{ description: "", quantity: "1", unitPrice: "" }]);
        setFields({});
        setMessage(null);
    }, [invoice, open]);
    const clientLabels = useResolvedLabels([clientId], canClients, lookupClientName);
    const projectLabels = useResolvedLabels([projectId], canProjects, lookupProjectName);

    async function submit(event: FormEvent) {
        event.preventDefault();
        const checked = invoiceBody({ number, clientId, projectId, issueDate, dueDate, status, supply, ratePercent, lines });
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            if (invoice) await finance.invoices.update(invoice.id, checked.body);
            else await finance.invoices.create(checked.body);
            onSaved();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setFields(failure.fields);
            setMessage(failure.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{invoice ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <Field label="Number" value={number} error={fields.number} onChange={setNumber} />
                    <RelationPicker label="Client" value={clientId} emptyLabel="Choose a client" required enabled={canClients} selectedLabel={clientLabels[clientId]} load={loadClientOptions} onChange={(id) => { setClientId(id); setProjectId(""); }} unavailable="Choosing a client needs client access." />
                    {fields.clientId ? <p className="text-xs text-destructive">{fields.clientId}</p> : null}
                    <RelationPicker label="Project" value={projectId} emptyLabel="No project" enabled={canProjects && Boolean(clientId)} selectedLabel={projectLabels[projectId]} resetKey={clientId} load={(query) => loadProjectOptions({ ...query, clientId })} onChange={setProjectId} unavailable={clientId ? "Choosing a project needs project access." : "Choose a client before choosing a project."} />
                    {fields.projectId ? <p className="text-xs text-destructive">{fields.projectId}</p> : null}
                    <Field label="Issued" type="date" value={issueDate} error={fields.issueDate} onChange={setIssueDate} />
                    <Field label="Due" type="date" value={dueDate} error={fields.dueDate} onChange={setDueDate} />
                    <label className="block text-xs text-muted-foreground">Status
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={status} onChange={(event) => setStatus(event.target.value as EditableInvoiceStatus)}>
                            {EDITABLE_INVOICE_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <label className="block text-xs text-muted-foreground">Supply
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={supply} onChange={(event) => setSupply(event.target.value as Supply)}>
                            <option value="cgst_sgst">CGST + SGST</option>
                            <option value="igst">IGST</option>
                        </select>
                    </label>
                    <Field label="Tax rate (%)" value={ratePercent} error={fields.rateBps} onChange={setRatePercent} />
                    {lines.map((line, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-3">
                            <Field label="Description" value={line.description} error={fields[`lines.${index}.description`]} onChange={(description) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, description } : item))} />
                            <Field label="Qty" value={line.quantity} error={fields[`lines.${index}.quantity`]} onChange={(quantity) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, quantity } : item))} />
                            <Field label="Rate (₹)" value={line.unitPrice} error={fields[`lines.${index}.unitPrice`]} onChange={(unitPrice) => setLines(lines.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice } : item))} />
                        </div>
                    ))}
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={lines.length >= 50} onClick={() => setLines([...lines, { description: "", quantity: "1", unitPrice: "" }])}>Add line</Button>
                        {lines.length > 1 ? <Button type="button" variant="outline" size="sm" onClick={() => setLines(lines.slice(0, -1))}>Remove line</Button> : null}
                    </div>
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ExpenseDialog({ open, expense, onOpenChange, onSaved }: {
    open: boolean;
    expense: Expense | null;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}) {
    const auth = useAuth();
    const [category, setCategory] = useState("");
    const [vendor, setVendor] = useState("");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState("");
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setCategory(expense?.category ?? "");
        setVendor(expense?.vendor ?? "");
        setDescription(expense?.description ?? "");
        setAmount(expense ? String(expense.amount) : "");
        setDate(expense?.date ?? "");
        setFields({});
        setMessage(null);
    }, [expense, open]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        const checked = expenseBody({ category, vendor, description, amount, date });
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            if (expense) await finance.expenses.update(expense.id, checked.body);
            else await finance.expenses.create(checked.body);
            onSaved();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setFields(failure.fields);
            setMessage(failure.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{expense ? "Edit expense" : "New expense"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <Field label="Category" value={category} error={fields.category} onChange={setCategory} />
                    <Field label="Vendor" value={vendor} error={fields.vendor} onChange={setVendor} required={false} />
                    <Field label="Description" value={description} error={fields.description} onChange={setDescription} required={false} />
                    <Field label="Amount (₹)" value={amount} error={fields.amount} onChange={setAmount} />
                    <Field label="Date" type="date" value={date} error={fields.date} onChange={setDate} />
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, value, error, type = "text", required = true, onChange }: { label: string; value: string; error?: string; type?: string; required?: boolean; onChange: (value: string) => void }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input className="mt-1" type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}
