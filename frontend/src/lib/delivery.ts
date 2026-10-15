import { api } from "./api";
import { toQuery, type Page } from "./crm";

export const PROJECT_STATUSES = ["On Track", "At Risk", "Delayed", "Completed"] as const;
export const TASK_STATUSES = ["Backlog", "In Progress", "Review", "Done"] as const;
export const PRIORITIES = ["High", "Medium", "Low"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export type Project = {
    id: string;
    code: string;
    name: string;
    description: string;
    clientId: string;
    managerEmployeeId: string | null;
    status: ProjectStatus;
    priority: Priority;
    startDate: string;
    dueDate: string;
    createdAt: string;
    updatedAt: string;
};

export type Task = {
    id: string;
    projectId: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    dueDate: string | null;
    assigneeEmployeeId: string | null;
    assigneeUserId: string | null;
    createdAt: string;
    updatedAt: string;
};

export type PlannerEntry = {
    id: string;
    title: string;
    entryDate: string;
    time: string | null;
    done: boolean;
    tag: string | null;
    createdAt: string;
    updatedAt: string;
};

export type ProjectDraft = {
    code: string;
    name: string;
    description: string;
    clientId: string;
    status: ProjectStatus;
    priority: Priority;
    startDate: string;
    dueDate: string;
};

export type TaskDraft = {
    projectId: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    dueDate?: string | null;
    assigneeUserId?: string | null;
};

export type PlannerDraft = {
    title: string;
    entryDate: string;
    time?: string | null;
    done: boolean;
    tag?: string | null;
};

export function newProjectDraft(): ProjectDraft {
    return { code: "", name: "", description: "", clientId: "", status: "On Track", priority: "Medium", startDate: "", dueDate: "" };
}

export function newTaskDraft(): TaskDraft {
    return { projectId: "", title: "", description: "", status: "Backlog", priority: "Medium", dueDate: "", assigneeUserId: null };
}

export function taskListQuery(input: {
    page: number;
    pageSize: number;
    projectId: string;
    status: TaskStatus | "";
    priority: Priority | "";
    dueFrom: string;
    dueTo: string;
    assigneeUserId?: string;
}) {
    return {
        page: input.page,
        pageSize: input.pageSize,
        projectId: input.projectId || undefined,
        status: input.status || undefined,
        priority: input.priority || undefined,
        dueFrom: input.dueFrom || undefined,
        dueTo: input.dueTo || undefined,
        assigneeUserId: input.assigneeUserId,
    };
}

export function plannerTime(value: string | null | undefined): string | null {
    const text = (value ?? "").trim();
    if (!text) return null;
    const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(text);
    if (!match) return text;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return text;
    return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export function isoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

type RequestClient = {
    request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
};

export function createDeliveryApi(client: RequestClient) {
    return {
        projects: {
            list(query: { page?: number; pageSize?: number; search?: string; status?: ProjectStatus; priority?: Priority; clientId?: string } = {}) {
                return client.request<Page<Project>>(`/api/projects${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<Project>(`/api/projects/${encodeURIComponent(id)}`);
            },
            create(body: ProjectDraft) {
                return client.request<Project>("/api/projects", { method: "POST", body });
            },
            update(id: string, body: Partial<ProjectDraft> & { managerEmployeeId?: string | null }) {
                return client.request<Project>(`/api/projects/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
        tasks: {
            list(query: { page?: number; pageSize?: number; search?: string; projectId?: string; assigneeUserId?: string; status?: TaskStatus; priority?: Priority; dueFrom?: string; dueTo?: string } = {}) {
                return client.request<Page<Task>>(`/api/tasks${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<Task>(`/api/tasks/${encodeURIComponent(id)}`);
            },
            create(body: TaskDraft) {
                return client.request<Task>("/api/tasks", { method: "POST", body });
            },
            update(id: string, body: Partial<TaskDraft>) {
                return client.request<Task>(`/api/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
        planner: {
            list(query: { from: string; to: string }) {
                return client.request<{ items: PlannerEntry[]; from: string; to: string }>(`/api/planner${toQuery(query)}`);
            },
            create(body: PlannerDraft) {
                return client.request<PlannerEntry>("/api/planner", { method: "POST", body });
            },
            update(id: string, body: Partial<PlannerDraft>) {
                return client.request<PlannerEntry>(`/api/planner/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
    };
}

export const delivery = createDeliveryApi(api);
