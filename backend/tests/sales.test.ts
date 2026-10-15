import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/app.js";
import { AppError } from "../src/lib/errors.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import { todayUtc } from "../src/modules/finance/constants.js";
import { calculateProposal } from "../src/modules/sales/money.js";
import { buildForecast } from "../src/modules/sales/metrics.js";
import { resolveOpportunityClose } from "../src/modules/sales/transitions.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryAuditStore } from "./memory-audit.js";
import { createMemoryClientStore, createMemoryLeadStore } from "./memory-crm.js";
import { createMemoryEmployeeStore } from "./memory-hr.js";
import { createMemoryAgreementStore, createMemoryForecastStore, createMemoryOpportunityStore, createMemoryProposalStore } from "./memory-sales.js";
import { withHttp } from "./http.js";

const MISSING_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";

function salesApp(permissions: readonly string[], audit = createMemoryAuditStore()) {
  const auth = createMemoryAuthStore();
  auth.users.push(authUser({
    id: ACTOR_ID,
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
  const leads = createMemoryLeadStore();
  const employees = createMemoryEmployeeStore();
  const opportunities = createMemoryOpportunityStore();
  const forecast = createMemoryForecastStore();
  const proposals = createMemoryProposalStore();
  const agreements = createMemoryAgreementStore();
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    audit,
    sales: { clients, leads, employees, opportunities, forecast, proposals, agreements },
  });
  return { app, clients, leads, employees, opportunities, forecast, proposals, agreements, audit };
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

async function seedClient(clients: ReturnType<typeof createMemoryClientStore>, organizationId: string, code: string, name: string) {
  return clients.insert({
    organizationId,
    code,
    name,
    contactName: "Ada",
    industry: "Software",
    status: "Active",
    rating: 4,
    customerSince: "2024-01-01",
    email: null,
    phone: null,
  });
}

test("opportunity close rules require an explicit lost reason and closed date", () => {
  assert.equal(resolveOpportunityClose({ stage: "Qualification", today: "2026-10-15" }).closedOn, null);
  assert.throws(
    () => resolveOpportunityClose({ stage: "Lost", today: "2026-10-15" }),
    (error: unknown) => error instanceof AppError && error.fields?.lostReason === "Lost reason is required",
  );
  assert.equal(resolveOpportunityClose({ stage: "Won", today: "2026-10-15" }).closedOn, "2026-10-15");
  const priced = calculateProposal({
    rateBps: 1800,
    lines: [{ description: "Design", quantity: 2, unitPriceRupees: 50000, discountRupees: 5000 }],
  });
  assert.equal(priced.subtotalPaise, 10_000_000);
  assert.equal(priced.discountPaise, 500_000);
  assert.equal(priced.taxPaise, 1_710_000);
  assert.equal(priced.totalPaise, 11_210_000);
  const forecast = buildForecast([
    { stage: "Qualification", ownerEmployeeId: null, valuePaise: 100_000, expectedClose: "2026-10-20", closedOn: null },
    { stage: "Won", ownerEmployeeId: null, valuePaise: 50_000, expectedClose: "2026-10-01", closedOn: "2026-10-05" },
  ], [], { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(forecast.pipelineValuePaise, 100_000);
  assert.equal(forecast.weightedForecastPaise, null);
  assert.equal(forecast.weighting, "unconfigured");
  assert.equal(forecast.wonValuePaise, 50_000);
});

test("sales pipeline supports search, pagination, stage changes, permissions, and audit", async () => {
  const state = salesApp(permissionsForRole("super_admin"));
  const client = await seedClient(state.clients, "org-1", "CLT-1", "Northwind");
  const sibling = await seedClient(state.clients, "org-1", "CLT-9", "Contoso");
  const otherClient = await seedClient(state.clients, "org-2", "CLT-2", "Other");
  const employee = await state.employees.insert({
    organizationId: "org-1",
    code: "EMP-1",
    name: "Sam Sales",
    jobTitle: "Executive",
    department: "Sales",
    email: null,
    salaryRupees: 0,
  });
  const lead = await state.leads.insert({
    organizationId: "org-1",
    code: "LD-1",
    company: "Northwind",
    person: "Ada",
    value: 1000,
    source: "Website",
    priority: "High",
    expectedClose: "2026-12-01",
    probability: 20,
  });
  const storedLead = state.leads.records.find((record) => record.id === lead.id);
  assert.ok(storedLead);
  storedLead.clientId = client.id;

  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/sales/opportunities`)).status, 401);

    const invalid = await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reference: "OPP-1",
        title: "Website rebuild",
        value: -1,
        expectedClose: "2026-11-01",
        source: "Referral",
        priority: "High",
      }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(state.opportunities.records.length, 0);

    const missingClient = await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reference: "OPP-1",
        title: "Website rebuild",
        clientId: otherClient.id,
        value: 30000,
        expectedClose: "2026-11-01",
        source: "Referral",
        priority: "High",
        organizationId: "org-2",
      }),
    });
    assert.equal(missingClient.status, 404);

    const mismatched = await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reference: "OPP-1",
        title: "Website rebuild",
        clientId: sibling.id,
        leadId: lead.id,
        value: 30000,
        expectedClose: "2026-11-01",
        source: "Referral",
        priority: "High",
      }),
    });
    assert.equal(mismatched.status, 409);

    const created = await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reference: "OPP-1",
        title: "Website rebuild",
        clientId: client.id,
        leadId: lead.id,
        ownerEmployeeId: employee.id,
        value: 30000,
        expectedClose: "2026-11-01",
        source: "Referral",
        priority: "High",
        notes: "Kickoff",
        organizationId: "org-2",
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.stage, "Qualification");
    assert.equal(createdBody.data.value, 30000);
    assert.equal(createdBody.data.closedOn, null);
    assert.equal(createdBody.data.stageHistory.length, 1);
    assert.equal(createdBody.data.stageHistory[0].fromStage, null);
    assert.equal(state.opportunities.records[0]?.organizationId, "org-1");
    assert.equal(state.opportunities.records[0]?.valuePaise, 3_000_000);
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);
    const id = createdBody.data.id as string;

    const duplicate = await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reference: "OPP-1",
        title: "Copy",
        value: 1,
        expectedClose: "2026-11-02",
        source: "Referral",
        priority: "Low",
      }),
    });
    assert.equal(duplicate.status, 409);

    const patched = await fetch(`${baseUrl}/api/sales/opportunities/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "Website programme", stage: "Won", value: 32000 }),
    });
    const patchedBody = await patched.json();
    assert.equal(patched.status, 200);
    assert.equal(patchedBody.data.title, "Website programme");
    assert.equal(patchedBody.data.stage, "Qualification");
    assert.equal(patchedBody.data.value, 32000);

    await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reference: "OPP-2", title: "Brochure", value: 10000, expectedClose: "2026-10-20", source: "Website", priority: "Medium" }),
    });
    await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reference: "OPP-3", title: "Portal", value: 20000, expectedClose: "2026-12-01", source: "Website", priority: "Low" }),
    });

    const listed = await fetch(`${baseUrl}/api/sales/opportunities?page=2&pageSize=2&sort=value&direction=desc`, { headers });
    const listedBody = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedBody.data.total, 3);
    assert.equal(listedBody.data.page, 2);
    assert.equal(listedBody.data.items.length, 1);
    assert.equal(listedBody.data.items[0].value, 10000);

    const searched = await fetch(`${baseUrl}/api/sales/opportunities?search=brochure&pageSize=1&page=1`, { headers });
    const searchedBody = await searched.json();
    assert.equal(searched.status, 200);
    assert.equal(searchedBody.data.total, 1);
    assert.equal(searchedBody.data.items[0].reference, "OPP-2");

    const summary = await fetch(`${baseUrl}/api/sales/opportunities/summary`, { headers });
    const summaryBody = await summary.json();
    assert.equal(summary.status, 200);
    assert.equal(summaryBody.data.stages.find((stage: { stage: string }) => stage.stage === "Qualification").count, 3);
    assert.equal(summaryBody.data.open.count, 3);
    assert.equal(summaryBody.data.closed.count, 0);

    const lost = await fetch(`${baseUrl}/api/sales/opportunities/${id}/stage`, {
      method: "POST",
      headers,
      body: JSON.stringify({ stage: "Lost" }),
    });
    assert.equal(lost.status, 400);
    assert.equal((await lost.json()).error.fields.lostReason, "Lost reason is required");
    assert.equal(state.opportunities.records.find((record) => record.id === id)?.stage, "Qualification");

    const won = await fetch(`${baseUrl}/api/sales/opportunities/${id}/stage`, {
      method: "POST",
      headers,
      body: JSON.stringify({ stage: "Won" }),
    });
    const wonBody = await won.json();
    assert.equal(won.status, 200);
    assert.equal(wonBody.data.stage, "Won");
    assert.equal(wonBody.data.closedOn, todayUtc());
    assert.equal(wonBody.data.lostReason, null);
    assert.equal(wonBody.data.stageHistory.length, 2);

    const again = await fetch(`${baseUrl}/api/sales/opportunities/${id}/stage`, {
      method: "POST",
      headers,
      body: JSON.stringify({ stage: "Won" }),
    });
    assert.equal(again.status, 409);

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    assert.equal((await fetch(`${baseUrl}/api/sales/opportunities/${id}`, { headers: { cookie: otherCookie } })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/sales/opportunities/${MISSING_ID}`, { headers })).status, 404);
    const otherList = await fetch(`${baseUrl}/api/sales/opportunities`, { headers: { cookie: otherCookie } });
    assert.equal((await otherList.json()).data.total, 0);

    const logs = await fetch(`${baseUrl}/api/audit-logs?resourceType=opportunity&pageSize=50`, { headers });
    const logsBody = await logs.json();
    assert.equal(logs.status, 200);
    const actions = logsBody.data.items.map((item: { action: string }) => item.action);
    assert.equal(actions.includes("opportunity.create"), true);
    assert.equal(actions.includes("opportunity.stage"), true);
    const stageLog = state.audit.records.find((record) => record.action === "opportunity.stage" && record.resourceId === id);
    assert.equal(stageLog?.actorUserId, ACTOR_ID);
    assert.equal(stageLog?.metadata.from, "Qualification");
    assert.equal(stageLog?.metadata.to, "Won");
  });

  const denied = salesApp(permissionsForRole("admin"));
  await withHttp(denied.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/sales/opportunities`, { headers })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/sales/forecast?from=2026-10-01&to=2026-10-31`, { headers })).status, 403);
    const blocked = await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reference: "OPP-9", title: "Blocked", value: 1, expectedClose: "2026-11-01", source: "Referral", priority: "Low" }),
    });
    assert.equal(blocked.status, 403);
  });

  const sales = salesApp(permissionsForRole("sales_executive"));
  await withHttp(sales.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const created = await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ reference: "OPP-8", title: "Allowed", value: 10, expectedClose: "2026-11-01", source: "Referral", priority: "Low" }),
    });
    assert.equal(created.status, 201);
  });
});

test("forecast reads opportunity records and leaves weighted value unset until probabilities are configured", async () => {
  const state = salesApp(permissionsForRole("super_admin"));
  const employee = await state.employees.insert({
    organizationId: "org-1",
    code: "EMP-1",
    name: "Sam Sales",
    jobTitle: "Executive",
    department: "Sales",
    email: null,
    salaryRupees: 0,
  });
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const create = (body: Record<string, unknown>) => fetch(`${baseUrl}/api/sales/opportunities`, { method: "POST", headers, body: JSON.stringify(body) });
    assert.equal((await create({ reference: "OPP-A", title: "October", ownerEmployeeId: employee.id, value: 1000, expectedClose: "2026-10-20", source: "Referral", priority: "High", stage: "Qualification" })).status, 201);
    assert.equal((await create({ reference: "OPP-B", title: "November", value: 4000, expectedClose: "2026-11-02", source: "Website", priority: "Medium", stage: "Discovery" })).status, 201);
    assert.equal((await create({ reference: "OPP-C", title: "Closed", value: 500, expectedClose: "2026-10-01", source: "Referral", priority: "High", stage: "Won", closedOn: "2026-10-05" })).status, 201);
    assert.equal((await create({ reference: "OPP-D", title: "Earlier loss", value: 200, expectedClose: "2026-09-01", source: "Referral", priority: "Low", stage: "Lost", lostReason: "Budget", closedOn: "2026-09-01" })).status, 201);

    const first = await fetch(`${baseUrl}/api/sales/forecast?from=2026-10-01&to=2026-10-31`, { headers });
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.equal(firstBody.data.pipelineValue, 5000);
    assert.equal(firstBody.data.periodPipelineValue, 1000);
    assert.equal(firstBody.data.weightedForecast, null);
    assert.equal(firstBody.data.periodWeightedForecast, null);
    assert.equal(firstBody.data.weighting, "unconfigured");
    assert.equal(firstBody.data.unweightedPipelineValue, 5000);
    assert.equal(firstBody.data.closedDeals.basis, "opportunity_closed_value");
    assert.equal(firstBody.data.closedDeals.wonValue, 500);
    assert.equal(firstBody.data.closedDeals.wonCount, 1);
    assert.equal(firstBody.data.closedDeals.lostValue, 0);
    assert.equal(firstBody.data.closedDeals.lostCount, 0);
    assert.equal(Object.hasOwn(firstBody.data, "revenue"), false);
    assert.equal(firstBody.data.byExpectedCloseMonth.length, 1);
    assert.equal(firstBody.data.byExpectedCloseMonth[0].month, "2026-10");
    assert.equal(firstBody.data.byStage.find((stage: { stage: string }) => stage.stage === "Won").value, 500);

    const duplicate = await fetch(`${baseUrl}/api/sales/stage-probabilities`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ stages: [{ stage: "Qualification", probability: 10 }, { stage: "Qualification", probability: 20 }] }),
    });
    assert.equal(duplicate.status, 400);
    assert.equal((await (await fetch(`${baseUrl}/api/sales/forecast?from=2026-10-01&to=2026-10-31`, { headers })).json()).data.weighting, "unconfigured");

    const partial = await fetch(`${baseUrl}/api/sales/stage-probabilities`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ stages: [{ stage: "Qualification", probability: 25 }] }),
    });
    assert.equal(partial.status, 200);
    const partialForecast = await (await fetch(`${baseUrl}/api/sales/forecast?from=2026-10-01&to=2026-10-31`, { headers })).json();
    assert.equal(partialForecast.data.weighting, "partial");
    assert.equal(partialForecast.data.weightedForecast, 250);
    assert.equal(partialForecast.data.periodWeightedForecast, 250);
    assert.equal(partialForecast.data.unweightedPipelineValue, 4000);
    assert.equal(partialForecast.data.pipelineValue, 5000);
    const qualification = partialForecast.data.byStage.find((stage: { stage: string }) => stage.stage === "Qualification");
    assert.equal(qualification.probability, 25);
    assert.equal(qualification.weightedForecast, 250);
    assert.equal(partialForecast.data.byStage.find((stage: { stage: string }) => stage.stage === "Discovery").weightedForecast, null);

    const complete = await fetch(`${baseUrl}/api/sales/stage-probabilities`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        stages: [
          { stage: "Negotiation", probability: 10 },
          { stage: "Qualification", probability: 25 },
          { stage: "Discovery", probability: 50 },
          { stage: "Proposal", probability: 10 },
        ],
      }),
    });
    const completeBody = await complete.json();
    assert.equal(complete.status, 200);
    assert.deepEqual(completeBody.data.stages.map((stage: { stage: string }) => stage.stage), ["Qualification", "Discovery", "Proposal", "Negotiation"]);
    const completeForecast = await (await fetch(`${baseUrl}/api/sales/forecast?from=2026-10-01&to=2026-10-31`, { headers })).json();
    assert.equal(completeForecast.data.weighting, "complete");
    assert.equal(completeForecast.data.weightedForecast, 2250);
    assert.equal(completeForecast.data.unweightedPipelineValue, 0);
    const owner = completeForecast.data.byOwner.find((row: { ownerEmployeeId: string | null }) => row.ownerEmployeeId === employee.id);
    assert.equal(owner.pipelineValue, 1000);
    assert.equal(owner.weightedForecast, 250);

    const cleared = await fetch(`${baseUrl}/api/sales/stage-probabilities`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ stages: [] }),
    });
    assert.equal(cleared.status, 200);
    assert.equal((await cleared.json()).data.stages.length, 0);
    assert.equal((await (await fetch(`${baseUrl}/api/sales/forecast?from=2026-10-01&to=2026-10-31`, { headers })).json()).data.weightedForecast, null);

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    const otherForecast = await (await fetch(`${baseUrl}/api/sales/forecast?from=2026-10-01&to=2026-10-31`, { headers: { cookie: otherCookie } })).json();
    assert.equal(otherForecast.data.pipelineValue, 0);
    assert.equal(otherForecast.data.closedDeals.wonValue, 0);
  });

  const viewer = salesApp(["forecast:view"]);
  await withHttp(viewer.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/sales/forecast?from=2026-10-01&to=2026-10-31`, { headers })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/sales/stage-probabilities`, { method: "PUT", headers, body: JSON.stringify({ stages: [] }) })).status, 403);
  });
});

test("proposals calculate totals on the server and acceptance does not win the opportunity", async () => {
  const state = salesApp(permissionsForRole("super_admin"));
  const client = await seedClient(state.clients, "org-1", "CLT-1", "Northwind");
  const other = await seedClient(state.clients, "org-2", "CLT-2", "Other");
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const opportunity = await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reference: "OPP-1",
        title: "Website rebuild",
        clientId: client.id,
        value: 100000,
        expectedClose: "2026-12-01",
        source: "Referral",
        priority: "High",
        stage: "Proposal",
      }),
    });
    const opportunityId = (await opportunity.json()).data.id as string;

    const tooMuch = await fetch(`${baseUrl}/api/sales/proposals`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: "P-1",
        title: "Website",
        clientId: client.id,
        validityDate: "2026-12-01",
        rateBps: 1800,
        lines: [{ description: "Design", quantity: 1, unitPrice: 100, discount: 101 }],
      }),
    });
    assert.equal(tooMuch.status, 400);
    assert.equal(state.proposals.records.length, 0);

    const created = await fetch(`${baseUrl}/api/sales/proposals`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: "P-1",
        title: "Website",
        clientId: client.id,
        opportunityId,
        validityDate: "2026-12-01",
        rateBps: 1800,
        notes: "Internal note",
        lines: [{ description: "Design", quantity: 2, unitPrice: 50000, discount: 5000 }],
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.status, "Draft");
    assert.equal(createdBody.data.subtotal, 100000);
    assert.equal(createdBody.data.discount, 5000);
    assert.equal(createdBody.data.tax, 17100);
    assert.equal(createdBody.data.total, 112100);
    assert.equal(createdBody.data.lines[0].amount, 95000);
    assert.equal(createdBody.data.statusHistory[0].toStatus, "Draft");
    assert.equal(createdBody.data.sentAt, null);
    assert.equal(JSON.stringify(createdBody).includes("emailed"), false);
    assert.equal(JSON.stringify(createdBody).includes("signed"), false);
    const id = createdBody.data.id as string;

    const edited = await fetch(`${baseUrl}/api/sales/proposals/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "Website programme" }),
    });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).data.total, 112100);

    const skipped = await fetch(`${baseUrl}/api/sales/proposals/${id}/status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "Accepted" }),
    });
    assert.equal(skipped.status, 409);
    assert.equal(state.opportunities.records[0]?.stage, "Proposal");

    const sent = await fetch(`${baseUrl}/api/sales/proposals/${id}/status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "Sent" }),
    });
    const sentBody = await sent.json();
    assert.equal(sent.status, 200);
    assert.equal(sentBody.data.status, "Sent");
    assert.equal(typeof sentBody.data.sentAt, "string");
    assert.equal(sentBody.data.acceptedAt, null);

    const locked = await fetch(`${baseUrl}/api/sales/proposals/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "Changed after send" }),
    });
    assert.equal(locked.status, 409);
    assert.equal(state.proposals.records[0]?.title, "Website programme");

    const accepted = await fetch(`${baseUrl}/api/sales/proposals/${id}/status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "Accepted" }),
    });
    const acceptedBody = await accepted.json();
    assert.equal(accepted.status, 200);
    assert.equal(acceptedBody.data.status, "Accepted");
    assert.equal(typeof acceptedBody.data.acceptedAt, "string");
    assert.equal(acceptedBody.data.statusHistory.length, 3);
    const stillOpen = await (await fetch(`${baseUrl}/api/sales/opportunities/${opportunityId}`, { headers })).json();
    assert.equal(stillOpen.data.stage, "Proposal");
    assert.equal(state.audit.records.some((record) => record.action === "opportunity.stage"), false);
    assert.equal(state.audit.records.some((record) => record.action === "proposal.status" && record.metadata.to === "Accepted"), true);

    const wrongClient = await fetch(`${baseUrl}/api/sales/proposals`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: "P-2",
        title: "Mismatch",
        clientId: other.id,
        opportunityId,
        validityDate: "2026-12-01",
        rateBps: 0,
        lines: [{ description: "Design", quantity: 1, unitPrice: 10, discount: 0 }],
      }),
    });
    assert.equal(wrongClient.status, 404);

    const listed = await fetch(`${baseUrl}/api/sales/proposals?status=Accepted&search=website&pageSize=1`, { headers });
    const listedBody = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedBody.data.total, 1);
    assert.equal(listedBody.data.items[0].lines, undefined);
  });
});

