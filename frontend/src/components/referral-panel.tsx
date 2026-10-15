import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Panel, StatusPill } from "@/components/page-kit";
import { RelationPicker, useResolvedLabels } from "@/components/relation-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { apiFailure } from "@/lib/crm";
import { canCreateReferrals, canUpdateReferrals, canViewReferrals, growth, REFERRAL_STATUSES, referralBody, type Referral, type ReferralStatus } from "@/lib/growth";
import { canBrowseClients, linkedLabel, loadClientOptions, lookupClientName } from "@/lib/relations";
import { inr } from "@/lib/mock-data";

const PAGE_SIZE = 20;

export function ReferralPanel() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = canViewReferrals(permissions);
    const canCreate = canCreateReferrals(permissions);
    const canUpdate = canUpdateReferrals(permissions);
    const canViewClients = canBrowseClients(permissions);
    const [items, setItems] = useState<Referral[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<ReferralStatus | "">("");
    const [clientId, setClientId] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editor, setEditor] = useState<Referral | "new" | null>(null);
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
        let active = true;
        void growth.referrals.list({
            page,
            pageSize: PAGE_SIZE,
            search: query || undefined,
            status: status || undefined,
            clientId: clientId || undefined,
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
        });
        return () => {
            active = false;
        };
    }, [canView, page, query, status, clientId, revision, auth.refresh]);

    const clientLabels = useResolvedLabels(items.map((referral) => referral.clientId), canViewClients, lookupClientName);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <Panel
            title="Referral partners"
            description={canView ? `${total} referrals` : "Referral access is not available for this role"}
            actions={canCreate ? <Button size="sm" variant="outline" onClick={() => setEditor("new")}><Plus className="h-4 w-4" /> New referral</Button> : null}
        >
            {message ? <p role="alert" className="mb-3 text-sm text-destructive">{message}</p> : null}
            {canView ? (
                <div className="mb-3 flex flex-wrap gap-2">
                    <Input className="max-w-xs" placeholder="Search referrals…" value={search} onChange={(event) => setSearch(event.target.value)} />
                    <select aria-label="Referral status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as ReferralStatus | ""); setPage(1); }}>
                        <option value="">All statuses</option>
                        {REFERRAL_STATUSES.map((option) => <option key={option}>{option}</option>)}
                    </select>
                    <div className="min-w-56">
                        <RelationPicker label="Client" value={clientId} emptyLabel="All clients" enabled={canViewClients} selectedLabel={clientLabels[clientId]} load={loadClientOptions} onChange={(id) => { setClientId(id); setPage(1); }} unavailable="Client filter needs client access." />
                    </div>
                </div>
            ) : <p className="text-sm text-muted-foreground">You do not have access to referrals.</p>}
            {canView && items.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No referrals</p> : null}
            <div className="divide-y">
                {items.map((referral) => (
                    <button key={referral.id} type="button" className="flex w-full items-center gap-3 py-3 text-left" onClick={() => setSelectedId(referral.id)}>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{referral.partner}</p>
                            <p className="text-xs text-muted-foreground">{referral.deals} deals · {inr(referral.revenue)} revenue · {linkedLabel(referral.clientId, clientLabels, "No client", "Client name unavailable")}</p>
                        </div>
                        <span className="font-mono text-sm">{inr(referral.commission)}</span>
                        <StatusPill status={referral.status} />
                    </button>
                ))}
            </div>
            {canView ? (
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Page {page} of {pages}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</Button>
                    </div>
                </div>
            ) : null}
            <ReferralDetail id={selectedId} labels={clientLabels} canEdit={canUpdate} revision={revision} onOpenChange={(open) => { if (!open) setSelectedId(null); }} onEdit={(referral) => { setSelectedId(null); setEditor(referral); }} />
            <ReferralDialog open={editor !== null} referral={editor === "new" ? null : editor} canClients={canViewClients} onOpenChange={(open) => { if (!open) setEditor(null); }} onSaved={() => { setEditor(null); setRevision((current) => current + 1); }} />
        </Panel>
    );
}

function ReferralDetail({ id, labels, canEdit, revision, onOpenChange, onEdit }: { id: string | null; labels: Record<string, string | null>; canEdit: boolean; revision: number; onOpenChange: (open: boolean) => void; onEdit: (referral: Referral) => void }) {
    const auth = useAuth();
    const [referral, setReferral] = useState<Referral | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    useEffect(() => {
        if (!id) {
            setReferral(null);
            return;
        }
        let active = true;
        setMessage(null);
        void growth.referrals.get(id).then((result) => {
            if (active) setReferral(result);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setReferral(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [id, revision, auth.refresh]);
    return (
        <Dialog open={id !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{referral?.partner ?? "Referral"}</DialogTitle></DialogHeader>
                {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                {!referral && !message ? <p className="text-sm text-muted-foreground">Loading referral…</p> : null}
                {referral ? (
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between"><span>{referral.code}</span><StatusPill status={referral.status} /></div>
                        <p>{linkedLabel(referral.clientId, labels, "No client", "Client name unavailable")}</p>
                        <p>{referral.deals} deals · Revenue {inr(referral.revenue)}</p>
                        <p>Stored commission {inr(referral.commission)}</p>
                        {canEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(referral)}>Edit</Button> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function ReferralDialog({ open, referral, canClients, onOpenChange, onSaved }: { open: boolean; referral: Referral | null; canClients: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const [code, setCode] = useState("");
    const [partner, setPartner] = useState("");
    const [clientId, setClientId] = useState("");
    const [deals, setDeals] = useState("");
    const [revenue, setRevenue] = useState("");
    const [commission, setCommission] = useState("");
    const [status, setStatus] = useState<ReferralStatus>("Pending");
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setCode(referral?.code ?? "");
        setPartner(referral?.partner ?? "");
        setClientId(referral?.clientId ?? "");
        setDeals(referral ? String(referral.deals) : "");
        setRevenue(referral ? String(referral.revenue) : "");
        setCommission(referral ? String(referral.commission) : "");
        setStatus(referral?.status ?? "Pending");
        setFields({});
        setMessage(null);
    }, [referral, open]);
    const clientLabels = useResolvedLabels([clientId], canClients, lookupClientName);
    async function submit(event: FormEvent) {
        event.preventDefault();
        const checked = referralBody({ code, partner, clientId, deals, revenue, commission, status });
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            if (referral) await growth.referrals.update(referral.id, checked.body);
            else await growth.referrals.create(checked.body);
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
                <DialogHeader><DialogTitle>{referral ? "Edit referral" : "New referral"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <Field label="Code" value={code} error={fields.code} onChange={setCode} />
                    <Field label="Partner" value={partner} error={fields.partner} onChange={setPartner} />
                    <RelationPicker label="Client" value={clientId} emptyLabel="No client" enabled={canClients} selectedLabel={clientLabels[clientId]} load={loadClientOptions} onChange={setClientId} unavailable="Choosing a client needs client access." />
                    {fields.clientId ? <p className="text-xs text-destructive">{fields.clientId}</p> : null}
                    <Field label="Deals" value={deals} error={fields.deals} onChange={setDeals} />
                    <Field label="Revenue (₹)" value={revenue} error={fields.revenue} onChange={setRevenue} />
                    <Field label="Commission (₹)" value={commission} error={fields.commission} onChange={setCommission} />
                    <label className="block text-xs text-muted-foreground">Status
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={status} onChange={(event) => setStatus(event.target.value as ReferralStatus)}>
                            {REFERRAL_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (value: string) => void }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input className="mt-1" value={value} required onChange={(event) => onChange(event.target.value)} />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}
