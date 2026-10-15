import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiFailure } from "@/lib/crm";
import { availableSections, canViewDashboard, canViewReports, insights, type CountMap, type InsightView } from "@/lib/insights";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
    head: () => ({
        meta: [
            { title: "Dashboard — DigiCyrus ERP" },
            { name: "description", content: "Agency summary for the sections this account can view." },
            { property: "og:title", content: "Dashboard — DigiCyrus ERP" },
            { property: "og:description", content: "Agency summary for the sections this account can view." },
        ],
    }),
    component: Dashboard,
});

function Dashboard() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const allowed = canViewDashboard(permissions);
    const [summary, setSummary] = useState<InsightView | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!allowed) {
            setSummary(null);
            return;
        }
        let active = true;
        setLoading(true);
        void insights.dashboard().then((result) => {
            if (!active) return;
            setSummary(result);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setSummary(null);
            setMessage(failure.message);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [allowed, auth.refresh]);

    const sections = summary ? availableSections(summary) : [];

    return (
        <AppShell>
            <PageHeader
                title={auth.user ? auth.user.name : "Dashboard"}
                subtitle={allowed ? (loading ? "Loading summary…" : `${sections.length} sections`) : "The dashboard is not available for this role"}
                actions={canViewReports(permissions) ? (
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/reports">Reports</Link>
                    </Button>
                ) : null}
            />
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            {!allowed ? <p className="text-sm text-muted-foreground">You do not have access to the dashboard.</p> : null}
            {allowed && !loading && summary && sections.length === 0 ? <p className="text-sm text-muted-foreground">No dashboard sections are available for this role.</p> : null}

            {summary ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {summary.clients !== null ? <Metric label="Clients" value={String(summary.clients)} /> : null}
                    {summary.leads ? <Metric label="Lead value" value={inr(summary.leads.value)} /> : null}
                    {summary.finance ? <Metric label="Issued" value={inr(summary.finance.issued)} /> : null}
                    {summary.finance ? <Metric label="Collected" value={inr(summary.finance.collected)} /> : null}
                    {summary.finance ? <Metric label="Outstanding" value={inr(summary.finance.outstanding)} /> : null}
                    {summary.finance ? <Metric label="Expenses" value={inr(summary.finance.expenses)} /> : null}
                    {summary.finance ? <Metric label="Profit" value={inr(summary.finance.profit)} /> : null}
                    {summary.employees !== null ? <Metric label="Employees" value={String(summary.employees)} /> : null}
                    {summary.attendance !== null ? <Metric label="Attendance records" value={String(summary.attendance)} /> : null}
                    {summary.campaigns ? <Metric label="Campaign spend" value={inr(summary.campaigns.spend)} /> : null}
                    {summary.campaigns ? <Metric label="Campaign leads" value={String(summary.campaigns.leads)} /> : null}
                    {summary.referrals ? <Metric label="Referral commission" value={inr(summary.referrals.commission)} /> : null}
                    {summary.serviceRates ? <Metric label="Active service rates" value={String(summary.serviceRates.active)} /> : null}
                </div>
            ) : null}

            {summary ? (
                <div className="grid gap-4 lg:grid-cols-3">
                    {summary.leads ? (
                        <Panel title="Leads" description={`${summary.leads.total} leads`}>
                            <Counts title="Stage" counts={summary.leads.byStage} />
                            <Counts title="Source" counts={summary.leads.bySource} />
                        </Panel>
                    ) : null}
                    {summary.projects ? <Panel title="Projects" description={`${summary.projects.total} projects`}><Counts counts={summary.projects.byStatus} /></Panel> : null}
                    {summary.tasks ? <Panel title="Tasks" description={`${summary.tasks.total} tasks`}><Counts counts={summary.tasks.byStatus} /></Panel> : null}
                    {summary.followUps ? <Panel title="Follow-ups" description={`${summary.followUps.total} follow-ups`}><Counts counts={summary.followUps.byStatus} /></Panel> : null}
                    {summary.content ? <Panel title="Content" description={`${summary.content.total} items`}><Counts counts={summary.content.byStatus} /></Panel> : null}
                    {summary.campaigns ? <Panel title="Campaigns" description={`${summary.campaigns.total} campaigns`}><p className="text-sm">Spend {inr(summary.campaigns.spend)} · Leads {summary.campaigns.leads}</p></Panel> : null}
                    {summary.referrals ? <Panel title="Referrals" description={`${summary.referrals.total} referrals`}><p className="text-sm">Revenue {inr(summary.referrals.revenue)} · Commission {inr(summary.referrals.commission)}</p></Panel> : null}
                </div>
            ) : null}
        </AppShell>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="surface lift p-4">
            <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
        </div>
    );
}

function Counts({ counts, title }: { counts: CountMap; title?: string }) {
    const entries = Object.entries(counts);
    return (
        <div className="mb-3">
            {title ? <p className="mb-1 text-xs text-muted-foreground">{title}</p> : null}
            {entries.length === 0 ? <p className="text-sm text-muted-foreground">No records</p> : (
                <ul className="space-y-1.5">
                    {entries.map(([name, value]) => (
                        <li key={name} className="flex justify-between gap-3 text-sm">
                            <span className="truncate text-muted-foreground">{name}</span>
                            <span className="font-medium">{value}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
