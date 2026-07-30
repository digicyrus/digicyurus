import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rolePermissions } from "@/lib/mock-data";

export const Route = createFileRoute("/settings")({
    head: () => ({
        meta: [
            { title: "Settings — DigiCyrus ERP" },
            {
                name: "description",
                content: "Company profile, services and pricing, taxes, roles & permissions, email templates and branding.",
            },
            { property: "og:title", content: "Settings — DigiCyrus ERP" },
            { property: "og:description", content: "Configure your agency workspace." },
        ],
    }),
    component: SettingsPage,
});

function SettingsPage() {
    return (
        <AppShell>
            <PageHeader title="Settings" subtitle="Workspace configuration for DigiCyrus" />

            <Tabs defaultValue="company" className="space-y-4">
                <TabsList className="flex-wrap">
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="services">Services & pricing</TabsTrigger>
                    <TabsTrigger value="roles">Roles</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>

                <TabsContent value="company">
                    <Panel title="Company profile">
                        <form
                            className="grid gap-4 sm:grid-cols-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                toast.success("Company profile saved");
                            }}
                        >
                            <Field label="Legal name" defaultValue="DigiCyrus Technologies Pvt Ltd" />
                            <Field label="Brand name" defaultValue="DigiCyrus" />
                            <Field label="GSTIN" defaultValue="27AABCU9603R1ZX" />
                            <Field label="Billing email" defaultValue="accounts@digicyrus.com" />
                            <div className="sm:col-span-2">
                                <Label className="text-xs text-muted-foreground">Registered address</Label>
                                <Textarea className="mt-1.5" defaultValue="4th Floor, Orchid Tower, Andheri East, Mumbai 400069" />
                            </div>
                            <div className="sm:col-span-2">
                                <Button type="submit" size="sm">
                                    Save changes
                                </Button>
                            </div>
                        </form>
                    </Panel>
                </TabsContent>

                <TabsContent value="services">
                    <Panel title="Services & pricing" description="Default rate card used in proposals and invoices">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Rate</TableHead>
                                    <TableHead>Tax</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[
                                    ["Web development", "Per project", "₹4,50,000", "18% GST"],
                                    ["UI/UX design", "Per sprint", "₹1,20,000", "18% GST"],
                                    ["SEO retainer", "Monthly", "₹65,000", "18% GST"],
                                    ["Performance marketing", "Monthly + 12% of spend", "₹80,000", "18% GST"],
                                ].map((r) => (
                                    <TableRow key={r[0]}>
                                        <TableCell className="font-medium">{r[0]}</TableCell>
                                        <TableCell className="text-muted-foreground">{r[1]}</TableCell>
                                        <TableCell className="font-mono text-xs">{r[2]}</TableCell>
                                        <TableCell className="text-muted-foreground">{r[3]}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Panel>
                </TabsContent>

                <TabsContent value="roles">
                    <Panel title="Roles & permissions" description="Module access per role">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {rolePermissions.map((r) => (
                                <article key={r.role} className="surface p-4">
                                    <p className="text-sm font-semibold">{r.role}</p>
                                    <ul className="mt-2 space-y-1">
                                        {r.modules.map((m) => (
                                            <li key={m} className="text-xs text-muted-foreground">
                                                • {m}
                                            </li>
                                        ))}
                                    </ul>
                                </article>
                            ))}
                        </div>
                    </Panel>
                </TabsContent>

                <TabsContent value="notifications">
                    <Panel title="Notification settings">
                        <ul className="divide-y">
                            {[
                                ["In-app notifications", true],
                                ["Email notifications", true],
                                ["Browser push notifications", false],
                                ["WhatsApp reminders (coming soon)", false],
                            ].map(([label, on]) => (
                                <li key={label as string} className="flex items-center justify-between gap-4 py-3">
                                    <span className="min-w-0 truncate text-sm">{label as string}</span>
                                    <Switch defaultChecked={on as boolean} />
                                </li>
                            ))}
                        </ul>
                    </Panel>
                </TabsContent>
            </Tabs>
        </AppShell>
    );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input className="mt-1.5" defaultValue={defaultValue} />
        </div>
    );
}
