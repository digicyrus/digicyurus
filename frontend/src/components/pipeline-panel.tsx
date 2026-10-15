import { Plus, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { EmptyState, Panel, StatusPill } from "@/components/page-kit";
import { RelationPicker, useResolvedLabels } from "@/components/relation-picker";
import { AreaField, ChoiceField, FormAlert, Notice, Pager, TextField } from "@/components/sales-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { apiFailure, formatDateTime, formatDay } from "@/lib/crm";
import { inr } from "@/lib/mock-data";
import { canBrowseClients, canBrowseEmployees, canBrowseLeads, linkedLabel, loadClientOptions, loadEmployeeOptions, loadLeadOptions, lookupClientName, lookupEmployeeName, lookupLeadName } from "@/lib/relations";
import {
    blankOpportunityForm,
    canCreateOpportunity,
    canMoveOpportunity,
    canUpdateOpportunity,
    canViewPipeline,
    OPPORTUNITY_STAGES,
    opportunityBody,
    opportunityFormFrom,
    SALES_PRIORITIES,
    sales,
    stageChangeBody,
    type Opportunity,
    type OpportunityDetail,
    type OpportunityForm,
    type OpportunityStage,
    type PipelineSummary,
    type SalesPriority,
} from "@/lib/sales";

const PAGE_SIZE = 20;

export function PipelinePanel() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = canViewPipeline(permissions);
    const canCreate = canCreateOpportunity(permissions);
    const canUpdate = canUpdateOpportunity(permissions);
    const canMove = canMoveOpportunity(permissions);
    const [items, setItems] = useState<Opportunity[]>([]);
    const [summary, setSummary] = useState<PipelineSummary | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [stage, setStage] = useState<OpportunityStage | "">("");
    const [priority, setPriority] = useState<SalesPriority | "">("");
    const [message, setMessage] = useState<string | null>(null);
    const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editor, setEditor] = useState<Opportunity | "new" | null>(null);
    const [pending, setPending] = useState<{ id: string; title: string; stage: "Won" | "Lost" } | null>(null);
    const [movingId, setMovingId] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const clientLabels = useResolvedLabels(items.map((item) => item.clientId), canBrowseClients(permissions), lookupClientName);
    const ownerLabels = useResolvedLabels(items.map((item) => item.ownerEmployeeId), canBrowseEmployees(permissions), lookupEmployeeName);

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
            setSummary(null);
            setLoading(false);
            return;
        }
        let active = true;
        setLoading(true);
        void Promise.allSettled([
            sales.opportunities.list({
                page,
                pageSize: PAGE_SIZE,
                search: query || undefined,
                stage: stage || undefined,
                priority: priority || undefined,
            }),
            sales.opportunities.summary(),
        ]).then(([listed, summarized]) => {
            if (!active) return;
            if (listed.status === "fulfilled") {
                setItems(listed.value.items);
                setTotal(listed.value.total);
                setMessage(null);
            } else {
                const failure = apiFailure(listed.reason);
                if (failure.status === 401) void auth.refresh();
                setItems([]);
                setTotal(0);
                setMessage(failure.message);
            }
            if (summarized.status === "fulfilled") {
                setSummary(summarized.value);
                setSummaryMessage(null);
            } else {
                const failure = apiFailure(summarized.reason);
                if (failure.status === 401) void auth.refresh();
                setSummary(null);
                setSummaryMessage(failure.message);
            }
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [canView, page, query, stage, priority, revision, auth.refresh]);

    async function move(id: string, next: OpportunityStage, lostReason = "", closedOn = "") {
        const checked = stageChangeBody({ stage: next, lostReason, closedOn });
        if (!checked.ok) return checked;
        setMovingId(id);
        try {
            await sales.opportunities.changeStage(id, checked.body);
            setPending(null);
            setMessage(null);
            setRevision((current) => current + 1);
            return null;
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            return failure;
        } finally {
            setMovingId(null);
        }
    }

    function requestStage(item: Opportunity, next: OpportunityStage) {
        if (next === item.stage || movingId) return;
        if (next === "Lost" || next === "Won") {
            setPending({ id: item.id, title: item.title, stage: next });
            return;
        }
        void move(item.id, next).then((failure) => {
            if (failure) setMessage(failure.message);
        });
    }

    if (!canView) {
        return <Panel title="Pipeline"><p role="alert" className="text-sm text-destructive">You do not have access to this.</p></Panel>;
    }

    const columns = stage ? OPPORTUNITY_STAGES.filter((column) => column === stage) : OPPORTUNITY_STAGES;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Notice>Stage changes are saved on their own. Moving a deal to Lost requires a reason. Won and Lost record a closed date; leave it blank to use today.</Notice>
                {canCreate ? <Button type="button" onClick={() => setEditor("new")}><Plus className="mr-1 h-4 w-4" />New opportunity</Button> : null}
            </div>
            <FormAlert message={message} />
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {OPPORTUNITY_STAGES.map((column) => {
                    const row = summary?.stages.find((entry) => entry.stage === column);
                    return (
                        <div key={column} className="surface p-3">
                            <p className="text-xs text-muted-foreground">{column}</p>
                            <p className="mt-1 text-sm font-medium">{row ? `${row.count} · ${inr(row.value)}` : "—"}</p>
                        </div>
                    );
                })}
            </div>
            {summaryMessage ? <p role="alert" className="text-sm text-destructive">Pipeline totals: {summaryMessage}</p> : null}
            {summary ? <p className="text-xs text-muted-foreground">Open pipeline {summary.open.count} · {inr(summary.open.value)}. Closed {summary.closed.count} · {inr(summary.closed.value)}. These totals cover every opportunity, not only this page.</p> : null}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search opportunities…" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <select aria-label="Opportunity stage" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={stage} onChange={(event) => { setStage(event.target.value as OpportunityStage | ""); setPage(1); }}>
                    <option value="">All stages</option>
                    {OPPORTUNITY_STAGES.map((option) => <option key={option}>{option}</option>)}
                </select>
                <select aria-label="Opportunity priority" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={priority} onChange={(event) => { setPriority(event.target.value as SalesPriority | ""); setPage(1); }}>
                    <option value="">All priorities</option>
                    {SALES_PRIORITIES.map((option) => <option key={option}>{option}</option>)}
                </select>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading opportunities…</p> : null}
            {!loading && !message && items.length === 0 ? <EmptyState title="No opportunities" hint="Create a deal or change the filters." /> : null}
            {items.length > 0 ? (
                <Tabs defaultValue="board">
                    <TabsList>
                        <TabsTrigger value="board">Board</TabsTrigger>
                        <TabsTrigger value="table">Table</TabsTrigger>
                    </TabsList>
                    <TabsContent value="board">
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {columns.map((column) => {
                                const columnItems = items.filter((item) => item.stage === column);
                                return (
                                    <div key={column} className="w-72 shrink-0">
                                        <p className="mb-2 px-1 text-sm font-semibold">{column} <span className="text-xs font-normal text-muted-foreground">({columnItems.length} on this page)</span></p>
                                        <div className="space-y-2 rounded-xl bg-muted/50 p-2">
                                            {columnItems.length === 0 ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">No opportunities</p> : columnItems.map((item) => (
                                                <OpportunityCard key={item.id} item={item} canMove={canMove} moving={movingId === item.id} client={linkedLabel(item.clientId, clientLabels, "No client", "Client name unavailable")} owner={linkedLabel(item.ownerEmployeeId, ownerLabels, "Unassigned", "Owner name unavailable")} onOpen={() => setSelectedId(item.id)} onStage={(next) => requestStage(item, next)} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </TabsContent>
                    <TabsContent value="table">
                        <Panel>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Reference</TableHead>
                                            <TableHead>Deal</TableHead>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Owner</TableHead>
                                            <TableHead>Value</TableHead>
                                            <TableHead>Closing</TableHead>
                                            <TableHead>Priority</TableHead>
                                            <TableHead>Stage</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                                                <TableCell className="font-mono text-xs">{item.reference}</TableCell>
                                                <TableCell className="font-medium">{item.title}</TableCell>
                                                <TableCell className="text-muted-foreground">{linkedLabel(item.clientId, clientLabels, "No client", "Client name unavailable")}</TableCell>
                                                <TableCell className="text-muted-foreground">{linkedLabel(item.ownerEmployeeId, ownerLabels, "Unassigned", "Owner name unavailable")}</TableCell>
                                                <TableCell className="font-mono text-xs">{inr(item.value)}</TableCell>
                                                <TableCell className="text-muted-foreground">{formatDay(item.expectedClose)}</TableCell>
                                                <TableCell><StatusPill status={item.priority} /></TableCell>
                                                <TableCell onClick={(event) => event.stopPropagation()}>
                                                    {canMove ? (
                                                        <select aria-label={`Stage for ${item.title}`} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs" value={item.stage} disabled={movingId === item.id} onChange={(event) => requestStage(item, event.target.value as OpportunityStage)}>
                                                            {OPPORTUNITY_STAGES.map((option) => <option key={option}>{option}</option>)}
                                                        </select>
                                                    ) : <StatusPill status={item.stage} />}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Panel>
                    </TabsContent>
                </Tabs>
            ) : null}
            <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
            <OpportunityDetail id={selectedId} canUpdate={canUpdate} revision={revision} onClose={() => setSelectedId(null)} onEdit={(record) => setEditor(record)} />
            <OpportunityEditor open={editor !== null} record={editor === "new" ? null : editor} onOpenChange={(open) => { if (!open) setEditor(null); }} onSaved={() => { setEditor(null); setRevision((current) => current + 1); }} />
            <StageDialog pending={pending} saving={pending !== null && movingId === pending.id} onOpenChange={(open) => { if (!open) setPending(null); }} onSubmit={async (lostReason, closedOn) => {
                if (!pending) return null;
                const failure = await move(pending.id, pending.stage, lostReason, closedOn);
                if (!failure) return null;
                return failure.fields.lostReason ?? failure.fields.closedOn ?? failure.message;
            }} />
        </div>
    );
}

function OpportunityCard({ item, canMove, moving, client, owner, onOpen, onStage }: { item: Opportunity; canMove: boolean; moving: boolean; client: string; owner: string; onOpen: () => void; onStage: (stage: OpportunityStage) => void }) {
    return (
        <article className="surface p-3">
            <button className="w-full text-left" onClick={onOpen}>
                <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <StatusPill status={item.priority} />
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{item.reference}</p>
                <p className="mt-2 font-mono text-sm">{inr(item.value)}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{client}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{owner}</span>
                    <span>{formatDay(item.expectedClose)}</span>
                </div>
            </button>
            {canMove ? (
                <select aria-label={`Stage for ${item.title}`} className="mt-2 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs" value={item.stage} disabled={moving} onChange={(event) => onStage(event.target.value as OpportunityStage)}>
                    {OPPORTUNITY_STAGES.map((option) => <option key={option}>{option}</option>)}
                </select>
            ) : null}
        </article>
    );
}

function OpportunityDetail({ id, canUpdate, revision, onClose, onEdit }: { id: string | null; canUpdate: boolean; revision: number; onClose: () => void; onEdit: (record: Opportunity) => void }) {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const [record, setRecord] = useState<OpportunityDetail | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const clientLabels = useResolvedLabels([record?.clientId], canBrowseClients(permissions), lookupClientName);
    const leadLabels = useResolvedLabels([record?.leadId], canBrowseLeads(permissions), lookupLeadName);
    const ownerLabels = useResolvedLabels([record?.ownerEmployeeId], canBrowseEmployees(permissions), lookupEmployeeName);

    useEffect(() => {
        if (!id) {
            setRecord(null);
            setMessage(null);
            return;
        }
        let active = true;
        void sales.opportunities.get(id).then((detail) => {
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

    return (
        <Dialog open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{record?.title ?? "Opportunity"}</DialogTitle></DialogHeader>
                <FormAlert message={message} />
                {!record && !message ? <p className="text-sm text-muted-foreground">Loading opportunity…</p> : null}
                {record ? (
                    <div className="space-y-3 text-sm">
                        <p className="font-mono text-xs text-muted-foreground">{record.reference}</p>
                        <div className="flex flex-wrap gap-2"><StatusPill status={record.stage} /><StatusPill status={record.priority} /></div>
                        <p>{inr(record.value)} · closes {formatDay(record.expectedClose)}</p>
                        <p>Client: {linkedLabel(record.clientId, clientLabels, "No client", "Client name unavailable")}</p>
                        <p>Lead: {linkedLabel(record.leadId, leadLabels, "No lead", "Lead name unavailable")}</p>
                        <p>Owner: {linkedLabel(record.ownerEmployeeId, ownerLabels, "Unassigned", "Owner name unavailable")}</p>
                        <p>Source: {record.source}</p>
                        {record.notes ? <p className="whitespace-pre-wrap text-muted-foreground">{record.notes}</p> : null}
                        {record.lostReason ? <p>Lost reason: {record.lostReason}</p> : null}
                        {record.closedOn ? <p>Closed {formatDay(record.closedOn)}</p> : null}
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground">Stage history</p>
                            {record.stageHistory.length === 0 ? <p className="text-muted-foreground">No stage changes yet.</p> : (
                                <ul className="mt-1 space-y-1">
                                    {record.stageHistory.map((event) => (
                                        <li key={event.id}>{event.fromStage ?? "Created"} → {event.toStage} · {formatDateTime(event.createdAt)}{event.lostReason ? ` · ${event.lostReason}` : ""}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {canUpdate ? <Button type="button" variant="outline" onClick={() => onEdit(record)}>Edit details</Button> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function OpportunityEditor({ open, record, onOpenChange, onSaved }: { open: boolean; record: Opportunity | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const [form, setForm] = useState<OpportunityForm>(blankOpportunityForm());
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(record ? opportunityFormFrom(record) : blankOpportunityForm());
        setFields({});
        setMessage(null);
    }, [record, open]);

    function set<K extends keyof OpportunityForm>(key: K, value: OpportunityForm[K]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (record) {
            const checked = opportunityBody(form, "edit");
            if (!checked.ok) {
                setFields(checked.fields);
                setMessage(checked.message);
                return;
            }
            setSaving(true);
            try {
                await sales.opportunities.update(record.id, checked.body);
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
        const checked = opportunityBody(form, "create");
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        try {
            await sales.opportunities.create(checked.body);
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

    const creating = record === null;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{creating ? "New opportunity" : "Edit opportunity"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    <FormAlert message={message} />
                    {creating ? null : <Notice>Stage, lost reason, and closed date change from the board, not from this form.</Notice>}
                    <TextField label="Reference" value={form.reference} error={fields.reference} required onChange={(value) => set("reference", value)} />
                    <TextField label="Title" value={form.title} error={fields.title} required onChange={(value) => set("title", value)} />
                    <RelationPicker label="Client" value={form.clientId} onChange={(value) => set("clientId", value)} load={loadClientOptions} enabled={canBrowseClients(permissions)} emptyLabel="No client" selectedLabel={form.clientId ? undefined : null} />
                    {fields.clientId ? <p className="text-xs text-destructive">{fields.clientId}</p> : null}
                    <RelationPicker label="Lead" value={form.leadId} onChange={(value) => set("leadId", value)} load={loadLeadOptions} enabled={canBrowseLeads(permissions)} emptyLabel="No lead" />
                    <RelationPicker label="Owner" value={form.ownerEmployeeId} onChange={(value) => set("ownerEmployeeId", value)} load={loadEmployeeOptions} enabled={canBrowseEmployees(permissions)} emptyLabel="Unassigned" unavailable="Owner names need employee access. You can leave the owner unset." />
                    <TextField label="Value (₹)" value={form.value} error={fields.value} required onChange={(value) => set("value", value)} />
                    <TextField label="Expected closing" type="date" value={form.expectedClose} error={fields.expectedClose} required onChange={(value) => set("expectedClose", value)} />
                    <TextField label="Source" value={form.source} error={fields.source} required onChange={(value) => set("source", value)} />
                    <ChoiceField label="Priority" value={form.priority} options={SALES_PRIORITIES} onChange={(value) => set("priority", value as SalesPriority)} />
                    {creating ? <ChoiceField label="Stage" value={form.stage} options={OPPORTUNITY_STAGES} onChange={(value) => set("stage", value as OpportunityStage)} /> : null}
                    {creating && form.stage === "Lost" ? <TextField label="Lost reason" value={form.lostReason} error={fields.lostReason} required onChange={(value) => set("lostReason", value)} /> : null}
                    {creating && (form.stage === "Won" || form.stage === "Lost") ? <TextField label="Closed date" type="date" value={form.closedOn} error={fields.closedOn} onChange={(value) => set("closedOn", value)} /> : null}
                    <AreaField label="Notes" value={form.notes} error={fields.notes} onChange={(value) => set("notes", value)} />
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function StageDialog({ pending, saving, onOpenChange, onSubmit }: { pending: { id: string; title: string; stage: "Won" | "Lost" } | null; saving: boolean; onOpenChange: (open: boolean) => void; onSubmit: (lostReason: string, closedOn: string) => Promise<string | null> }) {
    const [lostReason, setLostReason] = useState("");
    const [closedOn, setClosedOn] = useState("");
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        setLostReason("");
        setClosedOn("");
        setError(null);
    }, [pending]);
    return (
        <Dialog open={pending !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{pending?.stage === "Lost" ? "Move to Lost" : "Move to Won"}</DialogTitle></DialogHeader>
                {pending ? (
                    <form className="space-y-3" onSubmit={(event) => {
                        event.preventDefault();
                        const checked = stageChangeBody({ stage: pending.stage, lostReason, closedOn });
                        if (!checked.ok) {
                            setError(checked.fields.lostReason ?? checked.fields.closedOn ?? checked.message);
                            return;
                        }
                        setError(null);
                        void onSubmit(lostReason, closedOn).then((failure) => {
                            if (failure) setError(failure);
                        });
                    }}>
                        <Notice>{pending.title}. Leave the closed date blank to use today. {pending.stage === "Won" ? "A lost reason is not used for Won." : "A lost reason is required."}</Notice>
                        <FormAlert message={error} />
                        {pending.stage === "Lost" ? <TextField label="Lost reason" value={lostReason} required onChange={setLostReason} /> : null}
                        <TextField label="Closed date" type="date" value={closedOn} onChange={setClosedOn} />
                        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save stage"}</Button>
                    </form>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
