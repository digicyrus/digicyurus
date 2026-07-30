import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { revenueTrend } from "@/lib/mock-data";

export const Route = createFileRoute("/reports")({
    head: () => ({
        meta: [
            { title: "Reports & Exports — DigiCyrus ERP" },
            {
                name: "description",
                content: "Revenue, sales, client, project, marketing, employee and finance reports exportable to PDF, Excel and CSV.",
            },
            { property: "og:title", content: "Reports & Exports — DigiCyrus ERP" },
            { property: "og:description", content: "Generate and export agency reports in seconds." },
        ],
    }),
    component: ReportsPage,
});

const reports = [
    { name: "Revenue report", desc: "Monthly revenue by client & service", period: "Jul 2026" },
    { name: "Sales report", desc: "Pipeline movement and win rate", period: "Q2" },
    { name: "Client report", desc: "Retention, value and satisfaction", period: "Jul 2026" },
    { name: "Project report", desc: "Delivery, delays and utilisation", period: "Jul 2026" },
    { name: "Marketing report", desc: "Spend, ROI and lead generation", period: "Jul 2026" },
    { name: "Employee report", desc: "Attendance, leave and performance", period: "Jul 2026" },
    { name: "Finance report", desc: "P&L, GST and cash flow", period: "FY 25-26" },
];

function ReportsPage() {
    return (
        <AppShell>
            <PageHeader title="Reports" subtitle="Generate, preview and export in PDF, Excel or CSV" />

            <Panel title="Revenue vs expenses" description="Comparison used across financial reports">
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={revenueTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                            stroke="var(--color-muted-foreground)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => `${v / 100000}L`}
                        />
                        <Tooltip
                            contentStyle={{
                                background: "var(--color-popover)",
                                border: "1px solid var(--color-border)",
                                borderRadius: 12,
                                fontSize: 12,
                            }}
                        />
                        <Bar dataKey="revenue" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} barSize={18} />
                        <Bar dataKey="expenses" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} barSize={18} />
                    </BarChart>
                </ResponsiveContainer>
            </Panel>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {reports.map((r) => (
                    <article key={r.name} className="surface lift flex flex-col p-4">
                        <p className="text-sm font-semibold">{r.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
                        <p className="mt-3 font-mono text-[11px] text-muted-foreground">{r.period}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {[
                                { label: "PDF", icon: FileText },
                                { label: "Excel", icon: FileSpreadsheet },
                                { label: "CSV", icon: Table2 },
                            ].map((f) => (
                                <Button
                                    key={f.label}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toast.success(`${r.name} queued as ${f.label}`)}
                                >
                                    <f.icon className="h-3.5 w-3.5" /> {f.label}
                                </Button>
                            ))}
                        </div>
                    </article>
                ))}
            </div>
        </AppShell>
    );
}
