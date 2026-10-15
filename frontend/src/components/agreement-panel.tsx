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
    AGREEMENT_RECORD_NOTE,
    AGREEMENT_STATUSES,
    agreementBody,
    agreementEditScope,
    agreementFormFrom,
    agreementStatusBody,
    blankAgreementForm,
    canChangeAgreementStatus,
    canCreateAgreement,
    canUpdateAgreement,
    canViewAgreements,
    canViewPipeline,
    canViewProposals,
    nextAgreementStatuses,
    sales,
    type Agreement,
    type AgreementDetail,
    type AgreementForm,
    type AgreementStatus,
} from "@/lib/sales";

const PAGE_SIZE = 20;

export function AgreementPanel() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = canViewAgreements(permissions);
    const canCreate = canCreateAgreement(permissions);
    const canUpdate = canUpdateAgreement(permissions);
    const canChange = canChangeAgreementStatus(permissions);
    const [items, setItems] = useState<Agreement[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<AgreementStatus | "">("");
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editor, setEditor] = useState<Agreement | "new" | null>(null);
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
        void sales.agreements.list({ page, pageSize: PAGE_SIZE, search: query || undefined, status: status || undefined }).then((result) => {
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
        return <Panel title="Agreements"><p role="alert" className="text-sm text-destructive">You do not have access to this.</p></Panel>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Notice>{AGREEMENT_RECORD_NOTE}</Notice>
                {canCreate ? <Button type="button" onClick={() => setEditor("new")}><Plus className="mr-1 h-4 w-4" />New agreement</Button> : null}
            </div>
            <FormAlert message={message} />
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search agreements…" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <select aria-label="Agreement status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as AgreementStatus | ""); setPage(1); }}>
                    <option value="">All statuses</option>
                    {AGREEMENT_STATUSES.map((option) => <option key={option}>{option}</option>)}
                </select>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading agreements…</p> : null}
            {!loading && !message && items.length === 0 ? <EmptyState title="No agreements" hint="Create a draft or change the filters." /> : null}
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
                                    <TableHead>Value</TableHead>
                                    <TableHead>End</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                                        <TableCell className="font-mono text-xs">{item.number}</TableCell>
                                        <TableCell className="font-medium">{item.title}</TableCell>
                                        <TableCell className="text-muted-foreground">{linkedLabel(item.clientId, clientLabels, "No client", "Client name unavailable")}</TableCell>
                                        <TableCell><StatusPill status={item.status} /></TableCell>
                                        <TableCell className="font-mono text-xs">{inr(item.value)}</TableCell>
                                        <TableCell className="text-muted-foreground">{formatDay(item.endDate)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Panel>
            ) : null}
            <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
            <AgreementDetail id={selectedId} canUpdate={canUpdate} canChange={canChange} revision={revision} onClose={() => setSelectedId(null)} onEdit={(record) => setEditor(record)} onChanged={() => setRevision((current) => current + 1)} />
            <AgreementEditor open={editor !== null} record={editor === "new" ? null : editor} onOpenChange={(open) => { if (!open) setEditor(null); }} onSaved={() => { setEditor(null); setRevision((current) => current + 1); }} />
        </div>
    );
}

