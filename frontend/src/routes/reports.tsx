import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel } from "@/components/page-kit";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import {
    canViewFinanceReport,
    canViewHrReport,
    canViewMarketingReport,
    canViewProjectsReport,
    canViewReports,
    canViewSalesReport,
    insights,
    isCurrentReportRequest,
    loadReportSection,
    type FinanceInsight,
    type HrReport,
    type InsightView,
    type LeadInsight,
    type MarketingReport,
    type ProjectsReport,
    type ReportSectionState,
} from "@/lib/insights";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/reports")({
    head: () => ({
        meta: [
            { title: "Reports & Exports — DigiCyrus ERP" },
            { name: "description", content: "Finance, sales, project, marketing, and HR reports for the selected dates." },
            { property: "og:title", content: "Reports & Exports — DigiCyrus ERP" },
            { property: "og:description", content: "Finance, sales, project, marketing, and HR reports." },
        ],
    }),
    component: ReportsPage,
});

function ReportsPage() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const allowed = canViewReports(permissions);
    const financeAllowed = canViewFinanceReport(permissions);
    const salesAllowed = canViewSalesReport(permissions);
    const projectsAllowed = canViewProjectsReport(permissions);
    const marketingAllowed = canViewMarketingReport(permissions);
    const hrAllowed = canViewHrReport(permissions);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [overview, setOverview] = useState<ReportSectionState<InsightView>>({ status: "loading" });
    const [finance, setFinance] = useState<ReportSectionState<FinanceInsight>>({ status: "loading" });
    const [sales, setSales] = useState<ReportSectionState<LeadInsight>>({ status: "loading" });
    const [projects, setProjects] = useState<ReportSectionState<ProjectsReport>>({ status: "loading" });
    const [marketing, setMarketing] = useState<ReportSectionState<MarketingReport>>({ status: "loading" });
    const [hr, setHr] = useState<ReportSectionState<HrReport>>({ status: "loading" });
    const [message, setMessage] = useState<string | null>(null);
    const requestId = useRef(0);

    useEffect(() => {
        if (!allowed) {
            setOverview({ status: "unavailable" });
            setFinance({ status: "unavailable" });
            setSales({ status: "unavailable" });
            setProjects({ status: "unavailable" });
            setMarketing({ status: "unavailable" });
            setHr({ status: "unavailable" });
            return;
        }
        if (from && to && from > to) {
            setMessage("End date must be on or after the start date");
            return;
        }
        const currentId = requestId.current + 1;
        requestId.current = currentId;
        const range = { from: from || undefined, to: to || undefined };
        setMessage(null);
        setOverview({ status: "loading" });
        setFinance(financeAllowed ? { status: "loading" } : { status: "unavailable" });
        setSales(salesAllowed ? { status: "loading" } : { status: "unavailable" });
        setProjects(projectsAllowed ? { status: "loading" } : { status: "unavailable" });
        setMarketing(marketingAllowed ? { status: "loading" } : { status: "unavailable" });
        setHr(hrAllowed ? { status: "loading" } : { status: "unavailable" });

        function apply<T>(result: Exclude<ReportSectionState<T>, { status: "loading" }>, update: (state: ReportSectionState<T>) => void) {
            if (!isCurrentReportRequest(currentId, requestId.current)) return;
            if (result.status === "error" && result.statusCode === 401) void auth.refresh();
            update(result);
        }

        void loadReportSection(true, () => insights.reports.overview(range)).then((result) => apply(result, setOverview));
        void loadReportSection(financeAllowed, () => insights.reports.finance(range)).then((result) => apply(result, setFinance));
        void loadReportSection(salesAllowed, () => insights.reports.sales(range)).then((result) => apply(result, setSales));
        void loadReportSection(projectsAllowed, () => insights.reports.projects(range)).then((result) => apply(result, setProjects));
        void loadReportSection(marketingAllowed, () => insights.reports.marketing(range)).then((result) => apply(result, setMarketing));
        void loadReportSection(hrAllowed, () => insights.reports.hr(range)).then((result) => apply(result, setHr));
    }, [allowed, financeAllowed, salesAllowed, projectsAllowed, marketingAllowed, hrAllowed, from, to, auth.refresh]);

    return (
        <AppShell>
            <PageHeader title="Reports" subtitle={allowed ? "Figures for the selected dates" : "Reports are not available for this role"} />
            {allowed ? (
                <div className="flex flex-wrap gap-2">
                    <Input aria-label="From" type="date" className="w-40" value={from} onChange={(event) => setFrom(event.target.value)} />
                    <Input aria-label="To" type="date" className="w-40" value={to} onChange={(event) => setTo(event.target.value)} />
                </div>
            ) : <p className="text-sm text-muted-foreground">You do not have access to reports.</p>}
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            <p className="text-xs text-muted-foreground">PDF, Excel, and CSV export are not available.</p>

            {allowed ? <>
            <ReportFrame title="Overview" state={overview}>
                {overview.status === "success" ? (
                    <>
                        {overview.data.clients !== null ? <Panel title="Clients" description="Clients in this range"><p className="text-sm">{overview.data.clients}</p></Panel> : null}
                        {overview.data.followUps ? <Panel title="Follow-ups" description={`${overview.data.followUps.total} follow-ups`}><CountList counts={overview.data.followUps.byStatus} /></Panel> : null}
                        {overview.data.referrals ? <Panel title="Referrals" description={`${overview.data.referrals.total} referrals`}><p className="text-sm">Revenue {inr(overview.data.referrals.revenue)} · Commission {inr(overview.data.referrals.commission)}</p></Panel> : null}
                        {overview.data.serviceRates ? <Panel title="Service rates" description={`${overview.data.serviceRates.total} rates`}><p className="text-sm">{overview.data.serviceRates.active} active</p></Panel> : null}
                        {overview.data.clients === null && !overview.data.followUps && !overview.data.referrals && !overview.data.serviceRates ? <p className="text-sm text-muted-foreground">No overview figures are available for this role.</p> : null}
                    </>
                ) : null}
            </ReportFrame>

            {finance.status === "success" ? (
                <Panel title="Finance" description="Issued, collected, expenses, and profit">
                    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <Metric label="Issued" value={inr(finance.data.issued)} />
                        <Metric label="Collected" value={inr(finance.data.collected)} />
                        <Metric label="Outstanding" value={inr(finance.data.outstanding)} />
                        <Metric label="Expenses" value={inr(finance.data.expenses)} />
                        <Metric label="Profit" value={inr(finance.data.profit)} />
                        {finance.data.tax !== undefined ? <Metric label="Tax" value={inr(finance.data.tax)} /> : null}
                    </div>
                    {finance.data.months && finance.data.months.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={finance.data.months}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
                                <Bar dataKey="revenue" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} barSize={18} />
                                <Bar dataKey="expenses" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} barSize={18} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-sm text-muted-foreground">No monthly figures in this range.</p>}
                </Panel>
            ) : <ReportFrame title="Finance" state={finance} />}

            {sales.status === "success" ? (
                <Panel title="Sales" description={`${sales.data.total} leads · ${inr(sales.data.value)}`}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <CountList title="Stage" counts={sales.data.byStage} />
                        <CountList title="Source" counts={sales.data.bySource} />
                    </div>
                </Panel>
            ) : <ReportFrame title="Sales" state={sales} />}

            {projects.status === "success" ? (
                <Panel title="Projects" description={`${projects.data.total} projects`}>
                    <CountList counts={projects.data.byStatus} />
                    {projects.data.tasks ? <CountList title={`Tasks · ${projects.data.tasks.total}`} counts={projects.data.tasks.byStatus} /> : <p className="text-sm text-muted-foreground">Task totals are not available for this role.</p>}
                </Panel>
            ) : <ReportFrame title="Projects" state={projects} />}

            {marketing.status === "success" ? (
                <Panel title="Marketing" description={`${marketing.data.campaigns.total} campaigns`}>
                    <p className="text-sm">Spend {inr(marketing.data.campaigns.spend)} · Leads {marketing.data.campaigns.leads}</p>
                    {marketing.data.content ? <CountList title={`Content · ${marketing.data.content.total}`} counts={marketing.data.content.byStatus} /> : <p className="mt-3 text-sm text-muted-foreground">Content totals are not available for this role.</p>}
                </Panel>
            ) : <ReportFrame title="Marketing" state={marketing} />}

            {hr.status === "success" ? (
                <Panel title="HR" description="Employees and attendance in this range">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {hr.data.employees !== null ? <Metric label="Employees" value={String(hr.data.employees)} /> : <p className="text-sm text-muted-foreground">Employee totals are not available for this role.</p>}
                        {hr.data.attendance !== null ? <Metric label="Attendance records" value={String(hr.data.attendance)} /> : <p className="text-sm text-muted-foreground">Attendance totals are not available for this role.</p>}
                    </div>
                </Panel>
            ) : <ReportFrame title="HR" state={hr} />}
            </> : null}
        </AppShell>
    );
}

function ReportFrame({ title, state, children }: { title: string; state: ReportSectionState<unknown>; children?: ReactNode }) {
    if (state.status === "loading") {
        return (
            <article className="surface p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">Loading…</p>
            </article>
        );
    }
    if (state.status === "error") {
        return (
            <article className="surface p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p role="alert" className="mt-1 text-sm text-destructive">{state.message}</p>
            </article>
        );
    }
    if (state.status === "unavailable") return <Note title={title} />;
    return <>{children}</>;
}

function Note({ title }: { title: string }) {
    return (
        <article className="surface p-4">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">This report is not available for this role.</p>
        </article>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="surface p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
    );
}

function CountList({ counts, title }: { counts: Record<string, number>; title?: string }) {
    const entries = Object.entries(counts);
    return (
        <div className="mt-3">
            {title ? <p className="mb-1 text-xs text-muted-foreground">{title}</p> : null}
            {entries.length === 0 ? <p className="text-sm text-muted-foreground">No records</p> : (
                <ul className="space-y-1">
                    {entries.map(([name, value]) => (
                        <li key={name} className="flex justify-between text-sm"><span className="text-muted-foreground">{name}</span><span>{value}</span></li>
                    ))}
                </ul>
            )}
        </div>
    );
}
