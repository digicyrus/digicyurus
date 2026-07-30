import { createFileRoute } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { campaigns, contentCalendar, inr, trafficTrend } from "@/lib/mock-data";

export const Route = createFileRoute("/marketing")({
    head: () => ({
        meta: [
            { title: "Marketing — DigiCyrus ERP" },
            {
                name: "description",
                content: "Campaign tracking, ad spend, ROI, SEO progress, content calendar and website traffic.",
            },
            { property: "og:title", content: "Marketing — DigiCyrus ERP" },
            { property: "og:description", content: "Track campaigns, spend and lead generation performance." },
        ],
    }),
    component: MarketingPage,
});

function MarketingPage() {
    const spend = campaigns.reduce((s, c) => s + c.spend, 0);
    return (
        <AppShell>
            <PageHeader title="Marketing" subtitle={`${inr(spend)} ad spend this month · 285 leads generated`} />

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Website traffic & leads" description="Sessions vs generated leads" className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={trafficTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                            <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="l" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="r" orientation="right" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{
                                    background: "var(--color-popover)",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                }}
                            />
                            <Line yAxisId="l" type="monotone" dataKey="sessions" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
                            <Line yAxisId="r" type="monotone" dataKey="leads" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </Panel>

                <Panel title="SEO progress" description="Target keywords in top 10">
                    <ul className="space-y-4">
                        {[
                            { k: "digital agency mumbai", v: 82 },
                            { k: "ecommerce development", v: 64 },
                            { k: "healthcare app design", v: 47 },
                            { k: "seo services india", v: 35 },
                        ].map((s) => (
                            <li key={s.k}>
                                <div className="flex justify-between text-sm">
                                    <span className="truncate text-muted-foreground">{s.k}</span>
                                    <span className="font-medium">{s.v}</span>
                                </div>
                                <Progress value={s.v} className="mt-1.5 h-1.5" />
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <Panel title="Campaigns" description="Spend, leads and ROI">
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
                            {campaigns.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{c.channel}</TableCell>
                                    <TableCell className="font-mono text-xs">{inr(c.spend)}</TableCell>
                                    <TableCell>{c.leads}</TableCell>
                                    <TableCell className="font-medium text-success">{c.roi}x</TableCell>
                                    <TableCell>
                                        <StatusPill status={c.status} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Panel>

            <Panel title="Content calendar" description="This week">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {contentCalendar.map((c) => (
                        <article key={c.id} className="surface lift p-4">
                            <p className="font-mono text-xs text-muted-foreground">{c.date}</p>
                            <p className="mt-2 text-sm font-medium leading-snug">{c.title}</p>
                            <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{c.channel}</span>
                                <StatusPill status={c.status} />
                            </div>
                        </article>
                    ))}
                </div>
            </Panel>
        </AppShell>
    );
}
