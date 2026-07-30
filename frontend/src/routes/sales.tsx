import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, leads, proposals, revenueTrend, salesFunnel, agreements } from "@/lib/mock-data";

export const Route = createFileRoute("/sales")({
    head: () => ({
        meta: [
            { title: "Sales Pipeline — DigiCyrus ERP" },
            {
                name: "description",
                content: "Pipeline stages, closing probability, revenue forecast, proposals and agreements.",
            },
            { property: "og:title", content: "Sales Pipeline — DigiCyrus ERP" },
            { property: "og:description", content: "Forecast revenue and move deals forward." },
        ],
    }),
    component: SalesPage,
});

function SalesPage() {
    const open = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
    const weighted = open.reduce((s, l) => s + (l.value * l.probability) / 100, 0);

    return (
        <AppShell>
            <PageHeader title="Sales" subtitle={`Weighted forecast ${inr(Math.round(weighted))}`} />

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Pipeline by stage" className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={salesFunnel}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            <XAxis dataKey="stage" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{
                                    background: "var(--color-popover)",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                }}
                            />
                            <Bar dataKey="count" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} barSize={26} />
                        </BarChart>
                    </ResponsiveContainer>
                </Panel>

                <Panel title="Revenue forecast" description="Closed vs projected">
                    <ul className="space-y-3">
                        {revenueTrend.slice(-4).map((r) => (
                            <li key={r.month}>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{r.month}</span>
                                    <span className="font-mono text-xs">{inr(r.revenue)}</span>
                                </div>
                                <Progress value={(r.revenue / 5000000) * 100} className="mt-1.5 h-1.5" />
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <Panel title="Open deals" description="Closing probability & next step">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Deal</TableHead>
                                <TableHead>Stage</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead>Probability</TableHead>
                                <TableHead>Expected close</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {open.map((l) => (
                                <TableRow key={l.id}>
                                    <TableCell className="font-medium">{l.company}</TableCell>
                                    <TableCell className="text-muted-foreground">{l.stage}</TableCell>
                                    <TableCell className="font-mono text-xs">{inr(l.value)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Progress value={l.probability} className="h-1.5 w-24" />
                                            <span className="text-xs text-muted-foreground">{l.probability}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{l.closing}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Proposals" description="Templates, versions and signatures">
                    <div className="divide-y">
                        {proposals.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {p.id} · {p.client}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {p.version} · sent {p.sent} · {inr(p.value)}
                                    </p>
                                </div>
                                <StatusPill status={p.status} />
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Agreements" description="Contracts, NDAs and expiry reminders">
                    <div className="divide-y">
                        {agreements.map((a) => (
                            <div key={a.id} className="flex items-center gap-3 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {a.type} — {a.client}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Expires {a.expiry}</p>
                                </div>
                                <StatusPill status={a.signed ? "Signed" : "Pending"} />
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>
        </AppShell>
    );
}
