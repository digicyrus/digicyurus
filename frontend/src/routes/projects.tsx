import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, StatusPill } from "@/components/page-kit";
import { RelationPicker, useResolvedLabels } from "@/components/relation-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { apiFailure, formatDay } from "@/lib/crm";
import { delivery, newProjectDraft, newTaskDraft, PRIORITIES, PROJECT_STATUSES, TASK_STATUSES, taskListQuery, type Priority, type Project, type ProjectDraft, type ProjectStatus, type Task, type TaskDraft, type TaskStatus } from "@/lib/delivery";
import { canBrowseClients, canBrowseProjects, linkedLabel, loadClientOptions, loadProjectOptions, lookupClientName, lookupProjectName, RELATION_PAGE_SIZE, requireRelation } from "@/lib/relations";

export const Route = createFileRoute("/projects")({
    head: () => ({
        meta: [
            { title: "Projects & Tasks — DigiCyrus ERP" },
            { name: "description", content: "Project delivery board with milestones, budgets, task kanban, timeline and team allocation." },
            { property: "og:title", content: "Projects & Tasks — DigiCyrus ERP" },
            { property: "og:description", content: "Ship agency projects on time and on budget." },
        ],
    }),
    component: ProjectsPage,
});

function ProjectsPage() {
    const auth = useAuth();
    const canCreateProject = auth.user?.permissions.includes("projects:create") ?? false;
    const canUpdateProject = auth.user?.permissions.includes("projects:update") ?? false;
    const canCreateTask = auth.user?.permissions.includes("tasks:create") ?? false;
    const canUpdateTask = auth.user?.permissions.includes("tasks:update") ?? false;
    const permissions = auth.user?.permissions ?? [];
    const canClients = canBrowseClients(permissions);
    const canProjects = canBrowseProjects(permissions);
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectTotal, setProjectTotal] = useState(0);
    const [projectPage, setProjectPage] = useState(1);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<ProjectStatus | "">("");
    const [priority, setPriority] = useState<Priority | "">("");
    const [clientId, setClientId] = useState("");
    const [tasks, setTasks] = useState<Task[]>([]);
    const [taskTotal, setTaskTotal] = useState(0);
    const [taskPage, setTaskPage] = useState(1);
    const [taskProjectId, setTaskProjectId] = useState("");
    const [taskStatus, setTaskStatus] = useState<TaskStatus | "">("");
    const [taskPriority, setTaskPriority] = useState<Priority | "">("");
    const [dueFrom, setDueFrom] = useState("");
    const [dueTo, setDueTo] = useState("");
    const [mine, setMine] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [projectEditor, setProjectEditor] = useState<Project | "new" | null>(null);
    const [taskEditor, setTaskEditor] = useState<Task | "new" | null>(null);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setProjectPage(1);
            setQuery(search.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        void delivery.projects.list({
            page: projectPage,
            pageSize: 20,
            search: query || undefined,
            status: status || undefined,
            priority: priority || undefined,
            clientId: clientId || undefined,
        }).then((result) => {
            if (!active) return;
            setProjects(result.items);
            setProjectTotal(result.total);
            setMessage(null);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setProjects([]);
            setProjectTotal(0);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [projectPage, query, status, priority, clientId, revision, auth.refresh]);

    useEffect(() => {
        let active = true;
        void delivery.tasks.list(taskListQuery({
            page: taskPage,
            pageSize: RELATION_PAGE_SIZE,
            projectId: taskProjectId,
            status: taskStatus,
            priority: taskPriority,
            dueFrom,
            dueTo,
            assigneeUserId: mine ? auth.user?.id : undefined,
        })).then((result) => {
            if (!active) return;
            setTasks(result.items);
            setTaskTotal(result.total);
        }).catch((error: unknown) => {
            if (!active) return;
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
            setTasks([]);
            setTaskTotal(0);
        });
        return () => {
            active = false;
        };
    }, [taskPage, taskProjectId, taskStatus, taskPriority, dueFrom, dueTo, mine, revision, auth.user?.id, auth.refresh]);

    const clientLabels = useResolvedLabels(projects.map((project) => project.clientId), canClients, lookupClientName);
    const projectLabels = useResolvedLabels(tasks.map((task) => task.projectId), canProjects, lookupProjectName);
    const pageCount = Math.max(1, Math.ceil(projectTotal / 20));
    const taskPages = Math.max(1, Math.ceil(taskTotal / RELATION_PAGE_SIZE));

    async function moveTask(task: Task, next: TaskStatus) {
        if (next === task.status) return;
        try {
            const updated = await delivery.tasks.update(task.id, { status: next });
            setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setMessage(failure.message);
        }
    }

    return (
        <AppShell>
            <PageHeader
                title="Projects"
                subtitle={loading ? "Loading projects…" : `${projectTotal} projects`}
                actions={canCreateProject ? (
                    <Button size="sm" onClick={() => setProjectEditor("new")}>
                        <Plus className="h-4 w-4" /> New project
                    </Button>
                ) : null}
            />
            {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
            <div className="flex flex-wrap gap-2">
                <Input className="max-w-xs" placeholder="Search projects…" value={search} onChange={(event) => setSearch(event.target.value)} />
                <select aria-label="Project status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value as ProjectStatus | ""); setProjectPage(1); }}>
                    <option value="">All statuses</option>
                    {PROJECT_STATUSES.map((option) => <option key={option}>{option}</option>)}
                </select>
                <select aria-label="Project priority" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={priority} onChange={(event) => { setPriority(event.target.value as Priority | ""); setProjectPage(1); }}>
                    <option value="">All priorities</option>
                    {PRIORITIES.map((option) => <option key={option}>{option}</option>)}
                </select>
                <div className="min-w-56">
                    <RelationPicker label="Client" value={clientId} emptyLabel="All clients" enabled={canClients} selectedLabel={clientLabels[clientId]} load={loadClientOptions} onChange={(id) => { setClientId(id); setProjectPage(1); }} unavailable="Client filter needs client access." />
                </div>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading projects…</p> : null}
            {!loading && projects.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No projects</p> : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                    <article key={project.id} className="surface p-4">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{project.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{linkedLabel(project.clientId, clientLabels, "Client name unavailable", "Client name unavailable")}</p>
                            </div>
                            <StatusPill status={project.status} />
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                            <StatusPill status={project.priority} />
                            <span>Due {formatDay(project.dueDate)}</span>
                        </div>
                        {canUpdateProject ? <Button className="mt-3" size="sm" variant="outline" onClick={() => setProjectEditor(project)}>Edit</Button> : null}
                    </article>
                ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Page {projectPage} of {pageCount}</span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={projectPage <= 1} onClick={() => setProjectPage((current) => current - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={projectPage >= pageCount} onClick={() => setProjectPage((current) => current + 1)}>Next</Button>
                </div>
            </div>

            <Tabs defaultValue="kanban" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <TabsList>
                        <TabsTrigger value="kanban">Kanban</TabsTrigger>
                        <TabsTrigger value="list">List</TabsTrigger>
                        <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    </TabsList>
                    {canCreateTask ? <Button size="sm" onClick={() => setTaskEditor("new")}><Plus className="h-4 w-4" /> New task</Button> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="min-w-56">
                        <RelationPicker label="Task project" value={taskProjectId} emptyLabel="All projects" enabled={canProjects} selectedLabel={projectLabels[taskProjectId]} load={loadProjectOptions} onChange={(id) => { setTaskProjectId(id); setTaskPage(1); }} />
                    </div>
                    <select aria-label="Task status" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={taskStatus} onChange={(event) => { setTaskStatus(event.target.value as TaskStatus | ""); setTaskPage(1); }}>
                        <option value="">All statuses</option>
                        {TASK_STATUSES.map((option) => <option key={option}>{option}</option>)}
                    </select>
                    <select aria-label="Task priority" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={taskPriority} onChange={(event) => { setTaskPriority(event.target.value as Priority | ""); setTaskPage(1); }}>
                        <option value="">All priorities</option>
                        {PRIORITIES.map((option) => <option key={option}>{option}</option>)}
                    </select>
                    <Input type="date" aria-label="Due from" value={dueFrom} onChange={(event) => { setDueFrom(event.target.value); setTaskPage(1); }} />
                    <Input type="date" aria-label="Due to" value={dueTo} onChange={(event) => { setDueTo(event.target.value); setTaskPage(1); }} />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={(event) => { setMine(event.target.checked); setTaskPage(1); }} /> Assigned to me</label>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Tasks · page {taskPage} of {taskPages} · {taskTotal} matching the current filters</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={taskPage <= 1} onClick={() => setTaskPage((current) => current - 1)}>Previous</Button>
                        <Button variant="outline" size="sm" disabled={taskPage >= taskPages} onClick={() => setTaskPage((current) => current + 1)}>Next</Button>
                    </div>
                </div>
                <TabsContent value="kanban">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {TASK_STATUSES.map((column) => {
                            const columnTasks = tasks.filter((task) => task.status === column);
                            return (
                                <div key={column} className="rounded-xl bg-muted/50 p-2">
                                    <div className="mb-2 flex items-center justify-between px-1">
                                        <p className="text-sm font-semibold">{column}</p>
                                        <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">{columnTasks.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {columnTasks.map((task) => (
                                            <article key={task.id} className="surface p-3">
                                                <p className="text-sm font-medium leading-snug">{task.title}</p>
                                                <p className="mt-1 text-xs text-muted-foreground">{linkedLabel(task.projectId, projectLabels, "Project name unavailable", "Project name unavailable")}</p>
                                                <div className="mt-3 flex items-center justify-between gap-2">
                                                    <StatusPill status={task.priority} />
                                                    <span className="text-[11px] text-muted-foreground">{task.dueDate ? formatDay(task.dueDate) : "No due date"}</span>
                                                </div>
                                                {canUpdateTask ? (
                                                    <select aria-label={`Status for ${task.title}`} className="mt-2 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs" value={task.status} onChange={(event) => void moveTask(task, event.target.value as TaskStatus)}>
                                                        {TASK_STATUSES.map((option) => <option key={option}>{option}</option>)}
                                                    </select>
                                                ) : null}
                                                {canUpdateTask ? <Button className="mt-2" size="sm" variant="ghost" onClick={() => setTaskEditor(task)}>Edit</Button> : null}
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
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
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Start</TableHead>
                                        <TableHead>Due</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {projects.map((project) => (
                                        <TableRow key={project.id}>
                                            <TableCell className="font-medium">{project.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{linkedLabel(project.clientId, clientLabels, "Client name unavailable", "Client name unavailable")}</TableCell>
                                            <TableCell><StatusPill status={project.priority} /></TableCell>
                                            <TableCell className="text-muted-foreground">{formatDay(project.startDate)}</TableCell>
                                            <TableCell className="text-muted-foreground">{formatDay(project.dueDate)}</TableCell>
                                            <TableCell><StatusPill status={project.status} /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Panel>
                </TabsContent>
                <TabsContent value="timeline">
                    <Panel title="Delivery timeline" description="Start and due dates">
                        <div className="space-y-4">
                            {projects.map((project) => (
                                <div key={project.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:grid-cols-[180px_1fr]">
                                    <p className="truncate text-sm">{project.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatDay(project.startDate)} – {formatDay(project.dueDate)}</p>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </TabsContent>
            </Tabs>
            <ProjectDialog
                open={projectEditor !== null}
                project={projectEditor === "new" ? null : projectEditor}
                canClients={canClients}
                onOpenChange={(open) => { if (!open) setProjectEditor(null); }}
                onSaved={() => { setProjectEditor(null); setRevision((current) => current + 1); }}
            />
            <TaskDialog
                open={taskEditor !== null}
                task={taskEditor === "new" ? null : taskEditor}
                canProjects={canProjects}
                userId={auth.user?.id ?? null}
                onOpenChange={(open) => { if (!open) setTaskEditor(null); }}
                onSaved={() => { setTaskEditor(null); setRevision((current) => current + 1); }}
            />
        </AppShell>
    );
}

function ProjectDialog({ open, project, canClients, onOpenChange, onSaved }: { open: boolean; project: Project | null; canClients: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const [draft, setDraft] = useState<ProjectDraft>(newProjectDraft());
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const clientLabels = useResolvedLabels([draft.clientId], canClients, lookupClientName);
    useEffect(() => {
        setDraft(project ? { code: project.code, name: project.name, description: project.description, clientId: project.clientId, status: project.status, priority: project.priority, startDate: project.startDate, dueDate: project.dueDate } : newProjectDraft());
        setFields({});
        setMessage(null);
    }, [project, open]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        const missingClient = requireRelation(draft.clientId, "client");
        if (missingClient) {
            setFields({ clientId: missingClient });
            setMessage(null);
            return;
        }
        setSaving(true);
        setMessage(null);
        const body = { ...draft, code: draft.code.trim(), name: draft.name.trim(), description: draft.description.trim() };
        try {
            if (project) await delivery.projects.update(project.id, body);
            else await delivery.projects.create(body);
            onSaved();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setFields(failure.fields);
            setMessage(Object.keys(failure.fields).length > 0 ? null : failure.message);
        } finally {
            setSaving(false);
        }
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <Field label="Code" value={draft.code} error={fields.code} onChange={(code) => setDraft({ ...draft, code })} />
                    <Field label="Name" value={draft.name} error={fields.name} onChange={(name) => setDraft({ ...draft, name })} />
                    <Field label="Description" value={draft.description} error={fields.description} onChange={(description) => setDraft({ ...draft, description })} required={false} />
                    <RelationPicker label="Client" value={draft.clientId} emptyLabel="Choose a client" required enabled={canClients} selectedLabel={clientLabels[draft.clientId]} load={loadClientOptions} onChange={(clientId) => setDraft({ ...draft, clientId })} unavailable="Choosing a client needs client access." />
                    {fields.clientId ? <p className="text-xs text-destructive">{fields.clientId}</p> : null}
                    <label className="block text-xs text-muted-foreground">Status
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ProjectStatus })}>
                            {PROJECT_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <label className="block text-xs text-muted-foreground">Priority
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>
                            {PRIORITIES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <Field label="Start" type="date" value={draft.startDate} error={fields.startDate} onChange={(startDate) => setDraft({ ...draft, startDate })} />
                    <Field label="Due" type="date" value={draft.dueDate} error={fields.dueDate} onChange={(dueDate) => setDraft({ ...draft, dueDate })} />
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function TaskDialog({ open, task, canProjects, userId, onOpenChange, onSaved }: { open: boolean; task: Task | null; canProjects: boolean; userId: string | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
    const auth = useAuth();
    const [draft, setDraft] = useState<TaskDraft>(newTaskDraft());
    const [fields, setFields] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const projectLabels = useResolvedLabels([draft.projectId], canProjects, lookupProjectName);
    useEffect(() => {
        setDraft(task ? { projectId: task.projectId, title: task.title, description: task.description, status: task.status, priority: task.priority, dueDate: task.dueDate ?? "", assigneeUserId: task.assigneeUserId } : newTaskDraft());
        setFields({});
        setMessage(null);
    }, [task, open]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        const missingProject = requireRelation(draft.projectId, "project");
        if (missingProject) {
            setFields({ projectId: missingProject });
            setMessage(null);
            return;
        }
        setSaving(true);
        const body: TaskDraft = { ...draft, title: draft.title.trim(), description: draft.description.trim(), dueDate: draft.dueDate || null };
        try {
            if (task) await delivery.tasks.update(task.id, body);
            else await delivery.tasks.create(body);
            onSaved();
        } catch (error) {
            const failure = apiFailure(error);
            if (failure.status === 401) void auth.refresh();
            setFields(failure.fields);
            setMessage(Object.keys(failure.fields).length > 0 ? null : failure.message);
        } finally {
            setSaving(false);
        }
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
                <form className="space-y-3" onSubmit={(event) => void submit(event)}>
                    {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
                    <RelationPicker label="Project" value={draft.projectId} emptyLabel="Choose a project" required enabled={canProjects} selectedLabel={projectLabels[draft.projectId]} load={loadProjectOptions} onChange={(projectId) => setDraft({ ...draft, projectId })} unavailable="Choosing a project needs project access." />
                    {fields.projectId ? <p className="text-xs text-destructive">{fields.projectId}</p> : null}
                    <Field label="Title" value={draft.title} error={fields.title} onChange={(title) => setDraft({ ...draft, title })} />
                    <Field label="Description" value={draft.description} error={fields.description} onChange={(description) => setDraft({ ...draft, description })} required={false} />
                    <label className="block text-xs text-muted-foreground">Status
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as TaskStatus })}>
                            {TASK_STATUSES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <label className="block text-xs text-muted-foreground">Priority
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>
                            {PRIORITIES.map((option) => <option key={option}>{option}</option>)}
                        </select>
                    </label>
                    <Field label="Due" type="date" value={draft.dueDate ?? ""} error={fields.dueDate} onChange={(dueDate) => setDraft({ ...draft, dueDate })} required={false} />
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={draft.assigneeUserId === userId && userId !== null} onChange={(event) => setDraft({ ...draft, assigneeUserId: event.target.checked ? userId : null })} />
                        Assign to me
                    </label>
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, value, error, type = "text", required = true, onChange }: { label: string; value: string; error?: string; type?: string; required?: boolean; onChange: (value: string) => void }) {
    return (
        <div>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input className="mt-1" type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
    );
}
