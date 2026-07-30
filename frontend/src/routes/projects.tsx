import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, projects, taskBoard } from "@/lib/mock-data";

export const Route = createFileRoute("/projects")({
    head: () => ({
        meta: [
            { title: "Projects & Tasks — DigiCyrus ERP" },
            {
                name: "description",
                content: "Project delivery board with milestones, budgets, task kanban, timeline and team allocation.",
            },
            { property: "og:title", content: "Projects & Tasks — DigiCyrus ERP" },
            { property: "og:description", content: "Ship agency projects on time and on budget." },
        ],
    }),
    component: ProjectsPage,
});

const columns = Object.keys(taskBoard) as (keyof typeof taskBoard)[];

function ProjectsPage() {
    return (
        <AppShell>
            <PageHeader
                title="Projects"
                subtitle="24 active · 3 delayed"
                actions={
                    <Button size="sm">
                        <Plus className="h-4 w-4" /> New project
                    </Button>
                }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((p) => (
                    <article key={p.id} className="surface lift p-4">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{p.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{p.client}</p>
                            </div>
                            <StatusPill status={p.status} />
                        </div>
                        <Progress value={p.progress} className="mt-4 h-1.5" />
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{p.progress}% complete</span>
                            <span>Due {p.due}</span>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex -space-x-2">
                                {p.team.map((t) => (
                                    <span
                                        key={t}
                                        className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-accent text-[10px] font-semibold text-accent-foreground"
                                    >
                                        {t}
                                    </span>
                                ))}
                            </div>
                            <span className="font-mono text-xs">{inr(p.budget)}</span>
                        </div>
                    </article>
                ))}
            </div>

            <Tabs defaultValue="kanban" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="kanban">Kanban</TabsTrigger>
                    <TabsTrigger value="list">List</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                <TabsContent value="kanban">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {columns.map((col) => (
                            <div key={col} className="rounded-xl bg-muted/50 p-2">
                                <div className="mb-2 flex items-center justify-between px-1">
                                    <p className="text-sm font-semibold">{col}</p>
                                    <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">
                                        {taskBoard[col].length}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {taskBoard[col].map((t) => (
                                        <article key={t.id} className="surface lift p-3">
                                            <p className="text-sm font-medium leading-snug">{t.title}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{t.project}</p>
                                            <div className="mt-3 flex items-center justify-between">
                                                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">
                                                    {t.labels[0]}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {t.assignee} · {t.due}
                                                </span>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="list">
                    <Panel>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Project</TableHead>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Manager</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Budget</TableHead>
                                        <TableHead>Due</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {projects.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">{p.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{p.client}</TableCell>
                                            <TableCell className="text-muted-foreground">{p.pm}</TableCell>
                                            <TableCell>
                                                <StatusPill status={p.priority} />
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{inr(p.budget)}</TableCell>
                                            <TableCell className="text-muted-foreground">{p.due}</TableCell>
                                            <TableCell>
                                                <StatusPill status={p.status} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Panel>
                </TabsContent>

                <TabsContent value="timeline">
                    <Panel title="Delivery timeline" description="Relative schedule this quarter">
                        <div className="space-y-4">
                            {projects.map((p, i) => (
                                <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:grid-cols-[180px_1fr]">
                                    <p className="truncate text-sm">{p.name}</p>
                                    <div className="h-3 w-full rounded-full bg-muted">
                                        <div
                                            className="brand-gradient h-full rounded-full"
                                            style={{ marginLeft: `${i * 8}%`, width: `${Math.max(20, p.progress * 0.7)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </TabsContent>
            </Tabs>
        </AppShell>
    );
}
