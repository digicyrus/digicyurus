import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { AppError } from "../src/lib/errors.js";
import { authenticate } from "../src/middleware/authenticate.js";
import { requirePermission } from "../src/middleware/authorize.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import { assertRolePermissionChange, resolvePermissionKeys } from "../src/modules/settings/guards.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryAuditStore } from "./memory-audit.js";
import { INVOICES_VIEW_ID, blankCompany, createMemoryCompanyStore, createMemoryNotificationStore, createMemoryRoleStore } from "./memory-settings.js";
import { withHttp } from "./http.js";

function settingsApp(options: { roleKey?: string; permissions?: readonly string[]; refreshRoles?: boolean } = {}) {
  const auth = createMemoryAuthStore();
  const company = createMemoryCompanyStore();
  const roles = createMemoryRoleStore();
  const notifications = createMemoryNotificationStore();
  const audit = createMemoryAuditStore();
  company.records.push(blankCompany("org-1"), blankCompany("org-2"));
  notifications.users.push(
    { id: "user-1", organizationId: "org-1" },
    { id: "user-2", organizationId: "org-2" },
    { id: "user-3", organizationId: "org-1" },
  );
  roles.members.push({ organizationId: "org-2", roleKey: "super_admin", status: "active" });
  auth.users.push(authUser({
    id: "user-1",
    email: "ada@digicyrus.example",
    organizationId: "org-1",
    roleKey: options.roleKey ?? "super_admin",
    roleName: "Super Admin",
    permissions: [...(options.permissions ?? permissionsForRole("super_admin"))],
  }));
  auth.users.push(authUser({
    id: "user-2",
    email: "bob@digicyrus.example",
    organizationId: "org-2",
    roleKey: "super_admin",
    roleName: "Super Admin",
    permissions: [...permissionsForRole("super_admin")],
  }));
  auth.users.push(authUser({
    id: "user-3",
    email: "sam@digicyrus.example",
    organizationId: "org-1",
    roleKey: "sales_executive",
    roleName: "Sales Executive",
    permissions: [...permissionsForRole("sales_executive")],
  }));
  if (options.refreshRoles) {
    const original = auth.findSessionByTokenHash.bind(auth);
    auth.findSessionByTokenHash = async (tokenHash) => {
      const session = await original(tokenHash);
      if (!session) return null;
      const role = roles.records.find((item) => item.key === session.user.roleKey);
      if (role) session.user.permissions = [...role.permissions];
      return session;
    };
  }
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    audit,
    settings: { company, roles, notifications },
    beforeNotFound(expressApp) {
      expressApp.get("/api/probe-assets", authenticate(auth), requirePermission("assets:view"), (_req, res) => {
        res.json({ data: { ok: true }, error: null });
      });
    },
  });
  return { app, auth, audit, company, roles, notifications };
}

async function signIn(baseUrl: string, email = "ada@digicyrus.example"): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct-password" }),
  });
  assert.equal(response.status, 200);
  return (response.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";
}

