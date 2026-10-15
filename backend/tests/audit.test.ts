import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole, ROLE_KEYS } from "../src/modules/auth/permissions.js";
import { redact } from "../src/modules/audit/redact.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryAssetStore } from "./memory-assets.js";
import { createMemoryAuditStore } from "./memory-audit.js";
import { createMemoryClientStore, createMemoryLeadStore } from "./memory-crm.js";
import { createMemoryInvoiceStore } from "./memory-finance.js";
import { createMemoryProjectStore } from "./memory-delivery.js";
import { withHttp } from "./http.js";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";

function auditedApp(permissions: readonly string[], audit = createMemoryAuditStore()) {
  const auth = createMemoryAuthStore();
  auth.users.push(authUser({
    id: ACTOR_ID,
    email: "ada@digicyrus.example",
    organizationId: "org-1",
    permissions: [...permissions],
    passwordHash: "fake:correct-password",
  }));
  const assets = createMemoryAssetStore();
  const leads = createMemoryLeadStore();
  const invoices = createMemoryInvoiceStore();
  const clients = createMemoryClientStore();
  const projects = createMemoryProjectStore();
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    audit,
    assets: { assets },
    crm: { clients, leads, followUps: { list: async () => ({ items: [], total: 0 }), find: async () => null, insert: async () => { throw new Error("unused"); }, update: async () => null } as never },
    finance: { clients, projects, invoices, expenses: { list: async () => ({ items: [], total: 0 }), find: async () => null, insert: async () => { throw new Error("unused"); }, update: async () => null } as never, summary: { summary: async () => ({ issuedPaise: 0, collectedPaise: 0, outstandingPaise: 0, expensePaise: 0 }) } },
  });
  return { app, auth, assets, leads, invoices, clients, audit };
}

async function signIn(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "ada@digicyrus.example", password: "correct-password" }),
  });
  assert.equal(response.status, 200);
  return (response.headers.get("set-cookie") ?? "").split(";", 1)[0] ?? "";
}

test("audit metadata drops secrets and only super admins can read logs", async () => {
  assert.deepEqual(redact({
    email: "ada@digicyrus.example",
    password: "correct-password",
    nested: { sessionToken: "abc", note: "ok" },
  }), { email: "ada@digicyrus.example", nested: { note: "ok" } });

  const state = auditedApp(permissionsForRole("super_admin"));
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const login = state.audit.records.find((record) => record.action === "login");
    assert.equal(login?.actorUserId, ACTOR_ID);
    assert.equal(login?.metadata.email, "ada@digicyrus.example");
    assert.equal(JSON.stringify(login).includes("correct-password"), false);
    assert.equal(JSON.stringify(login).includes("token"), false);

    const headers = { cookie, "content-type": "application/json" };
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
        password: "correct-password",
        sessionToken: "secret-token",
      }),
    });
    assert.equal(created.status, 201);
    const assetAudit = state.audit.records.find((record) => record.action === "asset.create");
    assert.equal(assetAudit?.metadata.name, "digicyrus.com");
    assert.equal(JSON.stringify(assetAudit).includes("correct-password"), false);
    assert.equal(JSON.stringify(assetAudit).includes("secret-token"), false);

    state.audit.records.push({
      id: "99999999-9999-4999-8999-999999999999",
      organizationId: "org-2",
      actorUserId: ACTOR_ID,
      action: "asset.create",
      resourceType: "asset",
      resourceId: null,
      metadata: { name: "Foreign" },
      createdAt: new Date(),
    });
    const listed = await fetch(`${baseUrl}/api/audit-logs`, { headers });
    assert.equal(listed.status, 200);
    const listBody = await listed.json() as { data: { items: { id: string; action: string }[]; total: number } };
    assert.equal(listBody.data.items.some((item) => item.id === assetAudit?.id && item.action === "asset.create"), true);
    assert.equal(listBody.data.items.some((item) => item.id === "99999999-9999-4999-8999-999999999999"), false);
    const detail = await fetch(`${baseUrl}/api/audit-logs/${assetAudit?.id}`, { headers });
    assert.equal(detail.status, 200);
    assert.equal(((await detail.json()) as { data: { id: string } }).data.id, assetAudit?.id);
    assert.equal((await fetch(`${baseUrl}/api/audit-logs/99999999-9999-4999-8999-999999999999`, { headers })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/audit-logs`, { method: "POST", headers, body: "{}" })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/audit-logs`)).status, 401);

    const loggedOut = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers });
    assert.equal(loggedOut.status, 200);
    assert.equal(state.audit.records.some((record) => record.action === "logout"), true);
    assert.equal(state.auth.sessions[0]?.revokedAt instanceof Date, true);
  });

  for (const role of ROLE_KEYS) {
    if (role === "super_admin") continue;
    const denied = auditedApp(permissionsForRole(role));
    await withHttp(denied.app, async (baseUrl) => {
      const cookie = await signIn(baseUrl);
      const headers = { cookie };
      assert.equal((await fetch(`${baseUrl}/api/audit-logs`, { headers })).status, 403, role);
      assert.equal((await fetch(`${baseUrl}/api/audit-logs/${ACTOR_ID}`, { headers })).status, 403, role);
    });
  }
});

