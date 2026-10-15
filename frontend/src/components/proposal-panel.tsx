import { Plus, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { EmptyState, Panel, StatusPill } from "@/components/page-kit";
import { RelationPicker, useResolvedLabels } from "@/components/relation-picker";
import { AreaField, FormAlert, Notice, Pager, TextField } from "@/components/sales-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { apiFailure, formatDateTime, formatDay } from "@/lib/crm";
import { inr } from "@/lib/mock-data";
import { canBrowseClients, linkedLabel, loadClientOptions, lookupClientName } from "@/lib/relations";
import {
    blankProposalForm,
    blankProposalLine,
    canChangeProposalStatus,
    canCreateProposal,
    canEditProposal,
    canUpdateProposal,
    canViewPipeline,
    canViewProposals,
    nextProposalStatuses,
    previewProposal,
    PROPOSAL_SENT_NOTE,
    PROPOSAL_STATUSES,
    proposalBody,
    proposalFormFrom,
    proposalStatusBody,
    sales,
    type Proposal,
    type ProposalDetail,
    type ProposalForm,
    type ProposalStatus,
} from "@/lib/sales";

const PAGE_SIZE = 20;

export function ProposalPanel() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = canViewProposals(permissions);
    const canCreate = canCreateProposal(permissions);
    const canUpdate = canUpdateProposal(permissions);
    const canChange = canChangeProposalStatus(permissions);
    const [items, setItems] = useState<Proposal[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<ProposalStatus | "">("");
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editor, setEditor] = useState<ProposalDetail | "new" | null>(null);
    const [revision, setRevision] = useState(0);
    const clientLabels = useResolvedLabels(items.map((item) => item.clientId), canBrowseClients(permissions), lookupClientName);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setPage(1);
            setQuery(search.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (!canView) {
            setItems([]);
            setTotal(0);
            setLoading(false);
            return;
        }
        let active = true;
        setLoading(true);
        void sales.proposals.list({ page, pageSize: PAGE_SIZE, search: query || undefined, status: status || undefined }).then((result) => {
            if (!active) return;
            setItems(result.items);
            setTotal(result.total);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setItems([]);
            setTotal(0);
            setMessage(failure.message);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [canView, page, query, status, revision, auth.refresh]);

    if (!canView) {
        return <Panel title="Proposals"><p role="alert" className="text-sm text-destructive">You do not have access to this.</p></Panel>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Notice>{PROPOSAL_SENT_NOTE}</Notice>
                {canCreate ? <Button type="button" onClick={() => setEditor("new")}><Plus className="mr-1 h-4 w-4" />New proposal</Button> : null}
            </div>
            <FormAlert message={message} />
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search proposals…" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <select aria-label="Proposal status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as ProposalStatus | ""); setPage(1); }}>
                    <option value="">All statuses</option>
                    {PROPOSAL_STATUSES.map((option) => <option key={option}>{option}</option>)}
                </select>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading proposals…</p> : null}
            {!loading && !message && items.length === 0 ? <EmptyState title="No proposals" hint="Create a draft or change the filters." /> : null}
            {items.length > 0 ? (
                <Panel>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Number</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Valid until</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                                        <TableCell className="font-mono text-xs">{item.number}</TableCell>
                                        <TableCell className="font-medium">{item.title}</TableCell>
                                        <TableCell className="text-muted-foreground">{linkedLabel(item.clientId, clientLabels, "No client", "Client name unavailable")}</TableCell>
                                        <TableCell><StatusPill status={item.status} /></TableCell>
                                        <TableCell className="font-mono text-xs">{inr(item.total)}</TableCell>
                                        <TableCell className="text-muted-foreground">{formatDay(item.validityDate)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Panel>
            ) : null}
            <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
            <ProposalDetail id={selectedId} canUpdate={canUpdate} canChange={canChange} revision={revision} onClose={() => setSelectedId(null)} onEdit={(record) => setEditor(record)} onChanged={() => setRevision((current) => current + 1)} />
            <ProposalEditor open={editor !== null} record={editor === "new" ? null : editor} onOpenChange={(open) => { if (!open) setEditor(null); }} onSaved={() => { setEditor(null); setRevision((current) => current + 1); }} />
        </div>
    );
}

