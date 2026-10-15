import { ApiError, api } from "./api";

export const CLIENT_STATUSES = ["Active", "On Hold", "Prospect"] as const;
export const LEAD_STAGES = [
    "New",
    "Contacted",
    "Qualified",
    "Meeting Scheduled",
    "Proposal Sent",
    "Negotiation",
    "Won",
    "Lost",
] as const;
export const LEAD_PRIORITIES = ["High", "Medium", "Low"] as const;
export const FOLLOW_UP_STATUSES = ["Due", "Missed", "Upcoming", "Completed"] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type LeadStage = (typeof LEAD_STAGES)[number];
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export type Client = {
    id: string;
    code: string;
    name: string;
    contactName: string;
    industry: string;
    status: ClientStatus;
    rating: number;
    customerSince: string;
    email: string | null;
    phone: string | null;
    lifetimeValue: number;
    createdAt: string;
    updatedAt: string;
};

export type Lead = {
    id: string;
    code: string;
    company: string;
    person: string;
    stage: LeadStage;
    value: number;
    source: string;
    priority: LeadPriority;
    closing: string;
    probability: number;
    clientId: string | null;
    createdAt: string;
    updatedAt: string;
};

export type FollowUp = {
    id: string;
    clientId: string | null;
    leadId: string | null;
    ownerEmployeeId: string;
    dueAt: string;
    status: FollowUpStatus;
    createdAt: string;
    updatedAt: string;
};

export type Page<T> = {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
};

export type ClientDraft = {
    code: string;
    name: string;
    contactName: string;
    industry: string;
    status: ClientStatus;
    rating: number;
    customerSince: string;
    email?: string;
    phone?: string;
};

export type LeadDraft = {
    code: string;
    company: string;
    person: string;
    value: number;
    source: string;
    priority: LeadPriority;
    closing: string;
    probability: number;
};

export type FollowUpDraft = {
    clientId?: string | null;
    leadId?: string | null;
    ownerEmployeeId: string;
    dueAt: string;
    status: FollowUpStatus;
};

type QueryValue = string | number | undefined;

export function toQuery(params: Record<string, QueryValue>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "") continue;
        search.set(key, String(value));
    }
    const text = search.toString();
    return text ? `?${text}` : "";
}

export function stageChangeBody(stage: LeadStage): { stage: LeadStage } {
    return { stage };
}

export function apiFailure(error: unknown): { status: number; message: string; fields: Record<string, string> } {
    if (error instanceof ApiError) {
        if (error.status === 401) return { status: 401, message: "Your session has ended. Sign in again.", fields: error.fields };
        if (error.status === 403) return { status: 403, message: "You do not have access to this.", fields: error.fields };
        return { status: error.status, message: error.message, fields: error.fields };
    }
    return { status: 0, message: "Could not reach the server", fields: {} };
}

export function formatDay(value: string): string {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

type RequestClient = {
    request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
};

export function createCrmApi(client: RequestClient) {
    return {
        clients: {
            list(query: { page?: number; pageSize?: number; search?: string; status?: ClientStatus; industry?: string } = {}) {
                return client.request<Page<Client>>(`/api/clients${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<Client>(`/api/clients/${encodeURIComponent(id)}`);
            },
            create(body: ClientDraft) {
                return client.request<Client>("/api/clients", { method: "POST", body });
            },
            update(id: string, body: Omit<ClientDraft, "email" | "phone"> & { email?: string | null; phone?: string | null }) {
                return client.request<Client>(`/api/clients/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
        leads: {
            list(query: { page?: number; pageSize?: number; search?: string; stage?: LeadStage; source?: string; priority?: LeadPriority } = {}) {
                return client.request<Page<Lead>>(`/api/leads${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<Lead>(`/api/leads/${encodeURIComponent(id)}`);
            },
            create(body: LeadDraft) {
                return client.request<Lead>("/api/leads", { method: "POST", body });
            },
            update(id: string, body: Partial<LeadDraft>) {
                return client.request<Lead>(`/api/leads/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
            moveStage(id: string, stage: LeadStage) {
                return client.request<Lead>(`/api/leads/${encodeURIComponent(id)}/stage`, { method: "PATCH", body: stageChangeBody(stage) });
            },
        },
        followUps: {
            list(query: { page?: number; pageSize?: number; clientId?: string; leadId?: string; status?: FollowUpStatus } = {}) {
                return client.request<Page<FollowUp>>(`/api/follow-ups${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<FollowUp>(`/api/follow-ups/${encodeURIComponent(id)}`);
            },
            create(body: FollowUpDraft) {
                return client.request<FollowUp>("/api/follow-ups", { method: "POST", body });
            },
            update(id: string, body: Partial<FollowUpDraft>) {
                return client.request<FollowUp>(`/api/follow-ups/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
    };
}

export const crm = createCrmApi(api);
