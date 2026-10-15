import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/app.js";
import { authenticate } from "../src/middleware/authenticate.js";
import { requirePermission } from "../src/middleware/authorize.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { ALL_PERMISSIONS, permissionsForRole, ROLE_KEYS, type PermissionKey } from "../src/modules/auth/permissions.js";

const SALES_PERMISSIONS = new Set<PermissionKey>([
  "pipeline:view",
  "pipeline:create",
  "pipeline:update",
  "pipeline:move_stage",
  "forecast:view",
  "proposals:change_status",
  "agreements:change_status",
]);
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { withHttp } from "./http.js";

test("permission checks return 401 and 403", async () => {
  const store = createMemoryAuthStore();
  store.users.push(authUser({ permissions: ["clients:view"], roleKey: "sales_executive", roleName: "Sales Executive" }));
  const app = createApp({
    auth: {
      store,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    beforeNotFound(expressApp) {
      expressApp.get("/api/probe", authenticate(store), requirePermission("payroll:view"), (_req, res) => {
        res.json({ data: { ok: true }, error: null });
      });
    },
  });
  await withHttp(app, async (baseUrl) => {
    const anonymous = await fetch(`${baseUrl}/api/probe`);
    assert.equal(anonymous.status, 401);
    assert.equal((await anonymous.json()).error.code, "AUTHENTICATION_REQUIRED");

    const signedIn = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@digicyrus.example", password: "correct-password" }),
    });
    const cookie = (signedIn.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";
    const forbidden = await fetch(`${baseUrl}/api/probe`, { headers: { cookie } });
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, "FORBIDDEN");
  });
});

test("the role matrix grants the agreed permissions and no deletes", () => {
  assert.deepEqual(permissionsForRole("client"), []);
  assert.deepEqual([...permissionsForRole("super_admin")], [...ALL_PERMISSIONS]);
  assert.equal(permissionsForRole("developer").includes("projects:create"), false);
  assert.equal(permissionsForRole("marketing_executive").includes("leads:create"), false);
  assert.equal(permissionsForRole("accountant").includes("expenses:create"), false);
  assert.equal(permissionsForRole("admin").includes("leads:view"), false);
  assert.equal(permissionsForRole("admin").includes("assets:view"), false);
  assert.equal(permissionsForRole("admin").includes("settings:view"), false);
  assert.equal(permissionsForRole("hr").includes("daily_reports:create"), false);
  assert.equal(permissionsForRole("super_admin").includes("audit_logs:view"), true);
  for (const role of ROLE_KEYS) {
    if (role === "super_admin") continue;
    assert.equal(permissionsForRole(role).includes("audit_logs:view"), false, role);
  }
  for (const role of ROLE_KEYS) {
    for (const permission of permissionsForRole(role)) {
      assert.equal(permission.includes(":delete"), false);
    }
  }
});

test("the identity migration seeds roles and grants without users", () => {
  const sql = readFileSync(new URL("../drizzle/0001_identity.sql", import.meta.url), "utf8");
  assert.equal(/:delete/.test(sql), false);
  assert.equal(sql.includes("WHERE r.\"key\" = 'client'"), false);
  assert.equal(/insert\s+into\s+"(organizations|users|sessions|employees)"/i.test(sql), false);
  for (const role of ROLE_KEYS) assert.equal(sql.includes(`'${role}'`), true);
  for (const permission of ALL_PERMISSIONS) {
    if (permission === "audit_logs:view" || SALES_PERMISSIONS.has(permission)) continue;
    assert.equal(sql.includes(`'${permission}'`), true);
  }
  for (const role of ROLE_KEYS) {
    if (role === "super_admin" || role === "client") continue;
    const block = sql.split(`-- role:${role}`)[1]?.split("--> statement-breakpoint")[0] ?? "";
    for (const permission of permissionsForRole(role)) {
      if (SALES_PERMISSIONS.has(permission)) continue;
      assert.equal(block.includes(`'${permission}'`), true, `${role} ${permission}`);
    }
  }
  assert.equal(sql.includes("CROSS JOIN \"permissions\" p"), true);
});

test("the audit permission migration grants view only to super admin", () => {
  const sql = readFileSync(new URL("../drizzle/0009_audit_permission.sql", import.meta.url), "utf8");
  assert.equal(sql.includes("'audit_logs:view'"), true);
  assert.equal(sql.includes("WHERE r.\"key\" = 'super_admin'"), true);
  for (const role of ROLE_KEYS) {
    if (role === "super_admin") continue;
    assert.equal(sql.includes(`'${role}'`), false, role);
  }
  assert.equal(/delete\s+from/i.test(sql), false);
  assert.equal(/update\s+"audit_logs"/i.test(sql), false);
  assert.equal(/update\s+"role_permissions"/i.test(sql), false);
});
