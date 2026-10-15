import { useEffect, useState, type FormEvent } from "react";

import { RelationPicker, useResolvedLabels } from "@/components/relation-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/page-kit";
import { useAuth } from "@/lib/auth";
import { crm, FOLLOW_UP_STATUSES, formatDateTime, apiFailure, type FollowUp, type FollowUpStatus } from "@/lib/crm";
import { canBrowseEmployees, hasMore, linkedLabel, loadEmployeeOptions, lookupEmployeeName, RELATION_PAGE_SIZE, requireRelation } from "@/lib/relations";

export function FollowUpPanel({ clientId, leadId }: { clientId?: string; leadId?: string }) {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const canView = permissions.includes("follow_ups:view");
    const canCreate = permissions.includes("follow_ups:create");
    const canUpdate = permissions.includes("follow_ups:update");
    const canEmployees = canBrowseEmployees(permissions);
    const [items, setItems] = useState<FollowUp[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [dueAt, setDueAt] = useState("");
    const [status, setStatus] = useState<FollowUpStatus>("Upcoming");
    const [ownerEmployeeId, setOwnerEmployeeId] = useState("");
    const [saving, setSaving] = useState(false);
    const ownerLabels = useResolvedLabels(items.map((item) => item.ownerEmployeeId).concat(ownerEmployeeId), canEmployees, lookupEmployeeName);

    async function load(nextPage: number, append: boolean) {
        if (!canView) {
            setMessage("You do not have access to follow-ups.");
            setItems([]);
            setTotal(0);
            return;
        }
        setLoading(true);
        try {
            const result = await crm.followUps.list({ page: nextPage, pageSize: RELATION_PAGE_SIZE, clientId, leadId });
            setItems((current) => append ? mergeFollowUps(current, result.items) : result.items);
            setPage(result.page);
            setTotal(result.total);
            setMessage(null);
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load(1, false);
    }, [canView, clientId, leadId]);

    async function changeStatus(item: FollowUp, next: FollowUpStatus) {
        try {
            const updated = await crm.followUps.update(item.id, { status: next });
            setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
            setMessage(null);
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
        }
    }

    async function create(event: FormEvent) {
        event.preventDefault();
        if (!clientId && !leadId) return;
        const missingOwner = requireRelation(ownerEmployeeId, "employee");
        if (missingOwner) {
            setMessage(missingOwner);
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            await crm.followUps.create({
                clientId,
                leadId,
                ownerEmployeeId,
                dueAt: new Date(dueAt).toISOString(),
                status,
            });
            setDueAt("");
            setOwnerEmployeeId("");
            setStatus("Upcoming");
            await load(1, false);
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.fields.clientId ?? failure.fields.ownerEmployeeId ?? failure.message);
        } finally {
            setSaving(false);
        }
    }

    const more = hasMore(page, RELATION_PAGE_SIZE, total);

    return (
        <div className="space-y-3">
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            {loading ? <p className="text-sm text-muted-foreground">Loading follow-ups…</p> : null}
            {!loading && items.length === 0 && canView ? <p className="text-sm text-muted-foreground">No follow-ups</p> : null}
            <ul className="divide-y">
                {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{formatDateTime(item.dueAt)}</p>
                            <p className="truncate text-xs text-muted-foreground">Owner {linkedLabel(item.ownerEmployeeId, ownerLabels, "Owner name unavailable", "Owner name unavailable")}</p>
                        </div>
                        {canUpdate ? (
                            <select
                                aria-label="Follow-up status"
                                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                                value={item.status}
                                onChange={(event) => void changeStatus(item, event.target.value as FollowUpStatus)}
                            >
                                {FOLLOW_UP_STATUSES.map((option) => <option key={option}>{option}</option>)}
                            </select>
                        ) : <StatusPill status={item.status} />}
                    </li>
                ))}
            </ul>
            {canView && more ? (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Showing {items.length} of {total}</span>
                    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load(page + 1, true)}>Load more</Button>
                </div>
            ) : null}
            {canCreate && (clientId || leadId) ? (
                canEmployees ? (
                    <form className="space-y-2 border-t pt-3" onSubmit={(event) => void create(event)}>
                        <div>
                            <Label className="text-xs text-muted-foreground" htmlFor={`due-${clientId ?? leadId}`}>Due</Label>
                            <Input id={`due-${clientId ?? leadId}`} className="mt-1" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required />
                        </div>
                        <RelationPicker label="Owner employee" value={ownerEmployeeId} emptyLabel="Choose an employee" required enabled selectedLabel={ownerLabels[ownerEmployeeId]} load={loadEmployeeOptions} onChange={setOwnerEmployeeId} />
                        <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as FollowUpStatus)}>
                            {FOLLOW_UP_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                        <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Add follow-up"}</Button>
                    </form>
                ) : <p className="border-t pt-3 text-sm text-muted-foreground">A follow-up needs an employee owner. This account cannot browse employees, so a new follow-up cannot be assigned.</p>
            ) : null}
        </div>
    );
}

function mergeFollowUps(current: FollowUp[], incoming: FollowUp[]): FollowUp[] {
    const items = new Map(current.map((item) => [item.id, item]));
    for (const item of incoming) items.set(item.id, item);
    return [...items.values()];
}
