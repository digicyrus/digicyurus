import { api } from "./api";
import { apiFailure, toQuery } from "./crm";

export type CountMap = Record<string, number>;

export type LeadInsight = {
    total: number;
    byStage: CountMap;
    bySource: CountMap;
    value: number;
};

export type StatusInsight = {
    total: number;
    byStatus: CountMap;
};

export type FinanceMonth = {
    month: string;
    revenue: number;
    expenses: number;
    inflow: number;
    outflow: number;
};

export type FinanceInsight = {
    issued: number;
    collected: number;
    outstanding: number;
    expenses: number;
    profit: number;
    tax?: number;
    months?: FinanceMonth[];
};

export type CampaignInsight = {
    total: number;
    spend: number;
    leads: number;
};

export type ReferralInsight = {
    total: number;
    revenue: number;
    commission: number;
};

export type ServiceRateInsight = {
    total: number;
    active: number;
};

export type InsightView = {
    clients: number | null;
    leads: LeadInsight | null;
    projects: StatusInsight | null;
    tasks: StatusInsight | null;
    followUps: StatusInsight | null;
    finance: FinanceInsight | null;
    employees: number | null;
    campaigns: CampaignInsight | null;
    content: StatusInsight | null;
    referrals: ReferralInsight | null;
    serviceRates: ServiceRateInsight | null;
    attendance: number | null;
};

export type ProjectsReport = StatusInsight & {
    tasks: StatusInsight | null;
};

export type MarketingReport = {
    campaigns: CampaignInsight;
    content: StatusInsight | null;
};

export type HrReport = {
    employees: number | null;
    attendance: number | null;
};

export type ReportRange = {
    from?: string;
    to?: string;
};

export function availableSections(view: InsightView): string[] {
    return Object.entries(view).filter((entry) => entry[1] !== null).map(([key]) => key);
}

export function canViewDashboard(permissions: readonly string[]): boolean {
    return permissions.includes("dashboard:view");
}

export function canViewReports(permissions: readonly string[]): boolean {
    return permissions.includes("reports:view");
}

export function canViewFinanceReport(permissions: readonly string[]): boolean {
    return canViewReports(permissions) && permissions.includes("finance:view");
}

export function canViewSalesReport(permissions: readonly string[]): boolean {
    return canViewReports(permissions) && permissions.includes("leads:view");
}

export function canViewProjectsReport(permissions: readonly string[]): boolean {
    return canViewReports(permissions) && permissions.includes("projects:view");
}

export function canViewMarketingReport(permissions: readonly string[]): boolean {
    return canViewReports(permissions) && permissions.includes("campaigns:view");
}

export function canViewHrReport(permissions: readonly string[]): boolean {
    return canViewReports(permissions) && (permissions.includes("employees:view") || permissions.includes("attendance:view"));
}

export type ReportSectionState<T> =
    | { status: "loading" }
    | { status: "unavailable" }
    | { status: "success"; data: T }
    | { status: "error"; statusCode: number; message: string };

export async function loadReportSection<T>(allowed: boolean, request: () => Promise<T>): Promise<Exclude<ReportSectionState<T>, { status: "loading" }>> {
    if (!allowed) return { status: "unavailable" };
    try {
        return { status: "success", data: await request() };
    } catch (error) {
        const failure = apiFailure(error);
        return { status: "error", statusCode: failure.status, message: failure.message };
    }
}

export function isCurrentReportRequest(requestId: number, currentId: number): boolean {
    return requestId === currentId;
}

type RequestClient = {
    request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
};

export function createInsightsApi(client: RequestClient) {
    const range = (query: ReportRange) => toQuery(query);
    return {
        dashboard() {
            return client.request<InsightView>("/api/dashboard/summary");
        },
        reports: {
            overview(query: ReportRange = {}) {
                return client.request<InsightView>(`/api/reports/overview${range(query)}`);
            },
            finance(query: ReportRange = {}) {
                return client.request<FinanceInsight>(`/api/reports/finance${range(query)}`);
            },
            sales(query: ReportRange = {}) {
                return client.request<LeadInsight>(`/api/reports/sales${range(query)}`);
            },
            projects(query: ReportRange = {}) {
                return client.request<ProjectsReport>(`/api/reports/projects${range(query)}`);
            },
            marketing(query: ReportRange = {}) {
                return client.request<MarketingReport>(`/api/reports/marketing${range(query)}`);
            },
            hr(query: ReportRange = {}) {
                return client.request<HrReport>(`/api/reports/hr${range(query)}`);
            },
        },
    };
}

export const insights = createInsightsApi(api);
