import { createFileRoute } from "@tanstack/react-router";
import { BellRing } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assets, inr } from "@/lib/mock-data";

export const Route = createFileRoute("/assets")({
    head: () => ({
        meta: [
            { title: "Asset Management — DigiCyrus ERP" },
            {
                name: "description",
                content: "Domains, hosting, SSL certificates, software licenses and subscriptions with renewal alerts.",
            },
            { property: "og:title", content: "Asset Management — DigiCyrus ERP" },
            { property: "og:description", content: "Never miss a domain, hosting or license renewal again." },
        ],
    }),
    component: AssetsPage,
});

function AssetsPage() {
    const dueSoon = assets.filter((a) => a.status === "Due Soon");
    return (
        <AppShell>
            <PageHeader title="Assets" subtitle={`${assets.length} tracked assets · ${dueSoon.length} renewals due soon`} />

            {dueSoon.length > 0 ? (
                <div className="surface flex items-start gap-3 border-warning/40 bg-warning/10 p-4">
                    <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Renewals need attention</p>
                        <p className="text-xs text-muted-foreground">
                            {dueSoon.map((a) => a.name).join(", ")} renew within the next 7 days.
                        </p>
                    </div>
                </div>
            ) : null}

            <Panel title="All assets">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Asset</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Renewal</TableHead>
                                <TableHead>Annual cost</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assets.map((a) => (
                                <TableRow key={a.id}>
                                    <TableCell className="font-medium">{a.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{a.type}</TableCell>
                                    <TableCell className="text-muted-foreground">{a.vendor}</TableCell>
                                    <TableCell className="text-muted-foreground">{a.renewal}</TableCell>
                                    <TableCell className="font-mono text-xs">{inr(a.cost)}</TableCell>
                                    <TableCell>
                                        <StatusPill status={a.status} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Panel>
        </AppShell>
    );
}
