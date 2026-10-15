import { crm } from "./crm";
import { delivery } from "./delivery";
import { hr } from "./hr";

export const RELATION_PAGE_SIZE = 20;

export type RelationOption = { id: string; label: string };

export type RelationPage = {
    items: RelationOption[];
    page: number;
    pageSize: number;
    total: number;
};

export function blankRelation(): "" {
    return "";
}

export function requireRelation(id: string, noun: string): string | null {
    return id.trim() ? null : `Choose a ${noun}`;
}

export function hasMore(page: number, pageSize: number, total: number): boolean {
    return page * pageSize < total;
}

export function appendOptions(current: RelationOption[], incoming: RelationOption[]): RelationOption[] {
    const options = new Map(current.map((option) => [option.id, option]));
    for (const option of incoming) options.set(option.id, option);
    return [...options.values()];
}

export function displayOptions(options: RelationOption[], selected: RelationOption | null): RelationOption[] {
    if (!selected?.id) return options;
    if (!options.some((option) => option.id === selected.id)) return [selected, ...options];
    return options.map((option) => option.id === selected.id ? selected : option);
}

export function linkedLabel(id: string | null | undefined, labels: Readonly<Record<string, string | null>>, unlinked: string, unavailable: string): string {
    if (!id) return unlinked;
    if (!(id in labels)) return "Loading name…";
    return labels[id] ?? unavailable;
}

export function canBrowseClients(permissions: readonly string[]): boolean {
    return permissions.includes("clients:view");
}

export function canBrowseProjects(permissions: readonly string[]): boolean {
    return permissions.includes("projects:view");
}

export function canBrowseEmployees(permissions: readonly string[]): boolean {
    return permissions.includes("employees:view");
}

export function canBrowseLeads(permissions: readonly string[]): boolean {
    return permissions.includes("leads:view");
}

export async function loadClientOptions(query: { page: number; pageSize: number; search?: string }): Promise<RelationPage> {
    const page = await crm.clients.list({ page: query.page, pageSize: query.pageSize, search: query.search || undefined });
    return { page: page.page, pageSize: page.pageSize, total: page.total, items: page.items.map((client) => ({ id: client.id, label: client.name })) };
}

export async function loadProjectOptions(query: { page: number; pageSize: number; search?: string; clientId?: string }): Promise<RelationPage> {
    const page = await delivery.projects.list({
        page: query.page,
        pageSize: query.pageSize,
        search: query.search || undefined,
        clientId: query.clientId || undefined,
    });
    return { page: page.page, pageSize: page.pageSize, total: page.total, items: page.items.map((project) => ({ id: project.id, label: project.name })) };
}

export async function loadEmployeeOptions(query: { page: number; pageSize: number; search?: string }): Promise<RelationPage> {
    const page = await hr.employees.list({ page: query.page, pageSize: query.pageSize, search: query.search || undefined });
    return { page: page.page, pageSize: page.pageSize, total: page.total, items: page.items.map((employee) => ({ id: employee.id, label: employee.name })) };
}

export function lookupClientName(id: string): Promise<string> {
    return crm.clients.get(id).then((client) => client.name);
}

export function lookupProjectName(id: string): Promise<string> {
    return delivery.projects.get(id).then((project) => project.name);
}

export function lookupEmployeeName(id: string): Promise<string> {
    return hr.employees.get(id).then((employee) => employee.name);
}

export async function loadLeadOptions(query: { page: number; pageSize: number; search?: string }): Promise<RelationPage> {
    const page = await crm.leads.list({ page: query.page, pageSize: query.pageSize, search: query.search || undefined });
    return { page: page.page, pageSize: page.pageSize, total: page.total, items: page.items.map((lead) => ({ id: lead.id, label: `${lead.company} · ${lead.person}` })) };
}

export function lookupLeadName(id: string): Promise<string> {
    return crm.leads.get(id).then((lead) => `${lead.company} · ${lead.person}`);
}