test("company profile validates GSTIN and email, persists, and stays inside the organization", async () => {
  const state = settingsApp();
  await withHttp(state.app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/settings/company`)).status, 401);
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const salesCookie = await signIn(baseUrl, "sam@digicyrus.example");

    const denied = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PATCH",
      headers: { cookie: salesCookie, "content-type": "application/json" },
      body: JSON.stringify({ legalName: "Taken Over" }),
    });
    assert.equal(denied.status, 403);

    const invalidGstin = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ gstin: "27AAPFU0939F1A1" }),
    });
    assert.equal(invalidGstin.status, 400);
    assert.equal((await invalidGstin.json()).error.fields.gstin, "Enter a valid GSTIN");

    const invalidEmail = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ billingEmail: "not-an-email" }),
    });
    assert.equal(invalidEmail.status, 400);
    assert.equal((await invalidEmail.json()).error.fields.billingEmail, "Enter a valid email");

    const saved = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        legalName: "DigiCyrus Technologies Pvt Ltd",
        gstin: "27aapfu0939f1zv",
        billingEmail: "Billing@DigiCyrus.example",
        addressLine1: "12 Residency Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560025",
        country: "India",
        organizationId: "org-2",
      }),
    });
    assert.equal(saved.status, 200);
    const body = await saved.json();
    assert.equal(body.data.id, "org-1");
    assert.equal(body.data.gstin, "27AAPFU0939F1ZV");
    assert.equal(body.data.billingEmail, "billing@digicyrus.example");
    assert.equal(body.data.addressLine1, "12 Residency Road");
    assert.equal(body.data.city, "Bengaluru");
    assert.equal("singleton" in body.data, false);
    assert.equal("passwordHash" in body.data, false);

    const again = await fetch(`${baseUrl}/api/settings/company`, { headers: { cookie } });
    assert.equal((await again.json()).data.gstin, "27AAPFU0939F1ZV");

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    const other = await fetch(`${baseUrl}/api/settings/company`, { headers: { cookie: otherCookie } });
    assert.equal((await other.json()).data.gstin, null);
    assert.equal(state.audit.records.some((record) => record.action === "company.update" && record.organizationId === "org-1"), true);
    assert.equal(JSON.stringify(state.audit.records).includes("password"), false);
  });
});

test("company updates roll back when the audit write fails", async () => {
  const state = settingsApp();
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    state.audit.failNext = true;
    const response = await fetch(`${baseUrl}/api/settings/company`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ brandName: "Temporary" }),
    });
    assert.equal(response.status, 500);
    assert.equal(state.company.records.find((record) => record.id === "org-1")?.brandName, "DigiCyrus");
  });
});

test("role assignments stay with super admins and cannot escalate or remove super admin access", async () => {
  const state = settingsApp({ refreshRoles: true });
  const admin = state.roles.records.find((role) => role.key === "admin");
  const superAdmin = state.roles.records.find((role) => role.key === "super_admin");
  assert.ok(admin && superAdmin);
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/settings/roles`)).status, 401);

    const listed = await fetch(`${baseUrl}/api/settings/roles`, { headers: { cookie } });
    assert.equal(listed.status, 200);
    const roles = (await listed.json()).data.roles as { key: string; system: boolean }[];
    assert.equal(roles.some((role) => role.key === "super_admin" && role.system), true);

    const removed = await fetch(`${baseUrl}/api/settings/roles/${superAdmin.id}`, { method: "DELETE", headers: { cookie } });
    assert.equal(removed.status, 404);
    assert.deepEqual(superAdmin.permissions, [...permissionsForRole("super_admin")]);

    const locked = await fetch(`${baseUrl}/api/settings/roles/${superAdmin.id}/permissions`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ permissions: ["dashboard:view"] }),
    });
    assert.equal(locked.status, 409);
    assert.equal((await locked.json()).error.message, "The Super Admin role cannot be changed");
    assert.deepEqual(superAdmin.permissions, [...permissionsForRole("super_admin")]);

    const escalated = await fetch(`${baseUrl}/api/settings/roles/${admin.id}/permissions`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ permissions: ["dashboard:view", "settings:update", "roles:update"] }),
    });
    assert.equal(escalated.status, 400);
    assert.equal((await escalated.json()).error.fields.permissions, "This permission cannot be granted to this role");
    assert.equal(admin.permissions.includes("settings:update"), false);

    const unknown = await fetch(`${baseUrl}/api/settings/roles/${admin.id}/permissions`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ permissions: ["users:delete"] }),
    });
    assert.equal(unknown.status, 400);
    assert.equal((await unknown.json()).error.fields.permissions, "Unknown permission");

    const duplicate = await fetch(`${baseUrl}/api/settings/roles/${admin.id}/permissions`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ permissions: ["dashboard:view", "dashboard:view"] }),
    });
    assert.equal(duplicate.status, 400);
    assert.equal((await duplicate.json()).error.fields.permissions, "Duplicate permission");

    const granted = await fetch(`${baseUrl}/api/settings/roles/${admin.id}/permissions`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ permissions: ["dashboard:view", INVOICES_VIEW_ID, "assets:view"] }),
    });
    assert.equal(granted.status, 200);
    const saved = (await granted.json()).data.permissions as string[];
    assert.deepEqual(saved, ["assets:view", "dashboard:view", "invoices:view"]);
    assert.equal(saved.includes("roles:update"), false);
    const audit = state.audit.records.find((record) => record.action === "role.permissions");
    assert.equal(audit?.resourceId, admin.id);
    assert.equal((audit?.metadata.roleKey), "admin");

    const adminAccount = authUser({
      id: "user-4",
      email: "amy@digicyrus.example",
      organizationId: "org-1",
      roleKey: "admin",
      roleName: "Admin",
      permissions: ["dashboard:view"],
    });
    state.auth.users.push(adminAccount);
    state.notifications.users.push({ id: "user-4", organizationId: "org-1" });
    const adminCookie = await signIn(baseUrl, "amy@digicyrus.example");
    const allowed = await fetch(`${baseUrl}/api/probe-assets`, { headers: { cookie: adminCookie } });
    assert.equal(allowed.status, 200);

    const revoked = await fetch(`${baseUrl}/api/settings/roles/${admin.id}/permissions`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ permissions: ["dashboard:view"] }),
    });
    assert.equal(revoked.status, 200);
    const blocked = await fetch(`${baseUrl}/api/probe-assets`, { headers: { cookie: adminCookie } });
    assert.equal(blocked.status, 403);

    const impostor = settingsApp({
      roleKey: "admin",
      permissions: ["roles:view", "roles:update", "settings:update"],
    });
    await withHttp(impostor.app, async (impostorUrl) => {
      const impostorCookie = await signIn(impostorUrl);
      const target = impostor.roles.records.find((role) => role.key === "sales_executive");
      assert.ok(target);
      const response = await fetch(`${impostorUrl}/api/settings/roles/${target.id}/permissions`, {
        method: "PUT",
        headers: { cookie: impostorCookie, "content-type": "application/json" },
        body: JSON.stringify({ permissions: [...permissionsForRole("super_admin")] }),
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.message, "Only a Super Admin can perform this action");
      assert.equal(target.permissions.includes("roles:update"), false);
    });
  });
});

