import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryAssetStore } from "./memory-assets.js";
import { withHttp } from "./http.js";

const MISSING_ID = "22222222-2222-4222-8222-222222222222";

function assetApp(permissions: readonly string[]) {
  const auth = createMemoryAuthStore();
  auth.users.push(authUser({
    email: "ada@digicyrus.example",
    organizationId: "org-1",
    permissions: [...permissions],
    passwordHash: "fake:correct-password",
  }));
  auth.users.push(authUser({
    id: "user-2",
    email: "bob@digicyrus.example",
    organizationId: "org-2",
    permissions: [...permissions],
    passwordHash: "fake:correct-password",
  }));
  const assets = createMemoryAssetStore();
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    assets: { assets },
  });
  return { app, assets };
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

test("assets record renewal cost and stay inside the organization", async () => {
  const state = assetApp(permissionsForRole("super_admin"));
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/assets`)).status, 401);

    const invalid = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "digicyrus.com", type: "Laptop", vendor: "GoDaddy", renewal: "14 Sep 2025", cost: -1, status: "Expired" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(state.assets.records.length, 0);

    const created = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "digicyrus.com",
        type: "Domain",
        vendor: "GoDaddy",
        renewal: "2026-09-14",
        cost: 1400,
        status: "Active",
        organizationId: "org-2",
        ownerId: "user-2",
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.cost, 1400);
    assert.equal(createdBody.data.renewal, "2026-09-14");
    assert.equal(createdBody.data.ownerId, undefined);
    assert.equal(state.assets.records[0]?.organizationId, "org-1");
    assert.equal(state.assets.records[0]?.costPaise, 140000);
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    const duplicate = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Digicyrus.com", type: "SSL", vendor: "Sectigo", renewal: "2026-12-22", cost: 9500, status: "Active" }),
    });
    assert.equal(duplicate.status, 409);

    await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Cloud Hosting", type: "Hosting", vendor: "AWS", renewal: "2026-08-01", cost: 48000, status: "Due Soon" }),
    });

    const listed = await fetch(`${baseUrl}/api/assets?status=Due%20Soon&from=2026-08-01&to=2026-08-31&search=cloud`, { headers });
    const listedBody = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedBody.data.total, 1);
    assert.equal(listedBody.data.items[0].name, "Cloud Hosting");

    const id = createdBody.data.id as string;
    const patched = await fetch(`${baseUrl}/api/assets/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "Due Soon", cost: 1500 }),
    });
    const patchedBody = await patched.json();
    assert.equal(patched.status, 200);
    assert.equal(patchedBody.data.status, "Due Soon");
    assert.equal(patchedBody.data.cost, 1500);

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    assert.equal((await fetch(`${baseUrl}/api/assets/${id}`, { headers: { cookie: otherCookie } })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/assets/${MISSING_ID}`, { headers })).status, 404);
  });

  const admin = assetApp(permissionsForRole("admin"));
  await withHttp(admin.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/assets`, { headers })).status, 403);
    const denied = await fetch(`${baseUrl}/api/assets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Wildcard SSL", type: "SSL", vendor: "Sectigo", renewal: "2026-12-22", cost: 9500, status: "Active" }),
    });
    assert.equal(denied.status, 403);
  });
});

test("asset migration declares the screen fields and inserts no rows", () => {
  const sql = readFileSync(new URL("../drizzle/0007_assets.sql", import.meta.url), "utf8");
  assert.equal(/insert into/i.test(sql), false);
  assert.equal(sql.includes("assets_org_name_unique"), true);
  assert.equal(sql.includes("assets_status_check"), true);
  assert.equal(sql.includes("assets_type_check"), true);
  assert.equal(/create table "activities"/i.test(sql), false);
});
