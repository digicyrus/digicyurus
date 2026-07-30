import { createFileRoute, Link } from "@tanstack/react-router";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
    activities,
    cashFlow,
    followUps,
    inr,
    kpis,
    leadSources,
    meetings,
    monthlyGrowth,
    projectStatus,
    revenueTrend,
    salesFunnel,
    todaysTasks,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({
    head: () => ({
        meta: [
            { title: "Dashboard — DigiCyrus ERP" },
            {
                name: "description",
                content:
                    "Live agency dashboard: revenue, profit, pipeline, project health, tasks and follow-ups in one premium view.",
            },
            { property: "og:title", content: "Dashboard — DigiCyrus ERP" },
            {
                property: "og:description",
                content: "Revenue, pipeline, projects and team performance for your digital agency.",
            },
        ],
    }),
    component: Dashboard,
});

const chartColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
];

const axis = {
    stroke: "var(--color-muted-foreground)",
    fontSize: 11,
    tickLine: false,
    axisLine: false,
};

function ChartTooltip() {
    return (
        <Tooltip
            cursor={{ fill: "color-mix(in oklab, var(--foreground) 6%, transparent)" }}
            contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: "12px",
                fontSize: 12,
                color: "var(--color-popover-foreground)",
            }}
        />
    );
}

function formatKpi(value: number, format: string) {
    if (format === "inr") return inr(value);
    if (format === "pct") return `${value}%`;
    return value.toLocaleString("en-IN");
}

function Dashboard() {
    return (
        <AppShell>
            <PageHeader
                title="Good morning, Aarav"
                subtitle="Here's how DigiCyrus is performing this month."
                actions={
                    <>
                        <Button variant="outline" size="sm" asChild>
                            <Link to="/reports">Export report</Link>
                        </Button>
                        <Button size="sm">
                            <Plus className="h-4 w-4" /> Quick add
                        </Button>
                    </>
                }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map((k) => {
                    const up = k.delta >= 0;
                    return (
                        <div key={k.label} className="surface lift p-4">
                            <p className="truncate text-xs font-medium text-muted-foreground">{k.label}</p>
                            <p className="mt-2 text-xl font-semibold tracking-tight">
                                {formatKpi(k.value, k.format)}
                            </p>
                            <p
                                className={`mt-1 flex items-center gap-1 text-xs ${up ? "text-success" : "text-destructive"}`}
                            >
                                {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {Math.abs(k.delta)}% vs last month
                            </p>
                        </div>
                    );
                })}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Revenue & expense trend" description="Last 6 months" className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={revenueTrend}>
                            <defs>
                                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            <XAxis dataKey="month" {...axis} />
                            <YAxis {...axis} tickFormatter={(v: number) => `${v / 100000}L`} />
                            <ChartTooltip />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="var(--color-chart-1)"
                                strokeWidth={2}
                                fill="url(#rev)"
                            />
                            <Area
                                type="monotone"
                                dataKey="expenses"
                                stroke="var(--color-chart-3)"
                                strokeWidth={2}
                                fill="url(#exp)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>

                <Panel title="Lead sources" description="Share of new leads">
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={leadSources}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={62}
                                outerRadius={100}
                                paddingAngle={3}
                                stroke="none"
                            >
                                {leadSources.map((_, i) => (
                                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                                ))}
                            </Pie>
                            <ChartTooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <ul className="mt-2 space-y-1.5">
                        {leadSources.map((s, i) => (
                            <li key={s.name} className="flex items-center gap-2 text-xs">
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ background: chartColors[i % chartColors.length] }}
                                />
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.name}</span>
                                <span className="font-medium">{s.value}%</span>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Sales funnel" description="Leads by stage">
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={salesFunnel} layout="vertical" margin={{ left: 8 }}>
                            <XAxis type="number" {...axis} />
                            <YAxis type="category" dataKey="stage" width={78} {...axis} />
                            <ChartTooltip />
                            <Bar dataKey="count" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} barSize={16} />
                        </BarChart>
                    </ResponsiveContainer>
                </Panel>

                <Panel title="Cash flow" description="Inflow vs outflow">
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={cashFlow}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            <XAxis dataKey="month" {...axis} />
                            <YAxis {...axis} tickFormatter={(v: number) => `${v / 100000}L`} />
                            <ChartTooltip />
                            <Bar dataKey="inflow" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} barSize={12} />
                            <Bar dataKey="outflow" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} barSize={12} />
                        </BarChart>
                    </ResponsiveContainer>
                </Panel>

                <Panel title="Monthly growth" description="Clients & active projects">
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={monthlyGrowth}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            <XAxis dataKey="month" {...axis} />
                            <YAxis {...axis} />
                            <ChartTooltip />
                            <Line type="monotone" dataKey="clients" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="projects" stroke="var(--color-chart-5)" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Today's tasks" description="4 items">
                    <ul className="space-y-3">
                        {todaysTasks.map((t) => (
                            <li key={t.id} className="flex items-start gap-3">
                                <Checkbox defaultChecked={t.done} className="mt-0.5" />
                                <div className="min-w-0 flex-1">
                                    <p className={`truncate text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>
                                        {t.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t.time} · {t.tag}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Panel>

                <Panel title="Upcoming meetings" description="Today">
                    <ul className="space-y-3">
                        {meetings.map((m) => (
                            <li key={m.id} className="flex items-start gap-3">
                                <span className="mt-0.5 shrink-0 rounded-md bg-accent px-2 py-1 font-mono text-[11px] text-accent-foreground">
                                    {m.time}
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{m.title}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {m.with} · {m.mode}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Panel>

                <Panel title="Recent activity" description="Across all modules">
                    <ul className="space-y-3">
                        {activities.map((a) => (
                            <li key={a.id} className="flex gap-3">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                <div className="min-w-0">
                                    <p className="text-sm leading-snug">{a.text}</p>
                                    <p className="text-xs text-muted-foreground">{a.time}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Follow-ups" description="Due, missed and upcoming" className="lg:col-span-2">
                    <div className="divide-y">
                        {followUps.map((f) => (
                            <div key={f.id} className="flex items-center gap-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{f.client}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Owner {f.owner} · {f.due}
                                    </p>
                                </div>
                                <StatusPill status={f.status} />
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Project health" description="Status distribution">
                    <ul className="space-y-4">
                        {projectStatus.map((p, i) => (
                            <li key={p.name}>
                                <div className="mb-1.5 flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{p.name}</span>
                                    <span className="font-medium">{p.value}</span>
                                </div>
                                <Progress value={(p.value / 20) * 100} className="h-1.5" />
                                <span className="sr-only">{chartColors[i]}</span>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>
        </AppShell>
    );
}
