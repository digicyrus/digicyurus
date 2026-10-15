import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { ASSET_STATUSES, ASSET_TYPES, assetBody, assetsApi, canCreateAssets, canUpdateAssets, canViewAssets, type Asset, type AssetStatus, type AssetType } from "@/lib/assets";
import { apiFailure, formatDay } from "@/lib/crm";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/assets")({
    head: () => ({
        meta: [
            { title: "Asset Management — DigiCyrus ERP" },
            { name: "description", content: "Domains, hosting, certificates, licenses, and subscriptions." },
            { property: "og:title", content: "Asset Management — DigiCyrus ERP" },
            { property: "og:description", content: "Domains, hosting, certificates, licenses, and subscriptions." },
        ],
    }),
    component: AssetsPage,
});

const PAGE_SIZE = 20;

function AssetsPage() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = canViewAssets(permissions);
    const canCreate = canCreateAssets(permissions);
    const canUpdate = canUpdateAssets(permissions);
    const [items, setItems] = useState<Asset[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [type, setType] = useState<AssetType | "">("");
    const [status, setStatus] = useState<AssetStatus | "">("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [dueSoon, setDueSoon] = useState<Asset[]>([]);
    const [dueSoonTotal, setDueSoonTotal] = useState(0);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editor, setEditor] = useState<Asset | "new" | null>(null);
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
        if (from && to && from > to) {
            setMessage("End date must be on or after the start date");
            return;
        }
        let active = true;
        setLoading(true);
        void assetsApi.list({
            page,
            pageSize: PAGE_SIZE,
            search: query || undefined,
            type: type || undefined,
            status: status || undefined,
            from: from || undefined,
            to: to || undefined,
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
    }, [canView, page, query, type, status, from, to, revision, auth.refresh]);

    useEffect(() => {
        if (!canView) {
            setDueSoon([]);
            setDueSoonTotal(0);
            return;
        }
        let active = true;
        void assetsApi.list({ page: 1, pageSize: 20, status: "Due Soon" }).then((result) => {
            if (!active) return;
            setDueSoon(result.items);
            setDueSoonTotal(result.total);
        }).catch(() => {
            if (!active) return;
            setDueSoon([]);
            setDueSoonTotal(0);
        });
        return () => {
            active = false;
        };
    }, [canView, revision]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <AppShell>
            <PageHeader
                title="Assets"
                subtitle={canView ? (loading ? "Loading assets…" : `${total} assets`) : "Assets are not available for this role"}
                actions={canCreate ? <Button size="sm" onClick={() => setEditor("new")}><Plus className="h-4 w-4" /> New asset</Button> : null}
            />
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            {!canView ? <p className="text-sm text-muted-foreground">You do not have access to assets.</p> : null}
            {canView && dueSoonTotal > 0 ? (
                <div className="surface flex items-start gap-3 border-warning/40 bg-warning/10 p-4">
                    <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium">{dueSoonTotal} marked Due Soon</p>
                        <p className="text-xs text-muted-foreground">{dueSoon.map((asset) => asset.name).join(", ")}</p>
                    </div>
                </div>
            ) : null}
            <Panel title="All assets">
                {canView ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                        <Input className="max-w-xs" placeholder="Search assets…" value={search} onChange={(event) => setSearch(event.target.value)} />
                        <select aria-label="Asset type" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={type} onChange={(event) => { setType(event.target.value as AssetType | ""); setPage(1); }}>
                            <option value="">All types</option>
                            {ASSET_TYPES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                        <select aria-label="Asset status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as AssetStatus | ""); setPage(1); }}>
                            <option value="">All statuses</option>
                            {ASSET_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                        <Input aria-label="Renewal from" type="date" className="w-40" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
                        <Input aria-label="Renewal to" type="date" className="w-40" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
                    </div>
                ) : null}
                {canView && !loading && items.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No assets</p> : null}
                {items.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Asset</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Renewal</TableHead>
                                    <TableHead>Cost</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((asset) => (
                                    <TableRow key={asset.id} className="cursor-pointer" onClick={() => setSelectedId(asset.id)}>
                                        <TableCell className="font-medium">{asset.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{asset.type}</TableCell>
                                        <TableCell className="text-muted-foreground">{asset.vendor}</TableCell>
                                        <TableCell className="text-muted-foreground">{formatDay(asset.renewal)}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(asset.cost)}</TableCell>
                                        <TableCell><StatusPill status={asset.status} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
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
            </Panel>
            <AssetDetail id={selectedId} canEdit={canUpdate} revision={revision} onOpenChange={(open) => { if (!open) setSelectedId(null); }} onEdit={(asset) => { setSelectedId(null); setEditor(asset); }} />
            <AssetDialog open={editor !== null} asset={editor === "new" ? null : editor} onOpenChange={(open) => { if (!open) setEditor(null); }} onSaved={() => { setEditor(null); setRevision((current) => current + 1); }} />
        </AppShell>
    );
}

function AssetDetail({ id, canEdit, revision, onOpenChange, onEdit }: { id: string | null; canEdit: boolean; revision: number; onOpenChange: (open: boolean) => void; onEdit: (asset: Asset) => void }) {
    const auth = useAuth();
    const [asset, setAsset] = useState<Asset | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    useEffect(() => {
        if (!id) {
            setAsset(null);
            return;
        }
        let active = true;
        setMessage(null);
        void assetsApi.get(id).then((result) => {
            if (active) setAsset(result);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setAsset(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [id, revision, auth.refresh]);
    return (
        <Dialog open={id !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{asset?.name ?? "Asset"}</DialogTitle></DialogHeader>
                {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                {!asset && !message ? <p className="text-sm text-muted-foreground">Loading asset…</p> : null}
                {asset ? (
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between"><span>{asset.type} · {asset.vendor}</span><StatusPill status={asset.status} /></div>
                        <p>Renewal {formatDay(asset.renewal)}</p>
                        <p>{inr(asset.cost)}</p>
                        {canEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(asset)}>Edit</Button> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function AssetDialog({ open, asset, onOpenChange, onSaved }: { open: boolean; asset: Asset | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const [name, setName] = useState("");
    const [type, setType] = useState<AssetType>("Domain");
    const [vendor, setVendor] = useState("");
    const [renewal, setRenewal] = useState("");
    const [cost, setCost] = useState("");
    const [status, setStatus] = useState<AssetStatus>("Active");
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setName(asset?.name ?? "");
        setType(asset?.type ?? "Domain");
        setVendor(asset?.vendor ?? "");
        setRenewal(asset?.renewal ?? "");
        setCost(asset ? String(asset.cost) : "");
        setStatus(asset?.status ?? "Active");
        setFields({});
        setMessage(null);
    }, [asset, open]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        const checked = assetBody({ name, type, vendor, renewal, cost, status });
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            if (asset) await assetsApi.update(asset.id, checked.body);
            else await assetsApi.create(checked.body);
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
                <DialogHeader><DialogTitle>{asset ? "Edit asset" : "New asset"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <Field label="Name" value={name} error={fields.name} onChange={setName} />
                    <label className="block text-xs text-muted-foreground">Type
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={type} onChange={(event) => setType(event.target.value as AssetType)}>
                            {ASSET_TYPES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <Field label="Vendor" value={vendor} error={fields.vendor} onChange={setVendor} />
                    <Field label="Renewal" type="date" value={renewal} error={fields.renewal} onChange={setRenewal} />
                    <Field label="Cost (₹)" value={cost} error={fields.cost} onChange={setCost} />
                    <label className="block text-xs text-muted-foreground">Status
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={status} onChange={(event) => setStatus(event.target.value as AssetStatus)}>
                            {ASSET_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
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
            <Input className="mt-1" type={type} value={value} required onChange={(event) => onChange(event.target.value)} />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}
