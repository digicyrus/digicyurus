import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { followUps, meetings, todaysTasks } from "@/lib/mock-data";

export const Route = createFileRoute("/planner")({
    head: () => ({
        meta: [
            { title: "Daily Planner — DigiCyrus ERP" },
            {
                name: "description",
                content: "Today's tasks, meetings, calls, notes and follow-up reminders for your agency day.",
            },
            { property: "og:title", content: "Daily Planner — DigiCyrus ERP" },
            { property: "og:description", content: "Plan the day: tasks, meetings, calls and follow-ups." },
        ],
    }),
    component: PlannerPage,
});

const hours = ["09:00", "10:00", "11:00", "12:00", "01:00", "02:00", "03:00", "04:00", "05:00"];

function PlannerPage() {
    return (
        <AppShell>
            <PageHeader title="Daily planner" subtitle="Thursday, 30 July" />

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Checklist" description="Today's tasks">
                    <ul className="space-y-3">
                        {todaysTasks.map((t) => (
                            <li key={t.id} className="flex items-start gap-3">
                                <Checkbox defaultChecked={t.done} className="mt-0.5" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm">{t.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {t.time} · {t.tag}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Panel>

                <Panel title="Calendar" description="Hourly schedule" className="lg:col-span-2">
                    <div className="space-y-1">
                        {hours.map((h, i) => {
                            const meeting = meetings[i % 3] && i % 3 === 0 ? meetings[Math.floor(i / 3)] : undefined;
                            return (
                                <div key={h} className="grid grid-cols-[56px_1fr] items-center gap-3">
                                    <span className="font-mono text-xs text-muted-foreground">{h}</span>
                                    {meeting ? (
                                        <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                                            <p className="truncate text-sm font-medium">{meeting.title}</p>
                                            <p className="truncate text-xs text-muted-foreground">{meeting.with}</p>
                                        </div>
                                    ) : (
                                        <div className="h-9 rounded-lg border border-dashed" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Follow-ups" description="Upcoming, today, missed and completed">
                    <div className="divide-y">
                        {followUps.map((f) => (
                            <div key={f.id} className="flex items-center gap-3 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{f.client}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {f.owner} · {f.due}
                                    </p>
                                </div>
                                <StatusPill status={f.status} />
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Notes" description="Scratchpad for the day">
                    <Textarea
                        className="min-h-48"
                        defaultValue={"• Nimbus wants phase 3 scope by Friday\n• Hire one more React dev\n• Review AWS costs before renewal"}
                    />
                </Panel>
            </div>
        </AppShell>
    );
}
