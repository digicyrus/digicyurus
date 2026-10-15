import { api } from "./api";
import { toQuery, type Page } from "./crm";

export const CAMPAIGN_STATUSES = ["Running", "Paused"] as const;
export const CONTENT_STATUSES = ["Draft", "Scheduled", "Published"] as const;
export const REFERRAL_STATUSES = ["Pending", "Paid"] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export type Campaign = {
    id: string;
    name: string;
    channel: string;
    spend: number;
    leads: number;
    roi: number;
    status: CampaignStatus;
    createdAt: string;
    updatedAt: string;
};

export type ContentItem = {
    id: string;
    title: string;
    channel: string;
    date: string;
    status: ContentStatus;
    createdAt: string;
    updatedAt: string;
};

export type Referral = {
    id: string;
    code: string;
    partner: string;
    clientId: string | null;
    deals: number;
    revenue: number;
    commission: number;
    status: ReferralStatus;
    createdAt: string;
    updatedAt: string;
};

export type ServiceRate = {
    id: string;
    name: string;
    description: string;
    unit: string;
    rate: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
};

export type CampaignDraft = {
    name: string;
    channel: string;
    spend: number;
    leads: number;
    roi: number;
    status: CampaignStatus;
};

export type ContentDraft = {
    title: string;
    channel: string;
    date: string;
    status: ContentStatus;
};

export type ReferralDraft = {
    code: string;
    partner: string;
    clientId: string | null;
    deals: number;
    revenue: number;
    commission: number;
    status: ReferralStatus;
};

export type ServiceRateDraft = {
    name: string;
    description: string;
    unit: string;
    rate: number;
    active: boolean;
};

export type Checked<T> = { ok: true; body: T } | { ok: false; message: string; fields: Record<string, string> };

export function wholeRupees(value: string): number | null {
    const text = value.trim();
    if (!/^\d+$/.test(text)) return null;
    const amount = Number(text);
    return Number.isSafeInteger(amount) ? amount : null;
}

export function parseRoi(value: string): number | null {
    const match = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(value.trim());
    if (!match?.[1]) return null;
    const hundredths = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
    if (!Number.isSafeInteger(hundredths) || hundredths > 100_000) return null;
    return hundredths / 100;
}

