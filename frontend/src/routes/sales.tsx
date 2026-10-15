import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AgreementPanel } from "@/components/agreement-panel";
import { AppShell } from "@/components/app-shell";
import { ForecastPanel } from "@/components/forecast-panel";
import { PageHeader, Panel } from "@/components/page-kit";
import { PipelinePanel } from "@/components/pipeline-panel";
import { ProposalPanel } from "@/components/proposal-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { canViewAgreements, canViewForecast, canViewPipeline, canViewProposals } from "@/lib/sales";

export const Route = createFileRoute("/sales")({
    head: () => ({
        meta: [
            { title: "Sales Pipeline — DigiCyrus ERP" },
            { name: "description", content: "Pipeline, forecast, proposals, and agreements." },
            { property: "og:title", content: "Sales Pipeline — DigiCyrus ERP" },
            { property: "og:description", content: "Pipeline, forecast, proposals, and agreements." },
        ],
    }),
    component: SalesPage,
});

const SECTIONS = [
    { id: "pipeline", label: "Pipeline", allowed: canViewPipeline },
    { id: "forecast", label: "Forecast", allowed: canViewForecast },
    { id: "proposals", label: "Proposals", allowed: canViewProposals },
    { id: "agreements", label: "Agreements", allowed: canViewAgreements },
] as const;

function SalesPage() {
    const auth = useAuth();
    const permissions = auth.user?.permissions ?? [];
    const sections = SECTIONS.filter((section) => section.allowed(permissions));
    const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>(sections[0]?.id ?? "pipeline");
    const active = sections.some((item) => item.id === section) ? section : sections[0]?.id;

    return (
        <AppShell>
            <PageHeader title="Sales" subtitle="Pipeline, forecast, proposals, and agreements" />
            {sections.length === 0 || !active ? (
                <Panel title="Sales">
                    <p role="alert" className="text-sm text-destructive">You do not have access to this.</p>
                </Panel>
            ) : (
                <Tabs value={active} onValueChange={(value) => setSection(value as (typeof SECTIONS)[number]["id"])}>
                    <TabsList>
                        {sections.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}
                    </TabsList>
                    <TabsContent value="pipeline"><PipelinePanel /></TabsContent>
                    <TabsContent value="forecast"><ForecastPanel /></TabsContent>
                    <TabsContent value="proposals"><ProposalPanel /></TabsContent>
                    <TabsContent value="agreements"><AgreementPanel /></TabsContent>
                </Tabs>
            )}
        </AppShell>
    );
}
