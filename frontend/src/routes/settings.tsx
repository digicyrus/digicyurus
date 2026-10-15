import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { CompanyProfilePanel } from "@/components/company-profile-panel";
import { NotificationPreferencesPanel } from "@/components/notification-preferences-panel";
import { PageHeader } from "@/components/page-kit";
import { RolesPanel } from "@/components/roles-panel";
import { ServiceRatesPanel } from "@/components/service-rates-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/settings")({
    head: () => ({
        meta: [
            { title: "Settings — DigiCyrus ERP" },
            { name: "description", content: "Company profile, service rates, roles, and notification preferences." },
            { property: "og:title", content: "Settings — DigiCyrus ERP" },
            { property: "og:description", content: "Company profile, service rates, roles, and notification preferences." },
        ],
    }),
    component: SettingsPage,
});

function SettingsPage() {
    return (
        <AppShell>
            <PageHeader title="Settings" subtitle="Workspace configuration for DigiCyrus" />

            <Tabs defaultValue="services" className="space-y-4">
                <TabsList className="flex-wrap">
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="services">Services & pricing</TabsTrigger>
                    <TabsTrigger value="roles">Roles</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>

                <TabsContent value="company">
                    <CompanyProfilePanel />
                </TabsContent>

                <TabsContent value="services">
                    <ServiceRatesPanel />
                </TabsContent>

                <TabsContent value="roles">
                    <RolesPanel />
                </TabsContent>

                <TabsContent value="notifications">
                    <NotificationPreferencesPanel />
                </TabsContent>
            </Tabs>
        </AppShell>
    );
}
