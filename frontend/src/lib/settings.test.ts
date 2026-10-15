import assert from "node:assert/strict";
import { test } from "vitest";

import { ApiError, createApiClient } from "./api";
import { apiFailure } from "./crm";
import {
    NOTIFICATION_DELIVERY_NOTE,
    PROTECTED_ROLE_KEY,
    canEditCompany,
    canEditRolePermissions,
    companyBody,
    companyFormFrom,
    createSettingsApi,
    notificationBody,
    notificationCategoriesFrom,
    permissionCatalog,
    rolePermissionBody,
    type CompanyProfile,
    type SettingsRole,
} from "./settings";

const profile: CompanyProfile = {
    id: "org-1",
    legalName: "DigiCyrus Technologies Pvt Ltd",
    brandName: "DigiCyrus",
    gstin: null,
    billingEmail: null,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    updatedAt: "2026-10-15T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("settings requests use the session cookie and surface validation and permission errors", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createSettingsApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            calls.push({ url, init });
            if (url.endsWith("/api/settings/company") && init?.method === "PATCH") {
                return jsonResponse({
                    data: null,
                    error: { code: "VALIDATION_ERROR", message: "Request validation failed", fields: { gstin: "Enter a valid GSTIN" } },
                }, 400);
            }
            if (url.endsWith("/permissions")) {
                return jsonResponse({
                    data: null,
                    error: { code: "FORBIDDEN", message: "Only a Super Admin can perform this action", fields: {} },
                }, 403);
            }
            return jsonResponse({ data: { id: "role-1", roles: [], channels: [], categories: {} }, error: null });
        },
    }));

    await client.company.get();
    assert.equal(calls[0]?.url, "http://localhost:4000/api/settings/company");
    assert.equal(calls[0]?.init?.credentials, "include");

    const form = companyFormFrom(profile);
    form.legalName = "DigiCyrus Technologies Pvt Ltd";
    form.brandName = "DigiCyrus";
    form.gstin = "27aapfu0939f1zv";
    form.billingEmail = "Billing@DigiCyrus.example";
    form.city = "Bengaluru";
    const company = companyBody(form);
    assert.equal(company.ok, true);
    if (!company.ok) return;
    assert.equal(company.body.gstin, "27AAPFU0939F1ZV");
    assert.equal(company.body.billingEmail, "billing@digicyrus.example");
    assert.equal("organizationId" in company.body, false);
    await assert.rejects(() => client.company.update(company.body), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(apiFailure(error).fields.gstin, "Enter a valid GSTIN");
        return true;
    });

    await client.roles.list();
    assert.equal(calls[2]?.url, "http://localhost:4000/api/settings/roles");
    await client.roles.get("role-1");
    assert.equal(calls[3]?.url, "http://localhost:4000/api/settings/roles/role-1");
    const permissions = rolePermissionBody(["assets:view", "dashboard:view"], ["assets:view", "dashboard:view", "roles:update"]);
    assert.equal(permissions.ok, true);
    if (!permissions.ok) return;
    assert.deepEqual(permissions.body, { permissions: ["assets:view", "dashboard:view"] });
    await assert.rejects(() => client.roles.replacePermissions("role-1", permissions.body), (error: unknown) => {
        assert.equal(apiFailure(error).status, 403);
        assert.equal(apiFailure(error).message, "You do not have access to this.");
        return true;
    });
    assert.equal(calls[4]?.init?.method, "PUT");

    const preferences = notificationBody({ invoices: true, proposals: false, agreements: false, assets: false, tasks: false });
    assert.equal("channels" in preferences, false);
    assert.equal("email" in preferences, false);
    await client.notifications.update(preferences);
    const sent = JSON.parse(String(calls[5]?.init?.body)) as { categories: { invoices: boolean }; channels?: string[] };
    assert.equal(sent.categories.invoices, true);
    assert.equal(sent.channels, undefined);
    assert.match(NOTIFICATION_DELIVERY_NOTE, /does not send a notification/);
});

