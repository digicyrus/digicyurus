import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { FollowUpPanel } from "@/components/follow-up-panel";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { apiFailure, crm, formatDay, LEAD_PRIORITIES, LEAD_STAGES, type Lead, type LeadDraft, type LeadPriority, type LeadStage } from "@/lib/crm";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/leads")({
    head: () => ({
        meta: [
            { title: "Lead Management — DigiCyrus ERP" },
            { name: "description", content: "Kanban and table views for leads across every stage, with value, source and priority." },
            { property: "og:title", content: "Lead Management — DigiCyrus ERP" },
            { property: "og:description", content: "Track leads from first touch to won deal." },
        ],
    }),
    component: LeadsPage,
});

const emptyDraft = (): LeadDraft => ({
    code: "",
    company: "",
    person: "",
    value: 0,
    source: "",
    priority: "Medium",
    closing: "",
    probability: 0,
});

function LeadsPage() {
    const auth = useAuth();
    const canCreate = auth.user?.permissions.includes("leads:create") ?? false;
    const canUpdate = auth.user?.permissions.includes("leads:update") ?? false;
    const canMove = auth.user?.permissions.includes("leads:move_stage") ?? false;
    const [items, setItems] = useState<Lead[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [stage, setStage] = useState<LeadStage | "">("");
    const [priority, setPriority] = useState<LeadPriority | "">("");
    const [source, setSource] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selected, setSelected] = useState<Lead | null>(null);
    const [editor, setEditor] = useState<Lead | "new" | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<string | null>(null);
    const [movingId, setMovingId] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setPage(1);
            setQuery(search.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        void crm.leads.list({
            page,
            pageSize: 100,
            search: query || undefined,
            stage: stage || undefined,
            priority: priority || undefined,
            source: source.trim() || undefined,
        }).then((result) => {
            if (!active) return;
            setItems(result.items);
            setTotal(result.total);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setItems([]);
            setTotal(0);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [page, query, stage, priority, source, revision, auth.refresh]);

    async function move(lead: Lead, next: LeadStage) {
        if (next === lead.stage) return;
        setMovingId(lead.id);
        setMessage(null);
        try {
            const updated = await crm.leads.moveStage(lead.id, next);
            setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
            if (selected?.id === updated.id) setSelected(updated);
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
        } finally {
            setMovingId(null);
        }
    }

    const pageCount = Math.max(1, Math.ceil(total / 100));

    return (
        <AppShell>
            <PageHeader
                title="Leads"
                subtitle={loading ? "Loading leads…" : `${total} leads`}
                actions={(
                    <>
                        <Button variant="outline" size="sm" onClick={() => setFiltersOpen((open) => !open)}>
                            <Filter className="h-4 w-4" /> Filters
                        </Button>
                        {canCreate ? (
                            <Button size="sm" onClick={() => setEditor("new")}>
                                <Plus className="h-4 w-4" /> Add lead
                            </Button>
                        ) : null}
                    </>
                )}
            />
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            {filtersOpen ? (
                <div className="flex flex-wrap gap-2">
                    <select aria-label="Lead stage" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={stage} onChange={(event) => { setStage(event.target.value as LeadStage | ""); setPage(1); }}>
                        <option value="">All stages</option>
                        {LEAD_STAGES.map((option) => <option key={option}>{option}</option>)}
                    </select>
                    <select aria-label="Lead priority" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={priority} onChange={(event) => { setPriority(event.target.value as LeadPriority | ""); setPage(1); }}>
                        <option value="">All priorities</option>
                        {LEAD_PRIORITIES.map((option) => <option key={option}>{option}</option>)}
                    </select>
                    <Input className="max-w-xs" placeholder="Exact source" value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }} />
                </div>
            ) : null}
            <Tabs defaultValue="kanban" className="space-y-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
                    <div className="relative min-w-0 sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Search leads…" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </div>
                    <TabsList className="shrink-0">
                        <TabsTrigger value="kanban">Kanban</TabsTrigger>
                        <TabsTrigger value="table">Table</TabsTrigger>
                    </TabsList>
                </div>
                {loading ? <p className="text-sm text-muted-foreground">Loading leads…</p> : null}
                <TabsContent value="kanban">
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {LEAD_STAGES.map((column) => {
                            const columnItems = items.filter((lead) => lead.stage === column);
                            return (
                                <div key={column} className="w-64 shrink-0">
                                    <div className="mb-2 flex items-center justify-between px-1">
                                        <p className="text-sm font-semibold">{column}</p>
                                        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{columnItems.length}</span>
                                    </div>
                                    <div className="space-y-2 rounded-xl bg-muted/50 p-2">
                                        {columnItems.length === 0 ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">No leads</p> : columnItems.map((lead) => (
                                            <article key={lead.id} className="surface p-3">
                                                <button className="w-full text-left" onClick={() => setSelected(lead)}>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="truncate text-sm font-medium">{lead.company}</p>
                                                        <StatusPill status={lead.priority} />
                                                    </div>
                                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.person}</p>
                                                    <p className="mt-2 font-mono text-sm">{inr(lead.value)}</p>
                                                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                                                        <span>{lead.source}</span>
                                                        <span>{formatDay(lead.closing)}</span>
                                                    </div>
                                                </button>
                                                {canMove ? (
                                                    <select aria-label={`Stage for ${lead.company}`} className="mt-2 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs" value={lead.stage} disabled={movingId === lead.id} onChange={(event) => void move(lead, event.target.value as LeadStage)}>
                                                        {LEAD_STAGES.map((option) => <option key={option}>{option}</option>)}
                                                    </select>
                                                ) : null}
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </TabsContent>
                <TabsContent value="table">
                    <Panel>
                        {!loading && items.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No leads</p> : null}
                        {items.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Company</TableHead>
                                            <TableHead>Owner contact</TableHead>
                                            <TableHead>Stage</TableHead>
                                            <TableHead>Value</TableHead>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Closing</TableHead>
                                            <TableHead>Priority</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((lead) => (
                                            <TableRow key={lead.id} className="cursor-pointer" onClick={() => setSelected(lead)}>
                                                <TableCell className="font-mono text-xs">{lead.code}</TableCell>
                                                <TableCell className="font-medium">{lead.company}</TableCell>
                                                <TableCell className="text-muted-foreground">{lead.person}</TableCell>
                                                <TableCell onClick={(event) => event.stopPropagation()}>
                                                    {canMove ? (
                                                        <select aria-label={`Stage for ${lead.company}`} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs" value={lead.stage} disabled={movingId === lead.id} onChange={(event) => void move(lead, event.target.value as LeadStage)}>
                                                            {LEAD_STAGES.map((option) => <option key={option}>{option}</option>)}
                                                        </select>
                                                    ) : lead.stage}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{inr(lead.value)}</TableCell>
                                                <TableCell className="text-muted-foreground">{lead.source}</TableCell>
                                                <TableCell className="text-muted-foreground">{formatDay(lead.closing)}</TableCell>
                                                <TableCell><StatusPill status={lead.priority} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : null}
                    </Panel>
                </TabsContent>
            </Tabs>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Page {page} of {pageCount}</span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button>
                </div>
            </div>
            <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
                <DialogContent>
                    {selected ? (
                        <>
                            <DialogHeader><DialogTitle>{selected.company}</DialogTitle></DialogHeader>
                            <div className="space-y-2 text-sm">
                                <p>{selected.person} · {selected.code}</p>
                                <p className="text-muted-foreground">{inr(selected.value)} · {selected.probability}% · {formatDay(selected.closing)}</p>
                                <StatusPill status={selected.stage} />
                                {canUpdate ? <Button size="sm" variant="outline" onClick={() => setEditor(selected)}>Edit</Button> : null}
                            </div>
                            <FollowUpPanel leadId={selected.id} />
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
            <LeadDialog
                open={editor !== null}
                lead={editor === "new" ? null : editor}
                onOpenChange={(open) => { if (!open) setEditor(null); }}
                onSaved={() => {
                    setEditor(null);
                    setRevision((current) => current + 1);
                }}
            />
        </AppShell>
    );
}

function LeadDialog({ open, lead, onOpenChange, onSaved }: { open: boolean; lead: Lead | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const [draft, setDraft] = useState(emptyDraft());
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDraft(lead ? {
            code: lead.code,
            company: lead.company,
            person: lead.person,
            value: lead.value,
            source: lead.source,
            priority: lead.priority,
            closing: lead.closing,
            probability: lead.probability,
        } : emptyDraft());
        setFields({});
        setMessage(null);
    }, [lead, open]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        const body: LeadDraft = {
            ...draft,
            code: draft.code.trim(),
            company: draft.company.trim(),
            person: draft.person.trim(),
            source: draft.source.trim(),
            value: Number(draft.value),
            probability: Number(draft.probability),
        };
        try {
            if (lead) await crm.leads.update(lead.id, body);
            else await crm.leads.create(body);
            onSaved();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setFields(failure.fields);
            setMessage(Object.keys(failure.fields).length > 0 ? null : failure.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{lead ? "Edit lead" : "Add lead"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    {!lead ? <p className="text-xs text-muted-foreground">New leads start in New. Change the stage after the lead is saved.</p> : null}
                    <Field label="Code" value={draft.code} error={fields.code} onChange={(code) => setDraft({ ...draft, code })} />
                    <Field label="Company" value={draft.company} error={fields.company} onChange={(company) => setDraft({ ...draft, company })} />
                    <Field label="Contact" value={draft.person} error={fields.person} onChange={(person) => setDraft({ ...draft, person })} />
                    <Field label="Value (₹)" value={String(draft.value)} error={fields.value} onChange={(value) => setDraft({ ...draft, value: Number(value) })} />
                    <Field label="Source" value={draft.source} error={fields.source} onChange={(next) => setDraft({ ...draft, source: next })} />
                    <label className="block text-xs text-muted-foreground">Priority
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as LeadPriority })}>
                            {LEAD_PRIORITIES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <Field label="Closing" type="date" value={draft.closing} error={fields.closing} onChange={(closing) => setDraft({ ...draft, closing })} />
                    <Field label="Probability" value={String(draft.probability)} error={fields.probability} onChange={(probability) => setDraft({ ...draft, probability: Number(probability) })} />
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, value, error, type = "text", onChange }: { label: string; value: string; error?: string; type?: string; onChange: (value: string) => void }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}