function AgreementDetail({ id, canUpdate, canChange, revision, onClose, onEdit, onChanged }: { id: string | null; canUpdate: boolean; canChange: boolean; revision: number; onClose: () => void; onEdit: (record: Agreement) => void; onChanged: () => void }) {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const [record, setRecord] = useState<AgreementDetail | null>(null);
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
        void sales.agreements.get(id).then((detail) => {
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

    async function changeStatus(status: AgreementStatus) {
        if (!record) return;
        const checked = agreementStatusBody(record.status, status);
        if (!checked.ok) {
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        try {
            const updated = await sales.agreements.changeStatus(record.id, checked.body);
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

    const scope = record ? agreementEditScope(record.status) : "closed";

    return (
        <Dialog open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{record?.title ?? "Agreement"}</DialogTitle></DialogHeader>
                <Notice>{AGREEMENT_RECORD_NOTE}</Notice>
                <FormAlert message={message} />
                {!record && !message ? <p className="text-sm text-muted-foreground">Loading agreement…</p> : null}
                {record ? (
                    <div className="space-y-3 text-sm">
                        <p className="font-mono text-xs text-muted-foreground">{record.number}</p>
                        <StatusPill status={record.status} />
                        <p>Client: {linkedLabel(record.clientId, clientLabels, "No client", "Client name unavailable")}</p>
                        <p>{formatDay(record.startDate)} – {formatDay(record.endDate)}</p>
                        <p className="font-mono">{inr(record.value)}</p>
                        {record.description ? <p className="whitespace-pre-wrap text-muted-foreground">{record.description}</p> : null}
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
                            {canUpdate && scope !== "closed" ? <Button type="button" variant="outline" onClick={() => onEdit(record)}>{scope === "active" ? "Edit terms" : "Edit draft"}</Button> : null}
                            {canChange ? nextAgreementStatuses(record.status).map((status) => (
                                <Button key={status} type="button" variant="outline" disabled={saving} onClick={() => void changeStatus(status)}>{status}</Button>
                            )) : null}
                        </div>
                        {scope === "active" ? <Notice>Number, client, opportunity, and proposal stay fixed once an agreement is active.</Notice> : null}
                        {scope === "closed" ? <Notice>Completed, terminated, and expired agreements cannot be edited.</Notice> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function AgreementEditor({ open, record, onOpenChange, onSaved }: { open: boolean; record: Agreement | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const scope = record ? agreementEditScope(record.status) : "draft";
    const locked = scope === "active";
    const [form, setForm] = useState<AgreementForm>(blankAgreementForm());
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(record ? agreementFormFrom(record) : blankAgreementForm());
        setFields({});
        setMessage(null);
    }, [record, open]);

    function set<K extends keyof AgreementForm>(key: K, value: AgreementForm[K]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (scope === "closed") {
            setMessage("This agreement cannot be edited");
            return;
        }
        if (locked) {
            const checked = agreementBody(form, "active");
            if (!checked.ok) {
                setFields(checked.fields);
                setMessage(checked.message);
                return;
            }
            if (!record) return;
            setSaving(true);
            try {
                await sales.agreements.update(record.id, checked.body);
                onSaved();
            } catch (error) {
                const failure = apiFailure(error);
                if (failure.status === 401) void auth.refresh();
                setFields(failure.fields);
                setMessage(failure.message);
            } finally {
                setSaving(false);
            }
            return;
        }
        const checked = agreementBody(form, record ? "draft" : "create");
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        try {
            if (record) await sales.agreements.update(record.id, checked.body);
            else await sales.agreements.create(checked.body);
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
                <DialogHeader><DialogTitle>{record ? (locked ? "Edit agreement terms" : "Edit agreement") : "New agreement"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    <Notice>{AGREEMENT_RECORD_NOTE} New agreements start as drafts.</Notice>
                    {locked ? <Notice>Number, client, opportunity, and proposal cannot change while this agreement is active.</Notice> : null}
                    <FormAlert message={message} />
                    <TextField label="Number" value={form.number} error={fields.number} required={!locked} disabled={locked} onChange={(value) => set("number", value)} />
                    <TextField label="Title" value={form.title} error={fields.title} required onChange={(value) => set("title", value)} />
                    <RelationPicker label="Client" value={form.clientId} onChange={(value) => setForm((current) => ({ ...current, clientId: value, opportunityId: "", proposalId: "" }))} load={loadClientOptions} enabled={canBrowseClients(permissions) && !locked} required={!locked} emptyLabel="Choose a client" resetKey={record?.id ?? "new"} unavailable={locked ? "The client is fixed while this agreement is active." : undefined} />
                    {fields.clientId ? <p className="text-xs text-destructive">{fields.clientId}</p> : null}
                    <RelationPicker label="Opportunity" value={form.opportunityId} onChange={(value) => set("opportunityId", value)} load={(query) => sales.opportunities.list({ page: query.page, pageSize: query.pageSize, search: query.search, clientId: form.clientId || undefined }).then((page) => ({ page: page.page, pageSize: page.pageSize, total: page.total, items: page.items.map((item) => ({ id: item.id, label: `${item.reference} · ${item.title}` })) }))} enabled={canViewPipeline(permissions) && !locked} emptyLabel="No opportunity" resetKey={form.clientId} unavailable={locked ? "The opportunity is fixed while this agreement is active." : "Opportunities need pipeline access."} />
                    <RelationPicker label="Proposal" value={form.proposalId} onChange={(value) => set("proposalId", value)} load={(query) => sales.proposals.list({ page: query.page, pageSize: query.pageSize, search: query.search, clientId: form.clientId || undefined }).then((page) => ({ page: page.page, pageSize: page.pageSize, total: page.total, items: page.items.map((item) => ({ id: item.id, label: `${item.number} · ${item.title}` })) }))} enabled={canViewProposals(permissions) && !locked} emptyLabel="No proposal" resetKey={form.clientId} unavailable={locked ? "The proposal is fixed while this agreement is active." : "Proposals need proposal access."} />
                    <TextField label="Start" type="date" value={form.startDate} error={fields.startDate} required onChange={(value) => set("startDate", value)} />
                    <TextField label="End" type="date" value={form.endDate} error={fields.endDate} required onChange={(value) => set("endDate", value)} />
                    <TextField label="Value (₹)" value={form.value} error={fields.value} required onChange={(value) => set("value", value)} />
                    <AreaField label="Description" value={form.description} error={fields.description} onChange={(value) => set("description", value)} />
                    <Button type="submit" disabled={saving || scope === "closed"}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