test("agreements validate dates, links, and permitted status changes", async () => {
  const state = salesApp(permissionsForRole("super_admin"));
  const client = await seedClient(state.clients, "org-1", "CLT-1", "Northwind");
  const other = await seedClient(state.clients, "org-2", "CLT-2", "Other");
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const opportunity = await (await fetch(`${baseUrl}/api/sales/opportunities`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reference: "OPP-1", title: "Retainer", clientId: client.id, value: 120000, expectedClose: "2026-11-01", source: "Referral", priority: "High" }),
    })).json();
    const proposal = await (await fetch(`${baseUrl}/api/sales/proposals`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: "P-1",
        title: "Retainer",
        clientId: client.id,
        opportunityId: opportunity.data.id,
        validityDate: "2026-12-01",
        rateBps: 0,
        lines: [{ description: "Retainer", quantity: 1, unitPrice: 120000, discount: 0 }],
      }),
    })).json();

    const invalidDates = await fetch(`${baseUrl}/api/sales/agreements`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: "A-1",
        title: "Retainer",
        clientId: client.id,
        startDate: "2027-01-01",
        endDate: "2026-01-01",
        value: 120000,
      }),
    });
    assert.equal(invalidDates.status, 400);
    assert.equal(state.agreements.records.length, 0);

    const wrongProposal = await fetch(`${baseUrl}/api/sales/agreements`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: "A-1",
        title: "Retainer",
        clientId: other.id,
        proposalId: proposal.data.id,
        startDate: "2026-11-01",
        endDate: "2027-10-31",
        value: 120000,
      }),
    });
    assert.equal(wrongProposal.status, 404);

    const created = await fetch(`${baseUrl}/api/sales/agreements`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: "A-1",
        title: "Retainer",
        description: "Annual support",
        clientId: client.id,
        opportunityId: opportunity.data.id,
        proposalId: proposal.data.id,
        startDate: "2026-11-01",
        endDate: "2027-10-31",
        value: 120000,
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.status, "Draft");
    assert.equal(createdBody.data.value, 120000);
    assert.equal(createdBody.data.activatedAt, null);
    assert.equal(JSON.stringify(createdBody).includes("signature"), false);
    const id = createdBody.data.id as string;

    const skip = await fetch(`${baseUrl}/api/sales/agreements/${id}/status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "Completed" }),
    });
    assert.equal(skip.status, 409);

    const active = await fetch(`${baseUrl}/api/sales/agreements/${id}/status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "Active" }),
    });
    const activeBody = await active.json();
    assert.equal(active.status, 200);
    assert.equal(activeBody.data.status, "Active");
    assert.equal(typeof activeBody.data.activatedAt, "string");

    const lockedClient = await fetch(`${baseUrl}/api/sales/agreements/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ clientId: client.id }),
    });
    assert.equal(lockedClient.status, 409);

    const amended = await fetch(`${baseUrl}/api/sales/agreements/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ value: 125000, endDate: "2027-12-31" }),
    });
    const amendedBody = await amended.json();
    assert.equal(amended.status, 200);
    assert.equal(amendedBody.data.value, 125000);
    assert.equal(amendedBody.data.endDate, "2027-12-31");
    assert.equal(state.agreements.records[0]?.valuePaise, 12_500_000);

    const badEnd = await fetch(`${baseUrl}/api/sales/agreements/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ endDate: "2026-01-01" }),
    });
    assert.equal(badEnd.status, 400);

    const terminated = await fetch(`${baseUrl}/api/sales/agreements/${id}/status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "Terminated" }),
    });
    const terminatedBody = await terminated.json();
    assert.equal(terminated.status, 200);
    assert.equal(terminatedBody.data.status, "Terminated");
    assert.equal(terminatedBody.data.statusHistory.length, 3);
    assert.equal(typeof terminatedBody.data.terminatedAt, "string");

    const closedEdit = await fetch(`${baseUrl}/api/sales/agreements/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "Changed" }),
    });
    assert.equal(closedEdit.status, 409);

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    assert.equal((await fetch(`${baseUrl}/api/sales/agreements/${id}`, { headers: { cookie: otherCookie } })).status, 404);
    const listed = await fetch(`${baseUrl}/api/sales/agreements?status=Terminated&search=retainer`, { headers });
    assert.equal((await listed.json()).data.total, 1);
    assert.equal(state.audit.records.some((record) => record.action === "agreement.create"), true);
    assert.equal(state.audit.records.some((record) => record.action === "agreement.status" && record.metadata.to === "Terminated"), true);
    assert.equal(state.opportunities.records[0]?.stage, "Qualification");
  });

  const manager = salesApp(permissionsForRole("project_manager"));
  await withHttp(manager.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    assert.equal((await fetch(`${baseUrl}/api/sales/agreements`, { headers: { cookie } })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/sales/proposals`, { headers: { cookie } })).status, 403);
  });
});

