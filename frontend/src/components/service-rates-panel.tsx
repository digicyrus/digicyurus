import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { apiFailure } from "@/lib/crm";
import { canUpdateServiceRates, canViewServiceRates, growth, serviceRateBody, type ServiceRate } from "@/lib/growth";
import { inr } from "@/lib/mock-data";

const PAGE_SIZE = 20;

export function ServiceRatesPanel() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = canViewServiceRates(permissions);
    const canUpdate = canUpdateServiceRates(permissions);
    const [items, setItems] = useState<ServiceRate[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [active, setActive] = useState<"" | "true" | "false">("");
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editor, setEditor] = useState<ServiceRate | "new" | null>(null);
    const [revision, setRevision] = useState(0);

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
            return;
        }
        let activeRequest = true;
        setLoading(true);
        void growth.serviceRates.list({
            page,
            pageSize: PAGE_SIZE,
            search: query || undefined,
            active: active || undefined,
        }).then((result) => {
            if (!activeRequest) return;
            setItems(result.items);
            setTotal(result.total);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!activeRequest) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setItems([]);
            setTotal(0);
        }).finally(() => {
            if (activeRequest) setLoading(false);
        });
        return () => {
            activeRequest = false;
        };
    }, [canView, page, query, active, revision, auth.refresh]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <Panel
            title="Services & pricing"
            description={canView ? `${total} service rates` : "Service rates are not available for this role"}
            actions={canUpdate ? <Button size="sm" onClick={() => setEditor("new")}><Plus className="h-4 w-4" /> New rate</Button> : null}
        >
            {message ? <p role="alert" className="mb-3 text-sm text-destructive">{message}</p> : null}
            {canView ? (
                <div className="mb-3 flex flex-wrap gap-2">
                    <Input className="max-w-xs" placeholder="Search rates…" value={search} onChange={(event) => setSearch(event.target.value)} />
                    <select aria-label="Active" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={active} onChange={(event) => { setActive(event.target.value as "" | "true" | "false"); setPage(1); }}>
                        <option value="">All rates</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                </div>
            ) : <p className="text-sm text-muted-foreground">You do not have access to service rates.</p>}
            {loading && canView ? <p className="text-sm text-muted-foreground">Loading service rates…</p> : null}
            {canView && !loading && items.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No service rates</p> : null}
            {items.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Service</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Active</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((rate) => (
                            <TableRow key={rate.id} className="cursor-pointer" onClick={() => setSelectedId(rate.id)}>
                                <TableCell className="font-medium">{rate.name}</TableCell>
                                <TableCell className="text-muted-foreground">{rate.unit}</TableCell>
                                <TableCell className="font-mono text-xs">{inr(rate.rate)}</TableCell>
                                <TableCell className="text-muted-foreground">{rate.active ? "Active" : "Inactive"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : null}
            {canView ? (
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Page {page} of {pages}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</Button>
                    </div>
                </div>
            ) : null}
            <RateDetail id={selectedId} canEdit={canUpdate} revision={revision} onOpenChange={(open) => { if (!open) setSelectedId(null); }} onEdit={(rate) => { setSelectedId(null); setEditor(rate); }} />
            <RateDialog open={editor !== null} rate={editor === "new" ? null : editor} onOpenChange={(open) => { if (!open) setEditor(null); }} onSaved={() => { setEditor(null); setRevision((current) => current + 1); }} />
        </Panel>
    );
}

function RateDetail({ id, canEdit, revision, onOpenChange, onEdit }: { id: string | null; canEdit: boolean; revision: number; onOpenChange: (open: boolean) => void; onEdit: (rate: ServiceRate) => void }) {
    const auth = useAuth();
    const [rate, setRate] = useState<ServiceRate | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    useEffect(() => {
        if (!id) {
            setRate(null);
            return;
        }
        let active = true;
        setMessage(null);
        void growth.serviceRates.get(id).then((result) => {
            if (active) setRate(result);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setRate(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [id, revision, auth.refresh]);
    return (
        <Dialog open={id !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{rate?.name ?? "Service rate"}</DialogTitle></DialogHeader>
                {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                {!rate && !message ? <p className="text-sm text-muted-foreground">Loading service rate…</p> : null}
                {rate ? (
                    <div className="space-y-2 text-sm">
                        <p>{rate.unit} · {inr(rate.rate)}</p>
                        <p>{rate.active ? "Active" : "Inactive"}</p>
                        <p className="text-muted-foreground">{rate.description || "No description"}</p>
                        {canEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(rate)}>Edit</Button> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function RateDialog({ open, rate, onOpenChange, onSaved }: { open: boolean; rate: ServiceRate | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [unit, setUnit] = useState("");
    const [amount, setAmount] = useState("");
    const [active, setActive] = useState(true);
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setName(rate?.name ?? "");
        setDescription(rate?.description ?? "");
        setUnit(rate?.unit ?? "");
        setAmount(rate ? String(rate.rate) : "");
        setActive(rate?.active ?? true);
        setFields({});
        setMessage(null);
    }, [rate, open]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        const checked = serviceRateBody({ name, description, unit, rate: amount, active });
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            if (rate) await growth.serviceRates.update(rate.id, checked.body);
            else await growth.serviceRates.create(checked.body);
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
                <DialogHeader><DialogTitle>{rate ? "Edit service rate" : "New service rate"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <Field label="Name" value={name} error={fields.name} onChange={setName} />
                    <Field label="Description" value={description} error={fields.description} onChange={setDescription} required={false} />
                    <Field label="Unit" value={unit} error={fields.unit} onChange={setUnit} />
                    <Field label="Rate (₹)" value={amount} error={fields.rate} onChange={setAmount} />
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
                        Active
                    </label>
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, value, error, required = true, onChange }: { label: string; value: string; error?: string; required?: boolean; onChange: (value: string) => void }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input className="mt-1" value={value} required={required} onChange={(event) => onChange(event.target.value)} />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}
