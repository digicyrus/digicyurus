import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { apiFailure, formatDay } from "@/lib/crm";
import {
    CAMPAIGN_STATUSES,
    campaignBody,
    canManageCampaigns,
    canManageContent,
    CONTENT_STATUSES,
    contentBody,
    formatRoi,
    growth,
    type Campaign,
    type CampaignStatus,
    type ContentItem,
    type ContentStatus,
} from "@/lib/growth";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/marketing")({
    head: () => ({
        meta: [
            { title: "Marketing — DigiCyrus ERP" },
            { name: "description", content: "Campaigns and the content calendar." },
            { property: "og:title", content: "Marketing — DigiCyrus ERP" },
            { property: "og:description", content: "Campaigns and the content calendar." },
        ],
    }),
    component: MarketingPage,
});

const PAGE_SIZE = 20;

function MarketingPage() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canCampaigns = canManageCampaigns(permissions);
    const canContent = canManageContent(permissions);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [campaignTotal, setCampaignTotal] = useState(0);
    const [campaignPage, setCampaignPage] = useState(1);
    const [campaignSearch, setCampaignSearch] = useState("");
    const [campaignQuery, setCampaignQuery] = useState("");
    const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | "">("");
    const [campaignChannel, setCampaignChannel] = useState("");
    const [content, setContent] = useState<ContentItem[]>([]);
    const [contentTotal, setContentTotal] = useState(0);
    const [contentPage, setContentPage] = useState(1);
    const [contentSearch, setContentSearch] = useState("");
    const [contentQuery, setContentQuery] = useState("");
    const [contentStatus, setContentStatus] = useState<ContentStatus | "">("");
    const [contentChannel, setContentChannel] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [campaignEditor, setCampaignEditor] = useState<Campaign | "new" | null>(null);
    const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
    const [contentEditor, setContentEditor] = useState<ContentItem | "new" | null>(null);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setCampaignPage(1);
            setCampaignQuery(campaignSearch.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [campaignSearch]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setContentPage(1);
            setContentQuery(contentSearch.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [contentSearch]);

    useEffect(() => {
        if (!canCampaigns) {
            setCampaigns([]);
            setCampaignTotal(0);
            return;
        }
        let active = true;
        setLoading(true);
        void growth.campaigns.list({
            page: campaignPage,
            pageSize: PAGE_SIZE,
            search: campaignQuery || undefined,
            status: campaignStatus || undefined,
            channel: campaignChannel.trim() || undefined,
        }).then((result) => {
            if (!active) return;
            setCampaigns(result.items);
            setCampaignTotal(result.total);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setCampaigns([]);
            setCampaignTotal(0);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [canCampaigns, campaignPage, campaignQuery, campaignStatus, campaignChannel, revision, auth.refresh]);

    useEffect(() => {
        if (!canContent) {
            setContent([]);
            setContentTotal(0);
            return;
        }
        let active = true;
        void growth.content.list({
            page: contentPage,
            pageSize: PAGE_SIZE,
            search: contentQuery || undefined,
            status: contentStatus || undefined,
            channel: contentChannel.trim() || undefined,
            from: from || undefined,
            to: to || undefined,
        }).then((result) => {
            if (!active) return;
            setContent(result.items);
            setContentTotal(result.total);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setContent([]);
            setContentTotal(0);
        });
        return () => {
            active = false;
        };
    }, [canContent, contentPage, contentQuery, contentStatus, contentChannel, from, to, revision, auth.refresh]);

    const campaignPages = Math.max(1, Math.ceil(campaignTotal / PAGE_SIZE));
    const contentPages = Math.max(1, Math.ceil(contentTotal / PAGE_SIZE));

    return (
        <AppShell>
            <PageHeader
                title="Marketing"
                subtitle={canCampaigns ? (loading ? "Loading campaigns…" : `${campaignTotal} campaigns`) : "Campaigns are not available for this role"}
                actions={canCampaigns ? <Button size="sm" onClick={() => setCampaignEditor("new")}><Plus className="h-4 w-4" /> New campaign</Button> : null}
            />
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            <p className="text-xs text-muted-foreground">Website traffic and SEO rankings are not available. ROI is the stored value.</p>

            <Panel title="Campaigns" description={canCampaigns ? "Spend, leads, and stored ROI" : "Campaign access is not available for this role"}>
                {canCampaigns ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                        <Input className="max-w-xs" placeholder="Search campaigns…" value={campaignSearch} onChange={(event) => setCampaignSearch(event.target.value)} />
                        <select aria-label="Campaign status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={campaignStatus} onChange={(event) => { setCampaignStatus(event.target.value as CampaignStatus | ""); setCampaignPage(1); }}>
                            <option value="">All statuses</option>
                            {CAMPAIGN_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                        <Input aria-label="Campaign channel" className="max-w-[10rem]" placeholder="Channel" value={campaignChannel} onChange={(event) => { setCampaignChannel(event.target.value); setCampaignPage(1); }} />
                    </div>
                ) : null}
                {loading && canCampaigns ? <p className="text-sm text-muted-foreground">Loading campaigns…</p> : null}
                {canCampaigns && !loading && campaigns.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No campaigns</p> : null}
                {campaigns.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaign</TableHead>
                                    <TableHead>Channel</TableHead>
                                    <TableHead>Spend</TableHead>
                                    <TableHead>Leads</TableHead>
                                    <TableHead>ROI</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campaigns.map((campaign) => (
                                    <TableRow key={campaign.id} className="cursor-pointer" onClick={() => setSelectedCampaignId(campaign.id)}>
                                        <TableCell className="font-medium">{campaign.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{campaign.channel}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(campaign.spend)}</TableCell>
                                        <TableCell>{campaign.leads}</TableCell>
                                        <TableCell>{formatRoi(campaign.roi)}</TableCell>
                                        <TableCell><StatusPill status={campaign.status} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : null}
                {canCampaigns ? <Pager page={campaignPage} pages={campaignPages} onPage={setCampaignPage} /> : null}
            </Panel>

            <Panel
                title="Content calendar"
                description={canContent ? `${contentTotal} items` : "Content access is not available for this role"}
                actions={canContent ? <Button size="sm" variant="outline" onClick={() => setContentEditor("new")}><Plus className="h-4 w-4" /> New item</Button> : null}
            >
                {canContent ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                        <Input className="max-w-xs" placeholder="Search content…" value={contentSearch} onChange={(event) => setContentSearch(event.target.value)} />
                        <select aria-label="Content status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={contentStatus} onChange={(event) => { setContentStatus(event.target.value as ContentStatus | ""); setContentPage(1); }}>
                            <option value="">All statuses</option>
                            {CONTENT_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                        <Input aria-label="Content channel" className="max-w-[10rem]" placeholder="Channel" value={contentChannel} onChange={(event) => { setContentChannel(event.target.value); setContentPage(1); }} />
                        <Input aria-label="From" type="date" className="w-40" value={from} onChange={(event) => { setFrom(event.target.value); setContentPage(1); }} />
                        <Input aria-label="To" type="date" className="w-40" value={to} onChange={(event) => { setTo(event.target.value); setContentPage(1); }} />
                    </div>
                ) : null}
                {canContent && content.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No content</p> : null}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {content.map((item) => (
                        <button key={item.id} type="button" className="surface lift p-4 text-left" onClick={() => setSelectedContentId(item.id)}>
                            <p className="font-mono text-xs text-muted-foreground">{formatDay(item.date)}</p>
                            <p className="mt-2 text-sm font-medium leading-snug">{item.title}</p>
                            <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{item.channel}</span>
                                <StatusPill status={item.status} />
                            </div>
                        </button>
                    ))}
                </div>
                {canContent ? <Pager page={contentPage} pages={contentPages} onPage={setContentPage} /> : null}
            </Panel>

            <CampaignDetail id={selectedCampaignId} canEdit={canCampaigns} revision={revision} onOpenChange={(open) => { if (!open) setSelectedCampaignId(null); }} onEdit={(campaign) => { setSelectedCampaignId(null); setCampaignEditor(campaign); }} />
            <CampaignDialog open={campaignEditor !== null} campaign={campaignEditor === "new" ? null : campaignEditor} onOpenChange={(open) => { if (!open) setCampaignEditor(null); }} onSaved={() => { setCampaignEditor(null); setRevision((current) => current + 1); }} />
            <ContentDetail id={selectedContentId} canEdit={canContent} revision={revision} onOpenChange={(open) => { if (!open) setSelectedContentId(null); }} onEdit={(item) => { setSelectedContentId(null); setContentEditor(item); }} />
            <ContentDialog open={contentEditor !== null} item={contentEditor === "new" ? null : contentEditor} onOpenChange={(open) => { if (!open) setContentEditor(null); }} onSaved={() => { setContentEditor(null); setRevision((current) => current + 1); }} />
        </AppShell>
    );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (value: number | ((current: number) => number)) => void }) {
    return (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage((current) => current - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage((current) => current + 1)}>Next</Button>
            </div>
        </div>
    );
}

function CampaignDetail({ id, canEdit, revision, onOpenChange, onEdit }: { id: string | null; canEdit: boolean; revision: number; onOpenChange: (open: boolean) => void; onEdit: (campaign: Campaign) => void }) {
    const auth = useAuth();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    useEffect(() => {
        if (!id) {
            setCampaign(null);
            return;
        }
        let active = true;
        setMessage(null);
        void growth.campaigns.get(id).then((result) => {
            if (active) setCampaign(result);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setCampaign(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [id, revision, auth.refresh]);
    return (
        <Dialog open={id !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{campaign?.name ?? "Campaign"}</DialogTitle></DialogHeader>
                {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                {!campaign && !message ? <p className="text-sm text-muted-foreground">Loading campaign…</p> : null}
                {campaign ? (
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between"><span>{campaign.channel}</span><StatusPill status={campaign.status} /></div>
                        <p>Spend {inr(campaign.spend)}</p>
                        <p>Leads {campaign.leads}</p>
                        <p>Stored ROI {formatRoi(campaign.roi)}</p>
                        {canEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(campaign)}>Edit</Button> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function CampaignDialog({ open, campaign, onOpenChange, onSaved }: { open: boolean; campaign: Campaign | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const [name, setName] = useState("");
    const [channel, setChannel] = useState("");
    const [spend, setSpend] = useState("");
    const [leads, setLeads] = useState("");
    const [roi, setRoi] = useState("");
    const [status, setStatus] = useState<CampaignStatus>("Running");
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setName(campaign?.name ?? "");
        setChannel(campaign?.channel ?? "");
        setSpend(campaign ? String(campaign.spend) : "");
        setLeads(campaign ? String(campaign.leads) : "");
        setRoi(campaign ? formatRoi(campaign.roi) : "");
        setStatus(campaign?.status ?? "Running");
        setFields({});
        setMessage(null);
    }, [campaign, open]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        const checked = campaignBody({ name, channel, spend, leads, roi, status });
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            if (campaign) await growth.campaigns.update(campaign.id, checked.body);
            else await growth.campaigns.create(checked.body);
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
                <DialogHeader><DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <Field label="Name" value={name} error={fields.name} onChange={setName} />
                    <Field label="Channel" value={channel} error={fields.channel} onChange={setChannel} />
                    <Field label="Spend (₹)" value={spend} error={fields.spend} onChange={setSpend} />
                    <Field label="Leads" value={leads} error={fields.leads} onChange={setLeads} />
                    <Field label="Stored ROI" value={roi} error={fields.roi} onChange={setRoi} />
                    <label className="block text-xs text-muted-foreground">Status
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={status} onChange={(event) => setStatus(event.target.value as CampaignStatus)}>
                            {CAMPAIGN_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ContentDetail({ id, canEdit, revision, onOpenChange, onEdit }: { id: string | null; canEdit: boolean; revision: number; onOpenChange: (open: boolean) => void; onEdit: (item: ContentItem) => void }) {
    const auth = useAuth();
    const [item, setItem] = useState<ContentItem | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    useEffect(() => {
        if (!id) {
            setItem(null);
            return;
        }
        let active = true;
        setMessage(null);
        void growth.content.get(id).then((result) => {
            if (active) setItem(result);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setItem(null);
            setMessage(failure.message);
        });
        return () => {
            active = false;
        };
    }, [id, revision, auth.refresh]);
    return (
        <Dialog open={id !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{item?.title ?? "Content"}</DialogTitle></DialogHeader>
                {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                {!item && !message ? <p className="text-sm text-muted-foreground">Loading content…</p> : null}
                {item ? (
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between"><span>{item.channel} · {formatDay(item.date)}</span><StatusPill status={item.status} /></div>
                        {canEdit ? <Button size="sm" variant="outline" onClick={() => onEdit(item)}>Edit</Button> : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function ContentDialog({ open, item, onOpenChange, onSaved }: { open: boolean; item: ContentItem | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const [title, setTitle] = useState("");
    const [channel, setChannel] = useState("");
    const [date, setDate] = useState("");
    const [status, setStatus] = useState<ContentStatus>("Draft");
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setTitle(item?.title ?? "");
        setChannel(item?.channel ?? "");
        setDate(item?.date ?? "");
        setStatus(item?.status ?? "Draft");
        setFields({});
        setMessage(null);
    }, [item, open]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        const checked = contentBody({ title, channel, date, status });
        if (!checked.ok) {
            setFields(checked.fields);
            setMessage(checked.message);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            if (item) await growth.content.update(item.id, checked.body);
            else await growth.content.create(checked.body);
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
                <DialogHeader><DialogTitle>{item ? "Edit content" : "New content"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <Field label="Title" value={title} error={fields.title} onChange={setTitle} />
                    <Field label="Channel" value={channel} error={fields.channel} onChange={setChannel} />
                    <Field label="Date" type="date" value={date} error={fields.date} onChange={setDate} />
                    <label className="block text-xs text-muted-foreground">Status
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={status} onChange={(event) => setStatus(event.target.value as ContentStatus)}>
                            {CONTENT_STATUSES.map((option) => <option key={option}>{option}</option>)}
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