function ProposalDetail({ id, canUpdate, canChange, revision, onClose, onEdit, onChanged }: { id: string | null; canUpdate: boolean; canChange: boolean; revision: number; onClose: () => void; onEdit: (record: ProposalDetail) => void; onChanged: () => void }) {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const [record, setRecord] = useState<ProposalDetail | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const clientLabels = useResolvedLabels([record?.clientId], canBrowseClients(permissions), lookupClientName);

    useEffect(() => {
        if (!id) {
            setRecord(null);
            setMessage(null);
            return;
        }
        let active = true;
        void sales.proposals.get(id).then((detail) => {
            if (!active) return;
            setRecord(detail);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setRecord(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [id, revision, auth.refresh]);

    async function changeStatus(status: ProposalStatus) {
        if (!record) return;
        const checked = proposalStatusBody(record.status, status);
        if (!checked.ok) {
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        try {
            const updated = await sales.proposals.changeStatus(record.id, checked.body);
            setRecord(updated);
            setMessage(null);
            onChanged();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader><DialogTitle>{record?.title ?? "Proposal"}</DialogTitle></DialogHeader>
                <Notice>{PROPOSAL_SENT_NOTE}</Notice>
                <FormAlert message={message} />
                {!record && !message ? <p className="text-sm text-muted-foreground">Loading proposal…</p> : null}
                {record ? (
                    <div className="space-y-3 text-sm">
                        <p className="font-mono text-xs text-muted-foreground">{record.number}</p>
                        <StatusPill status={record.status} />
                        <p>Client: {linkedLabel(record.clientId, clientLabels, "No client", "Client name unavailable")}</p>
                        <p>Valid until {formatDay(record.validityDate)}</p>
                        {record.notes ? <p className="whitespace-pre-wrap text-muted-foreground">{record.notes}</p> : null}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Discount</TableHead>
                                    <TableHead>Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {record.lines.map((line) => (
                                    <TableRow key={line.id}>
                                        <TableCell>{line.description}</TableCell>
                                        <TableCell>{line.quantity}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(line.unitPrice)}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(line.discount)}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(line.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <p className="text-right font-mono text-xs">Subtotal {inr(record.subtotal)} · Discount {inr(record.discount)} · Tax {inr(record.tax)} · Total {inr(record.total)}</p>
                        <p className="text-xs text-muted-foreground">These totals were calculated by the server.</p>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground">Status history</p>
                            {record.statusHistory.length === 0 ? <p className="text-muted-foreground">No status changes yet.</p> : (
                                <ul className="mt-1 space-y-1">
                                    {record.statusHistory.map((event) => (
                                        <li key={event.id}>{event.fromStatus ?? "Created"} → {event.toStatus} · {formatDateTime(event.createdAt)}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {canUpdate && canEditProposal(record.status) ? <Button type="button" variant="outline" onClick={() => onEdit(record)}>Edit draft</Button> : null}
                            {canChange ? nextProposalStatuses(record.status).map((status) => (
                                <Button key={status} type="button" variant="outline" disabled={saving} onClick={() => void changeStatus(status)}>
                                    {status === "Sent" ? "Mark Sent" : status}
                                </Button>
                            )) : null}
                        </div>
                        {record.status !== "Draft" ? <Notice>Only drafts can be edited.</Notice> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function ProposalEditor({ open, record, onOpenChange, onSaved }: { open: boolean; record: ProposalDetail | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const [form, setForm] = useState<ProposalForm>(blankProposalForm());
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(record ? proposalFormFrom(record) : blankProposalForm());
        setFields({});
        setMessage(null);
    }, [record, open]);

    const checked = proposalBody(form);
    const preview = checked.ok ? previewProposal(checked.body) : null;

    function set<K extends keyof ProposalForm>(key: K, value: ProposalForm[K]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        const body = proposalBody(form);
        if (!body.ok) {
            setFields(body.fields);
            setMessage(body.message);
            return;
        }
        setSaving(true);
        try {
            if (record) await sales.proposals.update(record.id, body.body);
            else await sales.proposals.create(body.body);
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
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader><DialogTitle>{record ? "Edit draft proposal" : "New proposal"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    <Notice>{PROPOSAL_SENT_NOTE} New proposals start as drafts. Totals below are a preview; the saved totals come from the server.</Notice>
                    <FormAlert message={message} />
                    <TextField label="Number" value={form.number} error={fields.number} required onChange={(value) => set("number", value)} />
                    <TextField label="Title" value={form.title} error={fields.title} required onChange={(value) => set("title", value)} />
                    <RelationPicker label="Client" value={form.clientId} onChange={(value) => setForm((current) => ({ ...current, clientId: value, opportunityId: "" }))} load={loadClientOptions} enabled={canBrowseClients(permissions)} required emptyLabel="Choose a client" resetKey={record?.id ?? "new"} />
                    {fields.clientId ? <p className="text-xs text-destructive">{fields.clientId}</p> : null}
                    <RelationPicker label="Opportunity" value={form.opportunityId} onChange={(value) => set("opportunityId", value)} load={(query) => sales.opportunities.list({ page: query.page, pageSize: query.pageSize, search: query.search, clientId: form.clientId || undefined }).then((page) => ({ page: page.page, pageSize: page.pageSize, total: page.total, items: page.items.map((item) => ({ id: item.id, label: `${item.reference} · ${item.title}` })) }))} enabled={canViewPipeline(permissions)} emptyLabel="No opportunity" resetKey={form.clientId} />
                    <TextField label="Valid until" type="date" value={form.validityDate} error={fields.validityDate} required onChange={(value) => set("validityDate", value)} />
                    <TextField label="Tax percent" value={form.ratePercent} error={fields.rateBps} required onChange={(value) => set("ratePercent", value)} />
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Lines</p>
                        {fields.lines ? <p className="text-xs text-destructive">{fields.lines}</p> : null}
                        {form.lines.map((line, index) => (
                            <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-4">
                                <TextField label="Description" value={line.description} error={fields[`lines.${index}.description`]} onChange={(value) => set("lines", form.lines.map((item, itemIndex) => itemIndex === index ? { ...item, description: value } : item))} />
                                <TextField label="Quantity" value={line.quantity} error={fields[`lines.${index}.quantity`]} onChange={(value) => set("lines", form.lines.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: value } : item))} />
                                <TextField label="Unit price (₹)" value={line.unitPrice} error={fields[`lines.${index}.unitPrice`]} onChange={(value) => set("lines", form.lines.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: value } : item))} />
                                <TextField label="Discount (₹)" value={line.discount} error={fields[`lines.${index}.discount`]} onChange={(value) => set("lines", form.lines.map((item, itemIndex) => itemIndex === index ? { ...item, discount: value } : item))} />
                                {form.lines.length > 1 ? <Button type="button" variant="outline" onClick={() => set("lines", form.lines.filter((_, itemIndex) => itemIndex !== index))}>Remove line</Button> : null}
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={() => set("lines", [...form.lines, blankProposalLine()])}>Add line</Button>
                    </div>
                    {preview ? <p className="font-mono text-xs">Preview subtotal {inr(preview.subtotal)} · discount {inr(preview.discount)} · tax {inr(preview.tax)} · total {inr(preview.total)}</p> : <p className="text-xs text-muted-foreground">Enter valid lines and a tax rate to preview the total.</p>}
                    <AreaField label="Notes" value={form.notes} error={fields.notes} onChange={(value) => set("notes", value)} />
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save draft"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