test("an organization without an active super admin cannot change roles", async () => {
  const state = settingsApp();
  state.roles.members.splice(0, state.roles.members.length, { organizationId: "org-1", roleKey: "super_admin", status: "active" });
  const admin = state.roles.records.find((role) => role.key === "admin");
  assert.ok(admin);
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl, "bob@digicyrus.example");
    const response = await fetch(`${baseUrl}/api/settings/roles/${admin.id}/permissions`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ permissions: ["dashboard:view"] }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.message, "Super Admin access must remain");
    assert.equal(admin.permissions.includes("clients:view"), true);
  });
});

test("notification preferences default to off and do not claim delivery", async () => {
  const state = settingsApp();
  await withHttp(state.app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/settings/notifications`)).status, 401);
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const initial = await fetch(`${baseUrl}/api/settings/notifications`, { headers: { cookie } });
    assert.equal(initial.status, 200);
    const defaults = await initial.json();
    assert.equal(defaults.data.delivery, "unavailable");
    assert.deepEqual(defaults.data.channels, []);
    assert.deepEqual(defaults.data.categories, {
      invoices: false,
      proposals: false,
      agreements: false,
      assets: false,
      tasks: false,
    });

    const unsupported = await fetch(`${baseUrl}/api/settings/notifications`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ channels: ["email"], categories: { invoices: true } }),
    });
    assert.equal(unsupported.status, 400);
    assert.equal((await unsupported.json()).error.fields["channels.0"], "This channel is not supported");
    assert.equal(state.notifications.rows.length, 0);

    const saved = await fetch(`${baseUrl}/api/settings/notifications`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ categories: { invoices: true } }),
    });
    assert.equal(saved.status, 200);
    const body = await saved.json();
    assert.equal(body.data.categories.invoices, true);
    assert.equal(body.data.categories.proposals, false);
    assert.equal(body.data.delivery, "unavailable");
    assert.equal(body.data.sent, undefined);

    const salesCookie = await signIn(baseUrl, "sam@digicyrus.example");
    const sales = await fetch(`${baseUrl}/api/settings/notifications`, { headers: { cookie: salesCookie } });
    assert.equal((await sales.json()).data.categories.invoices, false);

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    const other = await fetch(`${baseUrl}/api/settings/notifications`, { headers: { cookie: otherCookie } });
    assert.equal((await other.json()).data.categories.invoices, false);

    const kept = await fetch(`${baseUrl}/api/settings/notifications`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ categories: { proposals: true } }),
    });
    assert.equal((await kept.json()).data.categories.invoices, true);
    assert.equal(state.audit.records.some((record) => record.action === "notification.preferences" && record.metadata.delivery === "unavailable"), true);
  });
});

test("role permission guards reject self-escalation before a write", () => {
  assert.equal(resolvePermissionKeys([INVOICES_VIEW_ID], [{ id: INVOICES_VIEW_ID, key: "invoices:view" }])[0], "invoices:view");
  assert.throws(() => resolvePermissionKeys(["roles:delete"], [{ id: "x", key: "roles:view" }]), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.fields?.permissions, "Unknown permission");
    return true;
  });
  assert.throws(() => assertRolePermissionChange({
    actorRoleKey: "admin",
    targetRoleKey: "sales_executive",
    permissions: ["dashboard:view"],
    activeSuperAdminCount: 1,
    superAdminPermissions: ["roles:update", "settings:update"],
  }), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, 403);
    return true;
  });
  assert.throws(() => assertRolePermissionChange({
    actorRoleKey: "super_admin",
    targetRoleKey: "admin",
    permissions: ["audit_logs:view"],
    activeSuperAdminCount: 1,
    superAdminPermissions: ["roles:update", "settings:update"],
  }), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.fields?.permissions, "This permission cannot be granted to this role");
    return true;
  });
  assert.throws(() => assertRolePermissionChange({
    actorRoleKey: "super_admin",
    targetRoleKey: "super_admin",
    permissions: ["dashboard:view"],
    activeSuperAdminCount: 1,
    superAdminPermissions: ["roles:update", "settings:update"],
  }), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.message, "The Super Admin role cannot be changed");
    return true;
  });
});
