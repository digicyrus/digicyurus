import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cashFlow, expenses, inr, invoices, referrals, revenueTrend } from "@/lib/mock-data";

export const Route = createFileRoute("/finance")({
    head: () => ({
        meta: [
            { title: "Finance & Invoicing — DigiCyrus ERP" },
            {
                name: "description",
                content: "Revenue, expenses, invoices with GST, payments, cash flow and profit & loss for the agency.",
            },
            { property: "og:title", content: "Finance & Invoicing — DigiCyrus ERP" },
            { property: "og:description", content: "Invoices, GST, cash flow and profitability in one place." },
        ],
    }),
    component: FinancePage,
});

function FinancePage() {
    const receivable = invoices
        .filter((i) => i.status !== "Paid")
        .reduce((s, i) => s + i.amount + i.tax, 0);

    return (
        <AppShell>
            <PageHeader
                title="Finance"
                subtitle={`Receivables ${inr(receivable)} · GST filed till Jun`}
                actions={
                    <>
                        <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" /> Export
                        </Button>
                        <Button size="sm">
                            <Plus className="h-4 w-4" /> New invoice
                        </Button>
                    </>
                }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: "Revenue (Jul)", value: inr(4820000) },
                    { label: "Expenses (Jul)", value: inr(3135000) },
                    { label: "Net profit", value: inr(1685000) },
                    { label: "GST payable", value: inr(326700) },
                ].map((s) => (
                    <div key={s.label} className="surface lift p-4">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="mt-2 text-xl font-semibold">{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Profit & loss" description="Revenue, expenses, profit" className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={revenueTrend}>
                            <defs>
                                <linearGradient id="pl" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--color-chart-5)" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="var(--color-chart-5)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
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
                            <Area type="monotone" dataKey="profit" stroke="var(--color-chart-5)" strokeWidth={2} fill="url(#pl)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </Panel>

                <Panel title="Cash flow" description="Inflow vs outflow (₹L)">
                    <ul className="space-y-3">
                        {cashFlow.slice(-5).map((c) => (
                            <li key={c.month} className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{c.month}</span>
                                    <span className="font-mono">+{(c.inflow / 100000).toFixed(1)} / -{(c.outflow / 100000).toFixed(1)}</span>
                                </div>
                                <div className="flex gap-1">
                                    <div className="h-2 rounded-full bg-success" style={{ width: `${c.inflow / 60000}%` }} />
                                    <div className="h-2 rounded-full bg-destructive/70" style={{ width: `${c.outflow / 60000}%` }} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <Panel title="Invoices" description="Auto-numbered with GST and payment status">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>GST (18%)</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Due</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">PDF</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.map((i) => (
                                <TableRow key={i.id}>
                                    <TableCell className="font-mono text-xs">{i.id}</TableCell>
                                    <TableCell className="font-medium">{i.client}</TableCell>
                                    <TableCell className="font-mono text-xs">{inr(i.amount)}</TableCell>
                                    <TableCell className="font-mono text-xs">{inr(i.tax)}</TableCell>
                                    <TableCell className="font-mono text-xs">{inr(i.amount + i.tax)}</TableCell>
                                    <TableCell className="text-muted-foreground">{i.due}</TableCell>
                                    <TableCell>
                                        <StatusPill status={i.status} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">
                                            Export
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Expenses" description="July breakdown">
                    <div className="divide-y">
                        {expenses.map((e) => (
                            <div key={e.id} className="flex items-center justify-between py-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{e.head}</p>
                                    <p className="text-xs text-muted-foreground">{e.vendor}</p>
                                </div>
                                <span className="font-mono text-sm">{inr(e.amount)}</span>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Referral partners" description="Commissions & payouts">
                    <div className="divide-y">
                        {referrals.map((r) => (
                            <div key={r.id} className="flex items-center gap-3 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{r.partner}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {r.deals} deals · {inr(r.revenue)} sourced
                                    </p>
                                </div>
                                <span className="font-mono text-sm">{inr(r.commission)}</span>
                                <StatusPill status={r.status} />
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>
        </AppShell>
    );
}
