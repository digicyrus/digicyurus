import { api } from "./api";

export const SUPER_ADMIN_ROLE = "Super Admin";
export const PROTECTED_ROLE_KEY = "super_admin";
export const NOTIFICATION_CATEGORIES = ["invoices", "proposals", "agreements", "assets", "tasks"] as const;
export const NOTIFICATION_DELIVERY_NOTE = "Notification delivery is unavailable. Email, SMS, push, and in-app delivery are not implemented. Turning a preference on does not send a notification.";

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type CompanyProfile = {
    id: string;
    legalName: string;
    brandName: string;
    gstin: string | null;
    billingEmail: string | null;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    updatedAt: string;
};

export type CompanyForm = {
    legalName: string;
    brandName: string;
    gstin: string;
    billingEmail: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
};

export type CompanyUpdate = {
    legalName: string;
    brandName: string;
    gstin: string | null;
    billingEmail: string | null;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
};

export type SettingsRole = {
    id: string;
    key: string;
    name: string;
    system: boolean;
    permissions: string[];
};

export type NotificationPreferences = {
    delivery: "unavailable";
    channels: string[];
    categories: Record<NotificationCategory, boolean>;
};

export type Checked<T> = { ok: true; body: T } | { ok: false; message: string; fields: Record<string, string> };

type SessionIdentity = {
    role?: string | null;
    permissions?: readonly string[];
} | null | undefined;

type RequestClient = {
    request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
};

export function isSuperAdmin(role: string | null | undefined): boolean {
    return role === SUPER_ADMIN_ROLE;
}

export function canViewCompany(permissions: readonly string[]): boolean {
    return permissions.includes("settings:view");
}

export function canEditCompany(user: SessionIdentity): boolean {
    return Boolean(user && isSuperAdmin(user.role) && user.permissions?.includes("settings:update"));
}

export function canViewRoles(permissions: readonly string[]): boolean {
    return permissions.includes("roles:view");
}

export function canEditRolePermissions(user: SessionIdentity, role: { key: string } | null): boolean {
    return Boolean(user && isSuperAdmin(user.role) && user.permissions?.includes("roles:update") && role && role.key !== PROTECTED_ROLE_KEY);
}

export function blankCompanyForm(): CompanyForm {
    return {
        legalName: "",
        brandName: "",
        gstin: "",
        billingEmail: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
    };
}

export function companyFormFrom(profile: CompanyProfile): CompanyForm {
    return {
        legalName: profile.legalName,
        brandName: profile.brandName,
        gstin: profile.gstin ?? "",
        billingEmail: profile.billingEmail ?? "",
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        postalCode: profile.postalCode,
        country: profile.country,
    };
}

function limited(value: string, field: string, max: number, fields: Record<string, string>, label: string): string {
    const trimmed = value.trim();
    if (trimmed.length > max) fields[field] = `Use at most ${max} characters`;
    if (!trimmed && (field === "legalName" || field === "brandName")) fields[field] = `Enter a ${label}`;
    return trimmed;
}

export function companyBody(input: CompanyForm): Checked<CompanyUpdate> {
    const fields: Record<string, string> = {};
    const legalName = limited(input.legalName, "legalName", 200, fields, "name");
    const brandName = limited(input.brandName, "brandName", 200, fields, "name");
    const addressLine1 = limited(input.addressLine1, "addressLine1", 200, fields, "address");
    const addressLine2 = limited(input.addressLine2, "addressLine2", 200, fields, "address");
    const city = limited(input.city, "city", 80, fields, "city");
    const state = limited(input.state, "state", 80, fields, "state");
    const postalCode = limited(input.postalCode, "postalCode", 12, fields, "postal code");
    const country = limited(input.country, "country", 80, fields, "country");
    const gstin = input.gstin.trim().toUpperCase();
    const billingEmail = input.billingEmail.trim().toLowerCase();
    if (gstin && !GSTIN_PATTERN.test(gstin)) fields.gstin = "Enter a valid GSTIN";
    if (billingEmail && !EMAIL_PATTERN.test(billingEmail)) fields.billingEmail = "Enter a valid email";
    if (Object.keys(fields).length > 0) return { ok: false, message: "Check the company profile", fields };
    return {
        ok: true,
        body: {
            legalName,
            brandName,
            gstin: gstin || null,
            billingEmail: billingEmail || null,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
        },
    };
}

export function permissionCatalog(roles: readonly Pick<SettingsRole, "key" | "permissions">[]): string[] | null {
    const superAdmin = roles.find((role) => role.key === PROTECTED_ROLE_KEY);
    if (!superAdmin) return null;
    return [...superAdmin.permissions].sort();
}

export function rolePermissionBody(selected: readonly string[], catalog: readonly string[]): Checked<{ permissions: string[] }> {
    const unique = [...new Set(selected.map((key) => key.trim()).filter(Boolean))];
    const unknown = unique.filter((key) => !catalog.includes(key));
    if (unknown.length > 0) {
        return { ok: false, message: "Check the permissions", fields: { permissions: "Unknown permission" } };
    }
    return { ok: true, body: { permissions: unique.sort() } };
}

export function blankNotificationCategories(): Record<NotificationCategory, boolean> {
    return { invoices: false, proposals: false, agreements: false, assets: false, tasks: false };
}

export function notificationCategoriesFrom(input: Partial<Record<NotificationCategory, boolean>> | null | undefined): Record<NotificationCategory, boolean> {
    const categories = blankNotificationCategories();
    for (const key of NOTIFICATION_CATEGORIES) {
        const value = input?.[key];
        if (typeof value === "boolean") categories[key] = value;
    }
    return categories;
}

export function notificationBody(categories: Record<NotificationCategory, boolean>): { categories: Record<NotificationCategory, boolean> } {
    return {
        categories: {
            invoices: categories.invoices,
            proposals: categories.proposals,
            agreements: categories.agreements,
            assets: categories.assets,
            tasks: categories.tasks,
        },
    };
}

export function createSettingsApi(client: RequestClient) {
    return {
        company: {
            get() {
                return client.request<CompanyProfile>("/api/settings/company");
            },
            update(body: CompanyUpdate) {
                return client.request<CompanyProfile>("/api/settings/company", { method: "PATCH", body });
            },
        },
        roles: {
            list() {
                return client.request<{ roles: SettingsRole[] }>("/api/settings/roles");
            },
            get(id: string) {
                return client.request<SettingsRole>(`/api/settings/roles/${encodeURIComponent(id)}`);
            },
            replacePermissions(id: string, body: { permissions: string[] }) {
                return client.request<SettingsRole>(`/api/settings/roles/${encodeURIComponent(id)}/permissions`, { method: "PUT", body });
            },
        },
        notifications: {
            get() {
                return client.request<NotificationPreferences>("/api/settings/notifications");
            },
            update(body: { categories: Record<NotificationCategory, boolean> }) {
                return client.request<NotificationPreferences>("/api/settings/notifications", { method: "PUT", body });
            },
        },
    };
}

export const settingsApi = createSettingsApi(api);