test("a failed audit write rolls back the business change", async () => {
  const audit = createMemoryAuditStore();
  audit.failNext = true;
  const state = auditedApp(permissionsForRole("super_admin"), audit);
  await withHttp(state.app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@digicyrus.example", password: "correct-password" }),
    });
    assert.equal(response.status, 500);
    assert.equal(state.auth.sessions.length, 0);
    assert.equal(state.audit.records.length, 0);
    assert.equal(JSON.stringify(await response.json()).includes("correct-password"), false);
  });
});

test("audit queries filter by actor, action, resource, and date inside one organization", async () => {
  const audit = createMemoryAuditStore();
  const older = new Date("2026-07-01T12:00:00.000Z");
  const newer = new Date("2026-07-20T12:00:00.000Z");
  audit.records.push(
    { id: "11111111-1111-4111-8111-111111111111", organizationId: "org-1", actorUserId: ACTOR_ID, action: "asset.create", resourceType: "asset", resourceId: "22222222-2222-4222-8222-222222222222", metadata: { name: "Domain" }, createdAt: older },
    { id: "33333333-3333-4333-8333-333333333333", organizationId: "org-1", actorUserId: ACTOR_ID, action: "asset.update", resourceType: "asset", resourceId: "22222222-2222-4222-8222-222222222222", metadata: { status: "Due Soon" }, createdAt: newer },
    { id: "44444444-4444-4444-8444-444444444444", organizationId: "org-1", actorUserId: "55555555-5555-4555-8555-555555555555", action: "login", resourceType: "user", resourceId: "55555555-5555-4555-8555-555555555555", metadata: {}, createdAt: newer },
    { id: "66666666-6666-4666-8666-666666666666", organizationId: "org-2", actorUserId: ACTOR_ID, action: "asset.create", resourceType: "asset", resourceId: null, metadata: { name: "Foreign" }, createdAt: newer },
  );
  const listed = await audit.list("org-1", { page: 1, pageSize: 1, resourceType: "asset", actor: ACTOR_ID, action: "asset.update", from: "2026-07-15", to: "2026-07-31" });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0]?.action, "asset.update");
  const hidden = await audit.find("org-1", "66666666-6666-4666-8666-666666666666");
  assert.equal(hidden, null);
  const page = await audit.list("org-1", { page: 1, pageSize: 2 });
  assert.equal(page.total, 3);
  assert.equal(page.items.length, 2);
});

test("lead stage changes and payments record business fields without payment notes", async () => {
  const state = auditedApp([...permissionsForRole("sales_executive"), ...permissionsForRole("accountant"), "invoices:record_payment"]);
  const client = await state.clients.insert({
    organizationId: "org-1",
    code: "C-101",
    name: "Nimbus Retail",
    contactName: "Kabir Shah",
    industry: "E-commerce",
    status: "Active",
    rating: 5,
    customerSince: "2023-01-01",
    email: null,
    phone: null,
  });
  const lead = await state.leads.insert({
    organizationId: "org-1",
    code: "L-1",
    company: "Sunrise",
    person: "Yash",
    value: 1000,
    source: "Website",
    priority: "High",
    expectedClose: "2026-08-01",
    probability: 10,
  });
  const invoice = await state.invoices.insert({
    organizationId: "org-1",
    clientId: client.id,
    projectId: null,
    number: "INV-1",
    issueDate: "2026-07-01",
    dueDate: "2026-07-15",
    status: "Pending",
    supply: "cgst_sgst",
    rateBps: 0,
    lines: [{ description: "Work", quantity: 1, unitPriceRupees: 1000 }],
  });
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const stage = await fetch(`${baseUrl}/api/leads/${lead.id}/stage`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ stage: "Contacted" }),
    });
    assert.equal(stage.status, 200);
    const stageAudit = state.audit.records.find((record) => record.action === "lead.stage");
    assert.equal(stageAudit?.metadata.from, "New");
    assert.equal(stageAudit?.metadata.to, "Contacted");

    const paid = await fetch(`${baseUrl}/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: 1000, paidOn: "2026-07-02", method: "Bank transfer", reference: "UTR-1", notes: "card 4111111111111111" }),
    });
    assert.equal(paid.status, 201);
    const paymentAudit = state.audit.records.find((record) => record.action === "invoice.payment");
    assert.equal(paymentAudit?.metadata.amount, 1000);
    assert.equal(paymentAudit?.metadata.reference, "UTR-1");
    assert.equal(JSON.stringify(paymentAudit?.metadata).includes("4111111111111111"), false);
    assert.equal(paymentAudit?.metadata.notes, undefined);
  });
});

test("audit migration is append-only and inserts no rows", () => {
  const sql = readFileSync(new URL("../drizzle/0008_audit.sql", import.meta.url), "utf8");
  assert.equal(/insert into/i.test(sql), false);
  assert.equal(/delete from/i.test(sql), false);
  assert.equal(sql.includes("audit_logs"), true);
});
