import { api } from "./api";
import { toQuery, type Page } from "./crm";

export const ASSET_TYPES = ["Domain", "Hosting", "SSL", "License", "Subscription"] as const;
export const ASSET_STATUSES = ["Active", "Due Soon"] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export type Asset = {
    id: string;
    name: string;
    type: AssetType;
    vendor: string;
    renewal: string;
    cost: number;
    status: AssetStatus;
    createdAt: string;
    updatedAt: string;
};

export type AssetDraft = {
    name: string;
    type: AssetType;
    vendor: string;
    renewal: string;
    cost: number;
    status: AssetStatus;
};

export type Checked<T> = { ok: true; body: T } | { ok: false; message: string; fields: Record<string, string> };

export function wholeRupees(value: string): number | null {
    const text = value.trim();
    if (!/^\d+$/.test(text)) return null;
    const amount = Number(text);
    return Number.isSafeInteger(amount) ? amount : null;
}

export function canViewAssets(permissions: readonly string[]): boolean {
    return permissions.includes("assets:view");
}

export function canCreateAssets(permissions: readonly string[]): boolean {
    return permissions.includes("assets:create");
}

export function canUpdateAssets(permissions: readonly string[]): boolean {
    return permissions.includes("assets:update");
}

export function assetBody(input: { name: string; type: AssetType; vendor: string; renewal: string; cost: string; status: AssetStatus }): Checked<AssetDraft> {
    const fields: Record<string, string> = {};
    const cost = wholeRupees(input.cost);
    if (!input.name.trim()) fields.name = "Enter a name";
    if (!input.vendor.trim()) fields.vendor = "Enter a vendor";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.renewal)) fields.renewal = "Enter a valid date";
    if (cost === null) fields.cost = "Enter a whole number of rupees";
    if (Object.keys(fields).length > 0 || cost === null) return { ok: false, message: "Check the asset", fields };
    return {
        ok: true,
        body: {
            name: input.name.trim(),
            vendor: input.vendor.trim(),
            type: input.type,
            renewal: input.renewal,
            cost,
            status: input.status,
        },
    };
}

type RequestClient = {
    request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
};

export function createAssetsApi(client: RequestClient) {
    return {
        list(query: { page?: number; pageSize?: number; search?: string; type?: AssetType; status?: AssetStatus; from?: string; to?: string } = {}) {
            return client.request<Page<Asset>>(`/api/assets${toQuery(query)}`);
        },
        get(id: string) {
            return client.request<Asset>(`/api/assets/${encodeURIComponent(id)}`);
        },
        create(body: AssetDraft) {
            return client.request<Asset>("/api/assets", { method: "POST", body });
        },
        update(id: string, body: Partial<AssetDraft>) {
            return client.request<Asset>(`/api/assets/${encodeURIComponent(id)}`, { method: "PATCH", body });
        },
    };
}

export const assetsApi = createAssetsApi(api);
