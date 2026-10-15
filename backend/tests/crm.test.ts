import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { containsPattern } from "../src/modules/crm/constants.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryClientStore, createMemoryFollowUpStore, createMemoryLeadStore } from "./memory-crm.js";
import { withHttp } from "./http.js";

const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";
const MISSING_ID = "22222222-2222-4222-8222-222222222222";

function crmApp(permissions: string[], organizationId = "org-1") {
  const auth = createMemoryAuthStore();
  auth.users.push(authUser({
    email: "ada@digicyrus.example",
    organizationId,
    permissions,
    passwordHash: "fake:correct-password",
  }));
  auth.users.push(authUser({
    id: "user-2",
    email: "bob@digicyrus.example",
    organizationId: "org-2",
    permissions,
    passwordHash: "fake:correct-password",
  }));
  const clients = createMemoryClientStore();
  const leads = createMemoryLeadStore();
  const followUps = createMemoryFollowUpStore();
  followUps.employees.push({ id: EMPLOYEE_ID, organizationId });
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    crm: { clients, leads, followUps },
  });
  return { app, clients, leads, followUps };
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

function clientBody(overrides: Record<string, unknown> = {}) {
  return {
    code: "C-101",
    name: "Orbit Health",
    contactName: "Rhea Kapoor",
    industry: "Healthcare",
    status: "Active",
    rating: 4,
    customerSince: "2022-04-01",
    email: "rhea@orbit.example",
    phone: "+91 98200 41120",
    ...overrides,
  };
}

function leadBody(overrides: Record<string, unknown> = {}) {
  return {
    code: "L-2201",
    company: "Sunrise Interiors",
    person: "Yash Patel",
    value: 660000,
    source: "Referral",
    priority: "High",
    closing: "2026-08-12",
    probability: 70,
    ...overrides,
  };
}

test("clients support create, search, filters, sorting, pagination, and conflicts", async () => {
  const { app, clients } = crmApp([...permissionsForRole("sales_executive")]);
  await withHttp(app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const anonymous = await fetch(`${baseUrl}/api/clients`);
    assert.equal(anonymous.status, 401);

    const invalid = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers,
      body: JSON.stringify(clientBody({ rating: 9 })),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
    assert.equal(clients.records.length, 0);

    const created = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...clientBody(), organizationId: "org-2", lifetimeValue: 5000, id: "client-supplied" }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.lifetimeValue, 0);
    assert.notEqual(createdBody.data.id, "client-supplied");
    assert.equal(clients.records[0]?.organizationId, "org-1");
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    const duplicateCode = await fetch(`${baseUrl}/api/clients`, { method: "POST", headers, body: JSON.stringify(clientBody({ email: "other@orbit.example" })) });
    assert.equal(duplicateCode.status, 409);
    const duplicateEmail = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers,
      body: JSON.stringify(clientBody({ code: "C-102", email: "Rhea@Orbit.example" })),
    });
    assert.equal(duplicateEmail.status, 409);

    await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers,
      body: JSON.stringify(clientBody({ code: "C-105", name: "Sunrise Interiors", industry: "Interior", status: "Prospect", rating: 5, email: "yash@sunrise.example" })),
    });

    const search = await fetch(`${baseUrl}/api/clients?search=orbit&status=Active&sort=rating&direction=desc&page=1&pageSize=1`, { headers });
    const searchBody = await search.json();
    assert.equal(search.status, 200);
    assert.equal(searchBody.data.total, 1);
    assert.equal(searchBody.data.items[0].name, "Orbit Health");

    const page = await fetch(`${baseUrl}/api/clients?sort=name&page=2&pageSize=1`, { headers });
    const pageBody = await page.json();
    assert.equal(pageBody.data.total, 2);
    assert.equal(pageBody.data.items.length, 1);

    const missing = await fetch(`${baseUrl}/api/clients/${MISSING_ID}`, { headers });
    assert.equal(missing.status, 404);

    const otherOrg = await signIn(baseUrl, "bob@digicyrus.example");
    const hidden = await fetch(`${baseUrl}/api/clients/${createdBody.data.id}`, { headers: { cookie: otherOrg } });
    assert.equal(hidden.status, 404);

    const updated = await fetch(`${baseUrl}/api/clients/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "On Hold" }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).data.status, "On Hold");
  });
});

test("project managers can view clients but cannot create them", async () => {
  const { app } = crmApp([...permissionsForRole("project_manager")]);
  await withHttp(app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const listed = await fetch(`${baseUrl}/api/clients`, { headers: { cookie } });
    assert.equal(listed.status, 200);
    const created = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(clientBody()),
    });
    assert.equal(created.status, 403);
  });
});

test("leads keep stage changes separate and do not convert without a match rule", async () => {
  const { app, leads, clients } = crmApp([...permissionsForRole("sales_executive")]);
  await withHttp(app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const created = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...leadBody(), stage: "Won", clientId: MISSING_ID, organizationId: "org-2" }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.stage, "New");
    assert.equal(createdBody.data.clientId, null);
    assert.equal(createdBody.data.value, 660000);
    assert.equal(leads.records[0]?.organizationId, "org-1");

    const renamed = await fetch(`${baseUrl}/api/leads/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ company: "Sunrise Studio", stage: "Won" }),
    });
    const renamedBody = await renamed.json();
    assert.equal(renamed.status, 200);
    assert.equal(renamedBody.data.company, "Sunrise Studio");
    assert.equal(renamedBody.data.stage, "New");

    const illegal = await fetch(`${baseUrl}/api/leads/${createdBody.data.id}/stage`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stage: "Proposal" }),
    });
    assert.equal(illegal.status, 400);

    const won = await fetch(`${baseUrl}/api/leads/${createdBody.data.id}/stage`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stage: "Won" }),
    });
    const wonBody = await won.json();
    assert.equal(won.status, 200);
    assert.equal(wonBody.data.stage, "Won");
    assert.equal(wonBody.data.clientId, null);
    assert.equal(clients.records.length, 0);

    const again = await fetch(`${baseUrl}/api/leads/${createdBody.data.id}/stage`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stage: "Won" }),
    });
    assert.equal((await again.json()).data.clientId, null);
    assert.equal(clients.records.length, 0);

    const lost = await fetch(`${baseUrl}/api/leads`, { method: "POST", headers, body: JSON.stringify(leadBody({ code: "L-2208", company: "Steelcore Mfg" })) });
    const lostId = (await lost.json()).data.id as string;
    const markedLost = await fetch(`${baseUrl}/api/leads/${lostId}/stage`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stage: "Lost" }),
    });
    assert.equal((await markedLost.json()).data.stage, "Lost");
    assert.equal(clients.records.length, 0);

    const linked = leads.records[0];
    if (!linked) throw new Error("missing lead");
    linked.clientId = MISSING_ID;
    const kept = await fetch(`${baseUrl}/api/leads/${linked.id}/stage`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stage: "Won" }),
    });
    assert.equal((await kept.json()).data.clientId, MISSING_ID);
    assert.equal(clients.records.length, 0);

    const duplicate = await fetch(`${baseUrl}/api/leads`, { method: "POST", headers, body: JSON.stringify(leadBody()) });
    assert.equal(duplicate.status, 409);
    const missing = await fetch(`${baseUrl}/api/leads/${MISSING_ID}`, { headers });
    assert.equal(missing.status, 404);

    const filtered = await fetch(`${baseUrl}/api/leads?search=steel&stage=Lost&source=referral`, { headers });
    const filteredBody = await filtered.json();
    assert.equal(filteredBody.data.total, 1);
    assert.equal(filteredBody.data.items[0].company, "Steelcore Mfg");
  });
});

