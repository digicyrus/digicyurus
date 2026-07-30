import { createFileRoute } from "@tanstack/react-router";
import { Star, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clients, inr, activities } from "@/lib/mock-data";

export const Route = createFileRoute("/crm")({
    head: () => ({
        meta: [
            { title: "CRM — DigiCyrus ERP" },
            {
                name: "description",
                content: "Client profiles, contacts, communication history, documents and follow-up schedules.",
            },
            { property: "og:title", content: "CRM — DigiCyrus ERP" },
            { property: "og:description", content: "Manage every client relationship in one workspace." },
        ],
    }),
    component: CrmPage,
});

function CrmPage() {
    const active = clients[0];
    return (
        <AppShell>
            <PageHeader
                title="CRM"
                subtitle="86 clients · 6 shown"
                actions={
                    <Button size="sm">
                        <Plus className="h-4 w-4" /> New client
                    </Button>
                }
            />

            <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Clients" className="lg:col-span-2">
                    <Input placeholder="Search clients, contacts, industries…" className="mb-4" />
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Industry</TableHead>
                                    <TableHead>Lifetime value</TableHead>
                                    <TableHead>Rating</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-medium">{c.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{c.contact}</TableCell>
                                        <TableCell className="text-muted-foreground">{c.industry}</TableCell>
                                        <TableCell className="font-mono text-xs">{inr(c.value)}</TableCell>
                                        <TableCell>
                                            <span className="flex items-center gap-0.5">
                                                {Array.from({ length: c.rating }).map((_, i) => (
                                                    <Star key={i} className="h-3 w-3 fill-warning text-warning" />
                                                ))}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <StatusPill status={c.status} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Panel>

                <Panel title={active.name} description={`Client since ${active.since} · ${active.industry}`}>
                    <Tabs defaultValue="overview">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                            <TabsTrigger value="docs">Docs</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overview" className="space-y-3 pt-4 text-sm">
                            <Row label="Primary contact" value={active.contact} />
                            <Row label="Email" value="kabir@nimbusretail.in" />
                            <Row label="Phone" value="+91 98200 41120" />
                            <Row label="Lifetime value" value={inr(active.value)} />
                            <Row label="Next follow-up" value="Today, 4:00 PM" />
                            <div className="flex flex-wrap gap-1.5 pt-2">
                                {["Retainer", "E-commerce", "Priority"].map((t) => (
                                    <span key={t} className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </TabsContent>
                        <TabsContent value="timeline" className="pt-4">
                            <ul className="space-y-3">
                                {activities.slice(0, 4).map((a) => (
                                    <li key={a.id} className="flex gap-3">
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                        <div className="min-w-0">
                                            <p className="text-sm leading-snug">{a.text}</p>
                                            <p className="text-xs text-muted-foreground">{a.time}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </TabsContent>
                        <TabsContent value="docs" className="space-y-2 pt-4">
                            {["MSA_Nimbus_2024.pdf", "Brand_Guidelines.pdf", "Invoice_INV-2041.pdf"].map((d) => (
                                <div key={d} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                                    <span className="truncate">{d}</span>
                                    <Button variant="ghost" size="sm">
                                        Download
                                    </Button>
                                </div>
                            ))}
                        </TabsContent>
                    </Tabs>
                </Panel>
            </div>
        </AppShell>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="truncate font-medium">{value}</span>
        </div>
    );
}
