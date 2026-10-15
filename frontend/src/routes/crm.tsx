import { createFileRoute } from "@tanstack/react-router";
import { Plus, Star } from "lucide-react";
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
import { apiFailure, CLIENT_STATUSES, crm, formatDay, type Client, type ClientDraft, type ClientStatus } from "@/lib/crm";

export const Route = createFileRoute("/crm")({
    head: () => ({
        meta: [
            { title: "CRM — DigiCyrus ERP" },
            { name: "description", content: "Client profiles, contacts, communication history, documents and follow-up schedules." },
            { property: "og:title", content: "CRM — DigiCyrus ERP" },
            { property: "og:description", content: "Manage every client relationship in one workspace." },
        ],
    }),
    component: CrmPage,
});

const emptyDraft = (): ClientDraft => ({
    code: "",
    name: "",
    contactName: "",
    industry: "",
    status: "Active",
    rating: 3,
    customerSince: "",
    email: "",
    phone: "",
});

function CrmPage() {
    const auth = useAuth();
    const canCreate = auth.user?.permissions.includes("clients:create") ?? false;
    const canUpdate = auth.user?.permissions.includes("clients:update") ?? false;
    const [items, setItems] = useState<Client[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<ClientStatus | "">("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<string | null>(null);
    const [editor, setEditor] = useState<Client | null | "new">(null);
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
        void crm.clients.list({ page, pageSize: 20, search: query || undefined, status: status || undefined })
            .then((result) => {
                if (!active) return;
                setItems(result.items);
                setTotal(result.total);
                setSelectedId((current) => current && result.items.some((item) => item.id === current) ? current : result.items[0]?.id ?? null);
                setMessage(null);
            })
            .catch((error: unknown) => {
                if (!active) return;
                const failure = apiFailure(error);
                if (failure.status === 401) void auth.refresh();
                setMessage(failure.message);
                setItems([]);
                setTotal(0);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [page, query, status, revision, auth.refresh]);

    useEffect(() => {
        if (!selectedId) {
            setSelected(null);
            return;
        }
        let active = true;
        void crm.clients.get(selectedId).then((client) => {
            if (active) setSelected(client);
        }).catch((error: unknown) => {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            if (active) setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [selectedId, auth.refresh]);

    const pageCount = Math.max(1, Math.ceil(total / 20));

    return (
        <AppShell>
            <PageHeader
                title="CRM"
                subtitle={loading ? "Loading clients…" : `${total} clients`}
                actions={canCreate ? (
                    <Button size="sm" onClick={() => setEditor("new")}>
                        <Plus className="h-4 w-4" /> New client
                    </Button>
                ) : null}
            />
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Clients" className="lg:col-span-2">
                    <div className="mb-4 flex gap-2">
                        <Input placeholder="Search clients, contacts, industries…" value={search} onChange={(event) => setSearch(event.target.value)} />
                        <select aria-label="Client status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as ClientStatus | ""); setPage(1); }}>
                            <option value="">All statuses</option>
                            {CLIENT_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </div>
                    {loading ? <p className="text-sm text-muted-foreground">Loading clients…</p> : null}
                    {!loading && items.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No clients</p> : null}
                    {items.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Industry</TableHead>
                                        <TableHead>Rating</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((client) => (
                                        <TableRow key={client.id} className="cursor-pointer" onClick={() => setSelectedId(client.id)}>
                                            <TableCell className="font-medium">{client.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{client.contactName}</TableCell>
                                            <TableCell className="text-muted-foreground">{client.industry}</TableCell>
                                            <TableCell>
                                                <span className="flex items-center gap-0.5">
                                                    {Array.from({ length: client.rating }).map((_, index) => (
                                                        <Star key={index} className="h-3 w-3 fill-warning text-warning" />
                                                    ))}
                                                </span>
                                            </TableCell>
                                            <TableCell><StatusPill status={client.status} /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : null}
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Page {page} of {pageCount}</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button>
                        </div>
                    </div>
                </Panel>
                <Panel
                    title={selected?.name ?? "Client"}
                    description={selected ? `Client since ${formatDay(selected.customerSince)} · ${selected.industry}` : "Select a client"}
                    actions={selected && canUpdate ? <Button size="sm" variant="outline" onClick={() => setEditor(selected)}>Edit</Button> : null}
                >
                    {selected ? (
                        <Tabs defaultValue="overview">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="timeline">Follow-ups</TabsTrigger>
                                <TabsTrigger value="docs">Docs</TabsTrigger>
                            </TabsList>
                            <TabsContent value="overview" className="space-y-3 pt-4 text-sm">
                                <Row label="Code" value={selected.code} />
                                <Row label="Primary contact" value={selected.contactName} />
                                <Row label="Email" value={selected.email ?? "—"} />
                                <Row label="Phone" value={selected.phone ?? "—"} />
                                <p className="text-xs text-muted-foreground">Lifetime value is not available.</p>
                            </TabsContent>
                            <TabsContent value="timeline" className="pt-4">
                                <FollowUpPanel clientId={selected.id} />
                            </TabsContent>
                            <TabsContent value="docs" className="pt-4 text-sm text-muted-foreground">
                                Documents are not available from the CRM API.
                            </TabsContent>
                        </Tabs>
                    ) : <p className="text-sm text-muted-foreground">No client selected</p>}
                </Panel>
            </div>
            <ClientDialog
                open={editor !== null}
                client={editor === "new" ? null : editor}
                onOpenChange={(open) => { if (!open) setEditor(null); }}
                onSaved={(client) => {
                    setEditor(null);
                    setSelectedId(client.id);
                    setSelected(client);
                    setPage(1);
                    setRevision((current) => current + 1);
                }}
            />
        </AppShell>
    );
}

function ClientDialog({ open, client, onOpenChange, onSaved }: { open: boolean; client: Client | null; onOpenChange: (open: boolean) => void; onSaved: (client: Client) => void }) {
    const auth = useAuth();
    const [draft, setDraft] = useState(emptyDraft());
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDraft(client ? {
            code: client.code,
            name: client.name,
            contactName: client.contactName,
            industry: client.industry,
            status: client.status,
            rating: client.rating,
            customerSince: client.customerSince,
            email: client.email ?? "",
            phone: client.phone ?? "",
        } : emptyDraft());
        setFields({});
        setMessage(null);
    }, [client, open]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        setFields({});
        const body: ClientDraft = {
            ...draft,
            code: draft.code.trim(),
            name: draft.name.trim(),
            contactName: draft.contactName.trim(),
            industry: draft.industry.trim(),
            rating: Number(draft.rating),
            email: draft.email?.trim() || undefined,
            phone: draft.phone?.trim() || undefined,
        };
        try {
            const saved = client
                ? await crm.clients.update(client.id, { ...body, email: body.email ?? null, phone: body.phone ?? null })
                : await crm.clients.create(body);
            onSaved(saved);
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
                <DialogHeader><DialogTitle>{client ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <TextField label="Code" value={draft.code} error={fields.code} onChange={(code) => setDraft({ ...draft, code })} />
                    <TextField label="Name" value={draft.name} error={fields.name} onChange={(name) => setDraft({ ...draft, name })} />
                    <TextField label="Contact" value={draft.contactName} error={fields.contactName} onChange={(contactName) => setDraft({ ...draft, contactName })} />
                    <TextField label="Industry" value={draft.industry} error={fields.industry} onChange={(industry) => setDraft({ ...draft, industry })} />
                    <label className="block text-xs text-muted-foreground">Status
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ClientStatus })}>
                            {CLIENT_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <TextField label="Rating" value={String(draft.rating)} error={fields.rating} onChange={(rating) => setDraft({ ...draft, rating: Number(rating) })} />
                    <TextField label="Customer since" type="date" value={draft.customerSince} error={fields.customerSince} onChange={(customerSince) => setDraft({ ...draft, customerSince })} />
                    <TextField label="Email" value={draft.email ?? ""} error={fields.email} onChange={(email) => setDraft({ ...draft, email })} />
                    <TextField label="Phone" value={draft.phone ?? ""} error={fields.phone} onChange={(phone) => setDraft({ ...draft, phone })} />
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function TextField({ label, value, error, type = "text", onChange }: { label: string; value: string; error?: string; type?: string; onChange: (value: string) => void }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={type !== "text" ? false : label !== "Email" && label !== "Phone"} />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="truncate font-medium">{value}</span>
        </div>
    );
}