test("admins cannot read leads and marketing cannot move a lead stage", async () => {
  const admin = crmApp([...permissionsForRole("admin")]);
  await withHttp(admin.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const response = await fetch(`${baseUrl}/api/leads`, { headers: { cookie } });
    assert.equal(response.status, 403);
  });

  const marketing = crmApp([...permissionsForRole("marketing_executive")]);
  await withHttp(marketing.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const listed = await fetch(`${baseUrl}/api/leads`, { headers: { cookie } });
    assert.equal(listed.status, 200);
    const created = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(leadBody()),
    });
    assert.equal(created.status, 403);
  });
});

test("follow-ups require a client or lead and honor permissions", async () => {
  const sales = crmApp([...permissionsForRole("sales_executive")]);
  await withHttp(sales.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const client = await fetch(`${baseUrl}/api/clients`, { method: "POST", headers, body: JSON.stringify(clientBody()) });
    const clientId = (await client.json()).data.id as string;
    const missingSubject = await fetch(`${baseUrl}/api/follow-ups`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ownerEmployeeId: EMPLOYEE_ID, dueAt: "2026-08-12T10:30:00.000Z", status: "Due" }),
    });
    assert.equal(missingSubject.status, 400);
    const unknownClient = await fetch(`${baseUrl}/api/follow-ups`, {
      method: "POST",
      headers,
      body: JSON.stringify({ clientId: MISSING_ID, ownerEmployeeId: EMPLOYEE_ID, dueAt: "2026-08-12T10:30:00.000Z", status: "Due" }),
    });
    assert.equal(unknownClient.status, 404);
    const created = await fetch(`${baseUrl}/api/follow-ups`, {
      method: "POST",
      headers,
      body: JSON.stringify({ clientId, ownerEmployeeId: EMPLOYEE_ID, dueAt: "2026-08-12T10:30:00.000Z", status: "Upcoming" }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    const listed = await fetch(`${baseUrl}/api/follow-ups?clientId=${clientId}&status=Upcoming`, { headers });
    const listedBody = await listed.json();
    assert.equal(listedBody.data.total, 1);
    assert.equal(listedBody.data.items[0].id, createdBody.data.id);
    const completed = await fetch(`${baseUrl}/api/follow-ups/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "Completed" }),
    });
    assert.equal((await completed.json()).data.status, "Completed");
  });

  const manager = crmApp([...permissionsForRole("project_manager")]);
  await withHttp(manager.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const response = await fetch(`${baseUrl}/api/follow-ups`, { headers: { cookie } });
    assert.equal(response.status, 403);
  });
});

test("crm migration declares the approved statuses and inserts no rows", () => {
  const sql = readFileSync(new URL("../drizzle/0002_crm.sql", import.meta.url), "utf8");
  assert.equal(/insert\s+into/i.test(sql), false);
  assert.equal(sql.includes("'Active', 'On Hold', 'Prospect'"), true);
  assert.equal(sql.includes("'Meeting Scheduled'"), true);
  assert.equal(sql.includes("'Proposal Sent'"), true);
  assert.equal(sql.includes("'Won'"), true);
  assert.equal(sql.includes("'Lost'"), true);
  assert.equal(sql.includes("Archived"), false);
  assert.equal(containsPattern("100%_"), "%100\\%\\_%");
});