test("sales migration adds tables and grants new permissions without resetting roles", () => {
  const sql = readFileSync(new URL("../drizzle/0010_sales.sql", import.meta.url), "utf8");
  for (const table of [
    "opportunities",
    "opportunity_stage_events",
    "opportunity_stage_probabilities",
    "proposals",
    "proposal_lines",
    "proposal_status_events",
    "agreements",
    "agreement_status_events",
  ]) {
    assert.equal(sql.includes(`CREATE TABLE "${table}"`), true, table);
  }
  assert.equal(sql.includes("opportunities_close_check"), true);
  assert.equal(sql.includes("proposals_money_check"), true);
  assert.equal(sql.includes("agreements_dates_check"), true);
  assert.equal(/insert\s+into\s+"(opportunities|proposals|agreements|proposal_lines|opportunity_stage_events)"/i.test(sql), false);
  assert.equal(/delete\s+from/i.test(sql), false);
  assert.equal(/update\s+"role_permissions"/i.test(sql), false);
  assert.equal(/update\s+"permissions"/i.test(sql), false);
  assert.equal(sql.includes("WHERE r.\"key\" IN ('super_admin', 'sales_executive')"), true);
  assert.equal(sql.includes("NOT EXISTS"), true);
  for (const permission of ["pipeline:view", "pipeline:create", "pipeline:update", "pipeline:move_stage", "forecast:view", "proposals:change_status", "agreements:change_status"]) {
    assert.equal(sql.includes(`'${permission}'`), true, permission);
  }
  for (const role of ["admin", "project_manager", "developer", "accountant", "hr", "client", "marketing_executive"]) {
    assert.equal(sql.includes(`'${role}'`), false, role);
  }
});