export function formatRoi(value: number): string {
    const hundredths = Math.round(value * 100);
    const whole = Math.trunc(hundredths / 100);
    const fraction = Math.abs(hundredths % 100);
    if (fraction === 0) return String(whole);
    return `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}

export function canManageCampaigns(permissions: readonly string[]): boolean {
    return permissions.includes("campaigns:view");
}

export function canManageContent(permissions: readonly string[]): boolean {
    return permissions.includes("content:view");
}

export function canViewReferrals(permissions: readonly string[]): boolean {
    return permissions.includes("referrals:view");
}

export function canCreateReferrals(permissions: readonly string[]): boolean {
    return permissions.includes("referrals:create");
}

export function canUpdateReferrals(permissions: readonly string[]): boolean {
    return permissions.includes("referrals:update");
}

export function canViewServiceRates(permissions: readonly string[]): boolean {
    return permissions.includes("service_rates:view");
}

export function canUpdateServiceRates(permissions: readonly string[]): boolean {
    return permissions.includes("service_rates:update");
}

export function campaignBody(input: {
    name: string;
    channel: string;
    spend: string;
    leads: string;
    roi: string;
    status: CampaignStatus;
}): Checked<CampaignDraft> {
    const fields: Record<string, string> = {};
    const spend = wholeRupees(input.spend);
    const leads = wholeRupees(input.leads);
    const roi = parseRoi(input.roi);
    if (!input.name.trim()) fields.name = "Enter a name";
    if (!input.channel.trim()) fields.channel = "Enter a channel";
    if (spend === null) fields.spend = "Enter a whole number of rupees";
    if (leads === null) fields.leads = "Enter a whole number";
    if (roi === null) fields.roi = "Enter a stored ROI with at most 2 decimal places";
    if (Object.keys(fields).length > 0 || spend === null || leads === null || roi === null) {
        return { ok: false, message: "Check the campaign", fields };
    }
    return {
        ok: true,
        body: {
            name: input.name.trim(),
            channel: input.channel.trim(),
            spend,
            leads,
            roi,
            status: input.status,
        },
    };
}

export function contentBody(input: { title: string; channel: string; date: string; status: ContentStatus }): Checked<ContentDraft> {
    const fields: Record<string, string> = {};
    if (!input.title.trim()) fields.title = "Enter a title";
    if (!input.channel.trim()) fields.channel = "Enter a channel";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) fields.date = "Enter a valid date";
    if (Object.keys(fields).length > 0) return { ok: false, message: "Check the content item", fields };
    return { ok: true, body: { title: input.title.trim(), channel: input.channel.trim(), date: input.date, status: input.status } };
}

export function referralBody(input: {
    code: string;
    partner: string;
    clientId: string;
    deals: string;
    revenue: string;
    commission: string;
    status: ReferralStatus;
}): Checked<ReferralDraft> {
    const fields: Record<string, string> = {};
    const deals = wholeRupees(input.deals);
    const revenue = wholeRupees(input.revenue);
    const commission = wholeRupees(input.commission);
    if (!input.code.trim()) fields.code = "Enter a code";
    if (!input.partner.trim()) fields.partner = "Enter a partner";
    if (deals === null) fields.deals = "Enter a whole number";
    if (revenue === null) fields.revenue = "Enter a whole number of rupees";
    if (commission === null) fields.commission = "Enter a whole number of rupees";
    if (Object.keys(fields).length > 0 || deals === null || revenue === null || commission === null) {
        return { ok: false, message: "Check the referral", fields };
    }
    return {
        ok: true,
        body: {
            code: input.code.trim(),
            partner: input.partner.trim(),
            clientId: input.clientId || null,
            deals,
            revenue,
            commission,
            status: input.status,
        },
    };
}

export function serviceRateBody(input: { name: string; description: string; unit: string; rate: string; active: boolean }): Checked<ServiceRateDraft> {
    const fields: Record<string, string> = {};
    const rate = wholeRupees(input.rate);
    if (!input.name.trim()) fields.name = "Enter a name";
    if (!input.unit.trim()) fields.unit = "Enter a unit";
    if (rate === null) fields.rate = "Enter a whole number of rupees";
    if (Object.keys(fields).length > 0 || rate === null) return { ok: false, message: "Check the service rate", fields };
    return {
        ok: true,
        body: {
            name: input.name.trim(),
            description: input.description.trim(),
            unit: input.unit.trim(),
            rate,
            active: input.active,
        },
    };
}

type RequestClient = {
    request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
};

export function createGrowthApi(client: RequestClient) {
    return {
        campaigns: {
            list(query: { page?: number; pageSize?: number; search?: string; status?: CampaignStatus; channel?: string } = {}) {
                return client.request<Page<Campaign>>(`/api/campaigns${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<Campaign>(`/api/campaigns/${encodeURIComponent(id)}`);
            },
            create(body: CampaignDraft) {
                return client.request<Campaign>("/api/campaigns", { method: "POST", body });
            },
            update(id: string, body: Partial<CampaignDraft>) {
                return client.request<Campaign>(`/api/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
        content: {
            list(query: { page?: number; pageSize?: number; search?: string; status?: ContentStatus; channel?: string; from?: string; to?: string } = {}) {
                return client.request<Page<ContentItem>>(`/api/content${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<ContentItem>(`/api/content/${encodeURIComponent(id)}`);
            },
            create(body: ContentDraft) {
                return client.request<ContentItem>("/api/content", { method: "POST", body });
            },
            update(id: string, body: Partial<ContentDraft>) {
                return client.request<ContentItem>(`/api/content/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
        referrals: {
            list(query: { page?: number; pageSize?: number; search?: string; status?: ReferralStatus; clientId?: string } = {}) {
                return client.request<Page<Referral>>(`/api/referrals${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<Referral>(`/api/referrals/${encodeURIComponent(id)}`);
            },
            create(body: ReferralDraft) {
                return client.request<Referral>("/api/referrals", { method: "POST", body });
            },
            update(id: string, body: Partial<ReferralDraft>) {
                return client.request<Referral>(`/api/referrals/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
        serviceRates: {
            list(query: { page?: number; pageSize?: number; search?: string; active?: "true" | "false" } = {}) {
                return client.request<Page<ServiceRate>>(`/api/service-rates${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<ServiceRate>(`/api/service-rates/${encodeURIComponent(id)}`);
            },
            create(body: ServiceRateDraft) {
                return client.request<ServiceRate>("/api/service-rates", { method: "POST", body });
            },
            update(id: string, body: Partial<ServiceRateDraft>) {
                return client.request<ServiceRate>(`/api/service-rates/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
        },
    };
}

export const growth = createGrowthApi(api);
