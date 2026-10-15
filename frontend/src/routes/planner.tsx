import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { FollowUpPanel } from "@/components/follow-up-panel";
import { PageHeader, Panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { apiFailure, formatDay } from "@/lib/crm";
import { delivery, isoDate, plannerTime, type PlannerEntry } from "@/lib/delivery";

export const Route = createFileRoute("/planner")({
    head: () => ({
        meta: [
            { title: "Daily Planner — DigiCyrus ERP" },
            { name: "description", content: "Today's tasks, meetings, calls, notes and follow-up reminders for your agency day." },
            { property: "og:title", content: "Daily Planner — DigiCyrus ERP" },
            { property: "og:description", content: "Plan the day: tasks, meetings, calls and follow-ups." },
        ],
    }),
    component: PlannerPage,
});

const hours = [
    { label: "09:00", hour: "09" },
    { label: "10:00", hour: "10" },
    { label: "11:00", hour: "11" },
    { label: "12:00", hour: "12" },
    { label: "01:00", hour: "13" },
    { label: "02:00", hour: "14" },
    { label: "03:00", hour: "15" },
    { label: "04:00", hour: "16" },
    { label: "05:00", hour: "17" },
];

function PlannerPage() {
    const auth = useAuth();
    const canUpdate = auth.user?.permissions.includes("planner:update") ?? false;
    const today = isoDate(new Date());
    const [from, setFrom] = useState(today);
    const [to, setTo] = useState(today);
    const [items, setItems] = useState<PlannerEntry[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState("");
    const [entryDate, setEntryDate] = useState(today);
    const [time, setTime] = useState("");
    const [tag, setTag] = useState("");
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<PlannerEntry | null>(null);

    async function load(range = { from, to }) {
        setLoading(true);
        try {
            const result = await delivery.planner.list(range);
            setItems(result.items);
            setMessage(null);
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, [from, to]);

    async function toggle(entry: PlannerEntry, done: boolean) {
        try {
            const updated = await delivery.planner.update(entry.id, { done });
            setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
        }
    }

    async function create(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            await delivery.planner.create({
                title: title.trim(),
                entryDate,
                time: plannerTime(time),
                done: false,
                tag: tag.trim() || null,
            });
            setTitle("");
            setTime("");
            setTag("");
            await load();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.fields.title ?? failure.fields.time ?? failure.fields.entryDate ?? failure.message);
        } finally {
            setSaving(false);
        }
    }

    async function saveEdit(event: FormEvent) {
        event.preventDefault();
        if (!editing) return;
        setSaving(true);
        setMessage(null);
        try {
            const updated = await delivery.planner.update(editing.id, {
                title: editing.title.trim(),
                entryDate: editing.entryDate,
                time: plannerTime(editing.time),
                tag: editing.tag?.trim() || null,
            });
            setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
            setEditing(null);
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.fields.title ?? failure.fields.time ?? failure.fields.entryDate ?? failure.message);
        } finally {
            setSaving(false);
        }
    }

    const dayItems = items.filter((item) => item.entryDate === from);

    return (
        <AppShell>
            <PageHeader title="Daily planner" subtitle={`${formatDay(from)} – ${formatDay(to)}`} />
            <div className="flex flex-wrap gap-2">
                <Input type="date" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
                <Input type="date" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Checklist" description="Personal planner entries">
                    {loading ? <p className="text-sm text-muted-foreground">Loading planner…</p> : null}
                    {!loading && items.length === 0 ? <p className="text-sm text-muted-foreground">No entries in this range</p> : null}
                    <ul className="space-y-3">
                        {items.map((entry) => (
                            <li key={entry.id} className="flex items-start gap-3">
                                <Checkbox className="mt-0.5" checked={entry.done} disabled={!canUpdate} onCheckedChange={(checked) => void toggle(entry, checked === true)} />
                                <div className="min-w-0 flex-1">
                                    <p className={`truncate text-sm ${entry.done ? "text-muted-foreground line-through" : ""}`}>{entry.title}</p>
                                    <p className="text-xs text-muted-foreground">{entry.time ?? "No time"} · {entry.tag ?? "No tag"} · {formatDay(entry.entryDate)}</p>
                                </div>
                                {canUpdate ? <Button size="sm" variant="ghost" onClick={() => setEditing(entry)}>Edit</Button> : null}
                            </li>
                        ))}
                    </ul>
                    {canUpdate ? (
                        <form className="mt-4 space-y-2 border-t pt-3" onSubmit={(event) => void create(event)}>
                            <Label className="text-xs text-muted-foreground" htmlFor="planner-title">New entry</Label>
                            <Input id="planner-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" required />
                            <Input type="date" aria-label="Entry date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required />
                            <Input type="time" aria-label="Time" value={time} onChange={(event) => setTime(event.target.value)} />
                            <Input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Tag" />
                            <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Add entry"}</Button>
                        </form>
                    ) : null}
                    {editing ? (
                        <form className="mt-4 space-y-2 border-t pt-3" onSubmit={(event) => void saveEdit(event)}>
                            <Input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} required />
                            <Input type="date" aria-label="Edit date" value={editing.entryDate} onChange={(event) => setEditing({ ...editing, entryDate: event.target.value })} required />
                            <Input type="time" aria-label="Edit time" value={editing.time ?? ""} onChange={(event) => setEditing({ ...editing, time: event.target.value })} />
                            <Input value={editing.tag ?? ""} onChange={(event) => setEditing({ ...editing, tag: event.target.value })} placeholder="Tag" />
                            <Button type="submit" size="sm" disabled={saving}>Save changes</Button>
                        </form>
                    ) : null}
                </Panel>
                <Panel title="Calendar" description="Hourly schedule" className="lg:col-span-2">
                    <div className="space-y-1">
                        {hours.map((slot) => {
                            const entry = dayItems.find((item) => item.time?.startsWith(slot.hour));
                            return (
                                <div key={slot.label} className="grid grid-cols-[56px_1fr] items-center gap-3">
                                    <span className="font-mono text-xs text-muted-foreground">{slot.label}</span>
                                    {entry ? (
                                        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                                            <p className="truncate text-sm font-medium">{entry.title}</p>
                                            <p className="truncate text-xs text-muted-foreground">{entry.tag ?? entry.time}</p>
                                        </div>
                                    ) : <div className="h-9 rounded-lg border border-dashed" />}
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Follow-ups" description="Upcoming, today, missed and completed">
                    <FollowUpPanel />
                </Panel>
                <Panel title="Notes" description="Scratchpad for the day. Notes are not saved.">
                    <Textarea className="min-h-48" placeholder="Notes stay in this browser tab and are not stored." />
                </Panel>
            </div>
        </AppShell>
    );
}
