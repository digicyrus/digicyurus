import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel } from "@/components/page-kit";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { employees, inr } from "@/lib/mock-data";

export const Route = createFileRoute("/hr")({
    head: () => ({
        meta: [
            { title: "HR & People — DigiCyrus ERP" },
            {
                name: "description",
                content: "Employees, interns, attendance, leave, payroll, performance and daily work reports.",
            },
            { property: "og:title", content: "HR & People — DigiCyrus ERP" },
            { property: "og:description", content: "Run attendance, payroll and performance for your agency team." },
        ],
    }),
    component: HrPage,
});

function HrPage() {
    const payroll = employees.reduce((s, e) => s + e.salary, 0);
    return (
        <AppShell>
            <PageHeader title="HR" subtitle={`29 team members · monthly payroll ${inr(payroll)}`} />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: "Present today", value: "26 / 29" },
                    { label: "On leave", value: "2" },
                    { label: "Open positions", value: "4" },
                    { label: "Avg performance", value: "87%" },
                ].map((s) => (
                    <div key={s.label} className="surface lift p-4">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="mt-2 text-xl font-semibold">{s.value}</p>
                    </div>
                ))}
            </div>

            <Tabs defaultValue="people" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="people">People</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="reports">Daily reports</TabsTrigger>
                </TabsList>

                <TabsContent value="people">
                    <Panel>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Performance</TableHead>
                                        <TableHead>Salary</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map((e) => (
                                        <TableRow key={e.id}>
                                            <TableCell className="font-medium">{e.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{e.role}</TableCell>
                                            <TableCell className="text-muted-foreground">{e.dept}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Progress value={e.performance} className="h-1.5 w-20" />
                                                    <span className="text-xs text-muted-foreground">{e.performance}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{inr(e.salary)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Panel>
                </TabsContent>

                <TabsContent value="attendance">
                    <Panel title="Attendance & leave" description="Current month">
                        <ul className="space-y-4">
                            {employees.map((e) => (
                                <li key={e.id}>
                                    <div className="flex justify-between text-sm">
                                        <span className="truncate">{e.name}</span>
                                        <span className="text-muted-foreground">
                                            {e.attendance}% · {e.leaves} leaves
                                        </span>
                                    </div>
                                    <Progress value={e.attendance} className="mt-1.5 h-1.5" />
                                </li>
                            ))}
                        </ul>
                    </Panel>
                </TabsContent>

                <TabsContent value="reports">
                    <Panel title="Daily work reports" description="Submitted today">
                        <div className="divide-y">
                            {[
                                { name: "Manav Kohli", text: "Completed payment gateway migration and wrote regression tests." },
                                { name: "Sana Ali", text: "Client call with Nimbus, updated sprint scope, reviewed 4 PRs." },
                                { name: "Meera Nair", text: "Published SEO blog, prepared monsoon campaign creatives." },
                            ].map((r) => (
                                <div key={r.name} className="py-3">
                                    <p className="text-sm font-medium">{r.name}</p>
                                    <p className="mt-0.5 text-sm text-muted-foreground">{r.text}</p>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </TabsContent>
            </Tabs>
        </AppShell>
    );
}