test("company validation and edit permission follow the saved profile rules", () => {
    const missing = companyBody({ ...companyFormFrom(profile), legalName: " " });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.fields.legalName, "Enter a name");
    const invalid = companyBody({ ...companyFormFrom(profile), gstin: "27AAPFU0939F1A1", billingEmail: "not-an-email" });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
        assert.equal(invalid.fields.gstin, "Enter a valid GSTIN");
        assert.equal(invalid.fields.billingEmail, "Enter a valid email");
    }
    const cleared = companyBody({ ...companyFormFrom({ ...profile, gstin: "27AAPFU0939F1ZV", billingEmail: "billing@digicyrus.example" }), gstin: " ", billingEmail: "" });
    assert.equal(cleared.ok, true);
    if (cleared.ok) {
        assert.equal(cleared.body.gstin, null);
        assert.equal(cleared.body.billingEmail, null);
    }

    assert.equal(canEditCompany({ role: "Super Admin", permissions: ["settings:update"] }), true);
    assert.equal(canEditCompany({ role: "Admin", permissions: ["settings:update"] }), false);
    assert.equal(canEditCompany({ role: "Super Admin", permissions: ["settings:view"] }), false);
});

test("role editing uses the returned catalog and keeps Super Admin protected", () => {
    const roles: SettingsRole[] = [
        { id: "role-super", key: PROTECTED_ROLE_KEY, name: "Super Admin", system: true, permissions: ["roles:update", "assets:view"] },
        { id: "role-admin", key: "admin", name: "Admin", system: true, permissions: ["assets:view"] },
    ];
    assert.deepEqual(permissionCatalog(roles), ["assets:view", "roles:update"]);
    assert.equal(permissionCatalog(roles.filter((role) => role.key !== PROTECTED_ROLE_KEY)), null);

    const superAdmin = { role: "Super Admin", permissions: ["roles:update"] };
    assert.equal(canEditRolePermissions(superAdmin, roles[0] ?? null), false);
    assert.equal(canEditRolePermissions(superAdmin, roles[1] ?? null), true);
    assert.equal(canEditRolePermissions({ role: "Admin", permissions: ["roles:update"] }, roles[1] ?? null), false);

    const unknown = rolePermissionBody(["users:delete"], ["assets:view"]);
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.fields.permissions, "Unknown permission");
    assert.equal(apiFailure(new ApiError(409, "CONFLICT", "The Super Admin role cannot be changed")).message, "The Super Admin role cannot be changed");
    assert.deepEqual(notificationCategoriesFrom({ invoices: true }), {
        invoices: true,
        proposals: false,
        agreements: false,
        assets: false,
        tasks: false,
    });
});

test("saved settings responses replace the values shown in the form", async () => {
    const savedProfile: CompanyProfile = {
        ...profile,
        gstin: "27AAPFU0939F1ZV",
        billingEmail: "billing@digicyrus.example",
        city: "Bengaluru",
        updatedAt: "2026-10-15T08:00:00.000Z",
    };
    const savedRole: SettingsRole = {
        id: "role-admin",
        key: "admin",
        name: "Admin",
        system: true,
        permissions: ["assets:view"],
    };
    const client = createSettingsApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            if (url.endsWith("/api/settings/company")) return jsonResponse({ data: savedProfile, error: null });
            if (url.endsWith("/api/settings/roles/role-admin") && init?.method !== "PUT") return jsonResponse({ data: savedRole, error: null });
            if (url.endsWith("/permissions")) return jsonResponse({ data: savedRole, error: null });
            return jsonResponse({
                data: {
                    delivery: "unavailable",
                    channels: [],
                    categories: { invoices: true, proposals: false, agreements: false, assets: true, tasks: false },
                },
                error: null,
            });
        },
    }));

    const company = await client.company.update({
        legalName: savedProfile.legalName,
        brandName: savedProfile.brandName,
        gstin: "27aapfu0939f1zv",
        billingEmail: "Billing@DigiCyrus.example",
        addressLine1: "",
        addressLine2: "",
        city: "Bengaluru",
        state: "",
        postalCode: "",
        country: "",
    });
    assert.equal(companyFormFrom(company).gstin, "27AAPFU0939F1ZV");
    assert.equal(companyFormFrom(company).billingEmail, "billing@digicyrus.example");

    const written = await client.roles.replacePermissions("role-admin", { permissions: ["assets:view"] });
    const refreshed = await client.roles.get(written.id);
    assert.deepEqual(refreshed.permissions, ["assets:view"]);

    const preferences = await client.notifications.update(notificationBody({
        invoices: true,
        proposals: false,
        agreements: false,
        assets: true,
        tasks: false,
    }));
    assert.equal(preferences.delivery, "unavailable");
    assert.deepEqual(preferences.channels, []);
    assert.equal(notificationCategoriesFrom(preferences.categories).assets, true);
    assert.equal(notificationCategoriesFrom(preferences.categories).proposals, false);
});
