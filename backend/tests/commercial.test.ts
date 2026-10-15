import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import type { NewClient } from "../src/modules/crm/clients.store.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryReferralStore, createMemoryServiceRateStore } from "./memory-commercial.js";
import { createMemoryClientStore } from "./memory-crm.js";
import { withHttp } from "./http.js";

const MISSING_ID = "22222222-2222-4222-8222-222222222222";

function commercialApp(permissions: readonly string[]) {
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
  const clients = createMemoryClientStore();
  const referrals = createMemoryReferralStore();
  const serviceRates = createMemoryServiceRateStore();
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    commercial: { clients, referrals, serviceRates },
  });
  return { app, clients, referrals, serviceRates };
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

function clientInput(organizationId: string, overrides: Partial<NewClient> = {}): NewClient {
  return {
    organizationId,
    code: "C-101",
    name: "Nimbus Retail",
    contactName: "Kabir Shah",
    industry: "E-commerce",
    status: "Active",
    rating: 5,
    customerSince: "2023-01-01",
    email: null,
    phone: null,
    ...overrides,
  };
}

function referralBody(clientId: string | null, overrides: Record<string, unknown> = {}) {
  return {
    code: "R-4",
    partner: "Kunal Desai",
    clientId,
    deals: 6,
    revenue: 1450000,
    commission: 50000,
    status: "Pending",
    ...overrides,
  };
}

test("referrals keep entered commission and stay inside the organization", async () => {
  const state = commercialApp(permissionsForRole("admin"));
  const client = await state.clients.insert(clientInput("org-1"));
  const foreign = await state.clients.insert(clientInput("org-2", { code: "C-201", name: "Foreign" }));
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/referrals`)).status, 401);

    const missingClient = await fetch(`${baseUrl}/api/referrals`, {
      method: "POST",
      headers,
      body: JSON.stringify(referralBody(MISSING_ID)),
    });
    assert.equal(missingClient.status, 404);
    assert.equal(state.referrals.records.length, 0);

    const foreignClient = await fetch(`${baseUrl}/api/referrals`, {
      method: "POST",
      headers,
      body: JSON.stringify(referralBody(foreign.id)),
    });
    assert.equal(foreignClient.status, 404);

    const created = await fetch(`${baseUrl}/api/referrals`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...referralBody(client.id), organizationId: "org-2", commissionRate: 0.1 }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.partner, "Kunal Desai");
    assert.equal(createdBody.data.clientId, client.id);
    assert.equal(createdBody.data.revenue, 1450000);
    assert.equal(createdBody.data.commission, 50000);
    assert.equal(createdBody.data.commissionRate, undefined);
    assert.equal(state.referrals.records[0]?.organizationId, "org-1");
    assert.equal(state.referrals.records[0]?.commissionPaise, 5000000);
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    const duplicate = await fetch(`${baseUrl}/api/referrals`, {
      method: "POST",
      headers,
      body: JSON.stringify(referralBody(null, { partner: "Other" })),
    });
    assert.equal(duplicate.status, 409);

    const unlinked = await fetch(`${baseUrl}/api/referrals`, {
      method: "POST",
      headers,
      body: JSON.stringify(referralBody(null, { code: "R-5", partner: "Bright Consulting", deals: 3, revenue: 820000, commission: 82000, status: "Pending" })),
    });
    assert.equal(unlinked.status, 201);
    await fetch(`${baseUrl}/api/referrals`, {
      method: "POST",
      headers,
      body: JSON.stringify(referralBody(null, { code: "R-6", partner: "Nidhi Verma", deals: 2, revenue: 360000, commission: 36000, status: "Paid" })),
    });

    const search = await fetch(`${baseUrl}/api/referrals?search=bright&status=Pending&page=1&pageSize=1`, { headers });
    const searchBody = await search.json();
    assert.equal(search.status, 200);
    assert.equal(searchBody.data.total, 1);
    assert.equal(searchBody.data.items[0].code, "R-5");

    const byClient = await fetch(`${baseUrl}/api/referrals?clientId=${client.id}`, { headers });
    const byClientBody = await byClient.json();
    assert.equal(byClientBody.data.total, 1);
    assert.equal(byClientBody.data.items[0].code, "R-4");

    const id = createdBody.data.id as string;
    const patched = await fetch(`${baseUrl}/api/referrals/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "Paid", clientId: null }),
    });
    const patchedBody = await patched.json();
    assert.equal(patched.status, 200);
    assert.equal(patchedBody.data.status, "Paid");
    assert.equal(patchedBody.data.clientId, null);
    assert.equal(patchedBody.data.commission, 50000);

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    assert.equal((await fetch(`${baseUrl}/api/referrals/${id}`, { headers: { cookie: otherCookie } })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/referrals/${MISSING_ID}`, { headers })).status, 404);
  });

  const accountant = commercialApp(permissionsForRole("accountant"));
  await withHttp(accountant.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/referrals`, { headers })).status, 200);
    const denied = await fetch(`${baseUrl}/api/referrals`, { method: "POST", headers, body: JSON.stringify(referralBody(null)) });
    assert.equal(denied.status, 403);
  });

  const sales = commercialApp(permissionsForRole("sales_executive"));
  await withHttp(sales.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    assert.equal((await fetch(`${baseUrl}/api/referrals`, { headers: { cookie } })).status, 403);
  });
});

test("service rates are organization money records and only super admins can change them", async () => {
  const state = commercialApp(permissionsForRole("super_admin"));
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const invalid = await fetch(`${baseUrl}/api/service-rates`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "", unit: "Per project", rate: -1 }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(state.serviceRates.records.length, 0);

    const created = await fetch(`${baseUrl}/api/service-rates`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Web development",
        description: "Default build",
        unit: "Per project",
        rate: 450000,
        organizationId: "org-2",
        tax: "18% GST",
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.rate, 450000);
    assert.equal(createdBody.data.unit, "Per project");
    assert.equal(createdBody.data.active, true);
    assert.equal(createdBody.data.tax, undefined);
    assert.equal(state.serviceRates.records[0]?.organizationId, "org-1");
    assert.equal(state.serviceRates.records[0]?.ratePaise, 45000000);
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    const duplicate = await fetch(`${baseUrl}/api/service-rates`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "web development", unit: "Monthly", rate: 65000 }),
    });
    assert.equal(duplicate.status, 409);

    await fetch(`${baseUrl}/api/service-rates`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "SEO retainer", unit: "Monthly", rate: 65000, active: false }),
    });

    const active = await fetch(`${baseUrl}/api/service-rates?active=true&search=web&page=1&pageSize=1`, { headers });
    const activeBody = await active.json();
    assert.equal(active.status, 200);
    assert.equal(activeBody.data.total, 1);
    assert.equal(activeBody.data.items[0].name, "Web development");

    const id = createdBody.data.id as string;
    const patched = await fetch(`${baseUrl}/api/service-rates/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ active: false, rate: 440000 }),
    });
    const patchedBody = await patched.json();
    assert.equal(patched.status, 200);
    assert.equal(patchedBody.data.active, false);
    assert.equal(patchedBody.data.rate, 440000);

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    assert.equal((await fetch(`${baseUrl}/api/service-rates/${id}`, { headers: { cookie: otherCookie } })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/service-rates/${MISSING_ID}`, { headers })).status, 404);
  });

  const admin = commercialApp(permissionsForRole("admin"));
  await withHttp(admin.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/service-rates`, { headers })).status, 403);
    const denied = await fetch(`${baseUrl}/api/service-rates`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "UI/UX design", unit: "Per sprint", rate: 120000 }),
    });
    assert.equal(denied.status, 403);
  });
});
