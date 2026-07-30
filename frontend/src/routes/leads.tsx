import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, leadStages, leads } from "@/lib/mock-data";

export const Route = createFileRoute("/leads")({
    head: () => ({
        meta: [
            { title: "Lead Management — DigiCyrus ERP" },
            {
                name: "description",
                content: "Kanban and table views for leads across every stage, with value, source and priority.",
            },
            { property: "og:title", content: "Lead Management — DigiCyrus ERP" },
            { property: "og:description", content: "Track leads from first touch to won deal." },
        ],
    }),
    component: LeadsPage,
});

function LeadsPage() {
    return (
        <AppShell>
            <PageHeader
                title="Leads"
                subtitle="41 active leads · ₹62.4L weighted pipeline"
                actions={
                    <>
                        <Button variant="outline" size="sm">
                            <Filter className="h-4 w-4" /> Filters
                        </Button>
                        <Button size="sm">
                            <Plus className="h-4 w-4" /> Add lead
                        </Button>
                    </>
                }
            />

            <Tabs defaultValue="kanban" className="space-y-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
                    <div className="relative min-w-0 sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Search leads…" className="pl-9" />
                    </div>
                    <TabsList className="shrink-0">
                        <TabsTrigger value="kanban">Kanban</TabsTrigger>
                        <TabsTrigger value="table">Table</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="kanban">
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {leadStages.map((stage) => {
                            const items = leads.filter((l) => l.stage === stage);
                            return (
                                <div key={stage} className="w-64 shrink-0">
                                    <div className="mb-2 flex items-center justify-between px-1">
                                        <p className="text-sm font-semibold">{stage}</p>
                                        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">
                                            {items.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2 rounded-xl bg-muted/50 p-2">
                                        {items.length === 0 ? (
                                            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No leads</p>
                                        ) : (
                                            items.map((l) => (
                                                <article key={l.id} className="surface lift cursor-grab p-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="truncate text-sm font-medium">{l.company}</p>
                                                        <StatusPill status={l.priority} />
                                                    </div>
                                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{l.person}</p>
                                                    <p className="mt-2 font-mono text-sm">{inr(l.value)}</p>
                                                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                                                        <span>{l.source}</span>
                                                        <span>{l.closing}</span>
                                                    </div>
                                                </article>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="table">
                    <Panel>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Owner contact</TableHead>
                                        <TableHead>Stage</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>Closing</TableHead>
                                        <TableHead>Priority</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {leads.map((l) => (
                                        <TableRow key={l.id}>
                                            <TableCell className="font-mono text-xs">{l.id}</TableCell>
                                            <TableCell className="font-medium">{l.company}</TableCell>
                                            <TableCell className="text-muted-foreground">{l.person}</TableCell>
                                            <TableCell>{l.stage}</TableCell>
                                            <TableCell className="font-mono text-xs">{inr(l.value)}</TableCell>
                                            <TableCell className="text-muted-foreground">{l.source}</TableCell>
                                            <TableCell className="text-muted-foreground">{l.closing}</TableCell>
                                            <TableCell>
                                                <StatusPill status={l.priority} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Panel>
                </TabsContent>
            </Tabs>
        </AppShell>
    );
}
