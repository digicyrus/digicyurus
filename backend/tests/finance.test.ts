import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import type { NewClient } from "../src/modules/crm/clients.store.js";
import { calculateInvoice, splitTax, taxPaise } from "../src/modules/finance/money.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryClientStore } from "./memory-crm.js";
import { createMemoryProjectStore } from "./memory-delivery.js";
import { createMemoryExpenseStore, createMemoryFinanceSummary, createMemoryInvoiceStore } from "./memory-finance.js";
import { withHttp } from "./http.js";

const MISSING_ID = "22222222-2222-4222-8222-222222222222";

function financeApp(permissions: string[], organizationId = "org-1") {
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
  const projects = createMemoryProjectStore();
  const invoices = createMemoryInvoiceStore();
  const expenses = createMemoryExpenseStore();
  const summary = createMemoryFinanceSummary(invoices.records, expenses.records);
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    finance: { clients, projects, invoices, expenses, summary },
  });
  return { app, clients, projects, invoices, expenses };
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

async function seedClientAndProject(appState: ReturnType<typeof financeApp>) {
  const client = await appState.clients.insert(clientInput("org-1"));
  const otherClient = await appState.clients.insert(clientInput("org-1", { code: "C-102", name: "Orbit Health" }));
  const foreignClient = await appState.clients.insert(clientInput("org-2", { code: "C-201", name: "Foreign" }));
  const project = await appState.projects.insert({
    organizationId: "org-1",
    clientId: client.id,
    managerEmployeeId: null,
    code: "P-330",
    name: "Nimbus Commerce Revamp",
    description: "",
    status: "On Track",
    priority: "High",
    startDate: "2026-07-01",
    dueDate: "2026-08-30",
  });
  const otherProject = await appState.projects.insert({
    organizationId: "org-1",
    clientId: otherClient.id,
    managerEmployeeId: null,
    code: "P-331",
    name: "Orbit Patient App",
    description: "",
    status: "On Track",
    priority: "Medium",
    startDate: "2026-07-01",
    dueDate: "2026-09-18",
  });
  return { client, otherClient, foreignClient, project, otherProject };
}

function invoiceBody(clientId: string, overrides: Record<string, unknown> = {}) {
  return {
    number: "INV-2041",
    clientId,
    issueDate: "2026-07-12",
    dueDate: "2027-03-01",
    status: "Pending",
    supply: "cgst_sgst",
    rateBps: 1800,
    lines: [{ description: "Commerce build", quantity: 2, unitPrice: 310000 }],
    ...overrides,
  };
}

test("invoice tax is integer paise and splits into CGST/SGST or IGST", () => {
  const intra = calculateInvoice({
    supply: "cgst_sgst",
    rateBps: 1800,
    lines: [{ description: "Commerce build", quantity: 2, unitPriceRupees: 310000 }],
  });
  assert.equal(intra.subtotalPaise, 62_000_000);
  assert.equal(intra.taxPaise, 11_160_000);
  assert.equal(intra.cgstPaise, 5_580_000);
  assert.equal(intra.sgstPaise, 5_580_000);
  assert.equal(intra.igstPaise, 0);
  assert.equal(intra.totalPaise, 73_160_000);

  const inter = splitTax(11_160_000, "igst");
  assert.deepEqual(inter, { cgstPaise: 0, sgstPaise: 0, igstPaise: 11_160_000 });

  assert.equal(taxPaise(100, 1800), 18);
  assert.deepEqual(splitTax(18, "cgst_sgst"), { cgstPaise: 9, sgstPaise: 9, igstPaise: 0 });
  assert.equal(taxPaise(5000, 1), 1);
  assert.equal(taxPaise(4999, 1), 0);
});

test("invoices calculate tax, isolate organizations, and lock issued documents", async () => {
  const state = financeApp([...permissionsForRole("admin")]);
  const { client, foreignClient, project, otherProject } = await seedClientAndProject(state);
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const anonymous = await fetch(`${baseUrl}/api/invoices`);
    assert.equal(anonymous.status, 401);

    const invalid = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(client.id, { dueDate: "2026-07-01", lines: [], rateBps: 18000 })),
    });
    assert.equal(invalid.status, 400);
    assert.equal(state.invoices.records.length, 0);

    const unknownClient = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(foreignClient.id)),
    });
    assert.equal(unknownClient.status, 404);
    const wrongProject = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(client.id, { projectId: otherProject.id })),
    });
    assert.equal(wrongProject.status, 409);

    const created = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...invoiceBody(client.id, { projectId: project.id }), organizationId: "org-2", subtotal: 1, tax: 1, total: 1 }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.subtotal, 620000);
    assert.equal(createdBody.data.tax, 111600);
    assert.equal(createdBody.data.cgst, 55800);
    assert.equal(createdBody.data.sgst, 55800);
    assert.equal(createdBody.data.igst, 0);
    assert.equal(createdBody.data.cgst + createdBody.data.sgst + createdBody.data.igst, createdBody.data.tax);
    assert.equal(createdBody.data.total, 731600);
    assert.equal(createdBody.data.amountPaid, 0);
    assert.equal(createdBody.data.balanceDue, 731600);
    assert.equal(createdBody.data.projectId, project.id);
    assert.equal(state.invoices.records[0]?.organizationId, "org-1");
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    const inter = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(client.id, { number: "INV-2042", supply: "igst", status: "Draft" })),
    });
    const interBody = await inter.json();
    assert.equal(inter.status, 201);
    assert.equal(interBody.data.igst, 111600);
    assert.equal(interBody.data.cgst, 0);
    assert.equal(interBody.data.sgst, 0);
    assert.equal(interBody.data.status, "Draft");

    const duplicate = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(client.id)),
    });
    assert.equal(duplicate.status, 409);

    const overdue = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(client.id, { number: "INV-2043", dueDate: "2026-07-26", lines: [{ description: "Portal", quantity: 1, unitPrice: 245000 }] })),
    });
    const overdueBody = await overdue.json();
    assert.equal(overdueBody.data.status, "Overdue");
    assert.equal(overdueBody.data.tax, 44100);

    const listed = await fetch(`${baseUrl}/api/invoices?search=2041&status=Pending&clientId=${client.id}&issueFrom=2026-07-01&issueTo=2026-07-31&dueFrom=2027-01-01&dueTo=2027-12-31&page=1&pageSize=10`, { headers });
    const listedBody = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedBody.data.total, 1);
    assert.equal(listedBody.data.items[0].number, "INV-2041");

    const overdueList = await fetch(`${baseUrl}/api/invoices?status=Overdue`, { headers });
    assert.equal((await overdueList.json()).data.total, 1);
    const pendingOnly = await fetch(`${baseUrl}/api/invoices?status=Pending`, { headers });
    const pendingBody = await pendingOnly.json();
    assert.equal(pendingBody.data.total, 1);
    assert.equal(pendingBody.data.items[0].number, "INV-2041");

    const page = await fetch(`${baseUrl}/api/invoices?sort=number&page=2&pageSize=1`, { headers });
    assert.equal((await page.json()).data.items.length, 1);

    const missing = await fetch(`${baseUrl}/api/invoices/${MISSING_ID}`, { headers });
    assert.equal(missing.status, 404);
    const otherOrg = await signIn(baseUrl, "bob@digicyrus.example");
    const hidden = await fetch(`${baseUrl}/api/invoices/${createdBody.data.id}`, { headers: { cookie: otherOrg } });
    assert.equal(hidden.status, 404);

    const locked = await fetch(`${baseUrl}/api/invoices/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ dueDate: "2027-04-01" }),
    });
    assert.equal(locked.status, 409);

    const revised = await fetch(`${baseUrl}/api/invoices/${interBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ lines: [{ description: "Revised", quantity: 1, unitPrice: 100 }], status: "Pending" }),
    });
    const revisedBody = await revised.json();
    assert.equal(revised.status, 200);
    assert.equal(revisedBody.data.subtotal, 100);
    assert.equal(revisedBody.data.tax, 18);
    assert.equal(revisedBody.data.total, 118);
    assert.equal(revisedBody.data.status, "Pending");
    const issued = await fetch(`${baseUrl}/api/invoices/${interBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ number: "INV-9999" }),
    });
    assert.equal(issued.status, 409);
  });
});

test("payments update balances, reject duplicates and overpayment, and stay manual", async () => {
  const state = financeApp([...permissionsForRole("accountant")]);
  const { client } = await seedClientAndProject(state);
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const draft = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(client.id, { number: "INV-2045", status: "Draft" })),
    });
    const draftId = (await draft.json()).data.id as string;
    const draftPay = await fetch(`${baseUrl}/api/invoices/${draftId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paidOn: "2026-07-20", amount: 1000, method: "Bank transfer", reference: "UTR-1" }),
    });
    assert.equal(draftPay.status, 409);
    assert.equal(state.invoices.paymentRecords.length, 0);

    const created = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(client.id)),
    });
    const invoiceId = (await created.json()).data.id as string;
    const tooMuch = await fetch(`${baseUrl}/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paidOn: "2026-07-20", amount: 731601, method: "Bank transfer", reference: "UTR-OVER" }),
    });
    assert.equal(tooMuch.status, 409);
    assert.equal(state.invoices.paymentRecords.length, 0);
    assert.equal(state.invoices.records.find((invoice) => invoice.id === invoiceId)?.amountPaidPaise, 0);

    const partial = await fetch(`${baseUrl}/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paidOn: "2026-07-20", amount: 100000, method: "Bank transfer", reference: "UTR-100", notes: "First tranche" }),
    });
    const partialBody = await partial.json();
    assert.equal(partial.status, 201);
    assert.equal(partialBody.data.payment.amount, 100000);
    assert.equal(partialBody.data.payment.method, "Bank transfer");
    assert.equal(partialBody.data.invoice.amountPaid, 100000);
    assert.equal(partialBody.data.invoice.balanceDue, 631600);
    assert.equal(partialBody.data.invoice.status, "Pending");

    const duplicate = await fetch(`${baseUrl}/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paidOn: "2026-07-21", amount: 100000, method: "UPI", reference: "UTR-100" }),
    });
    assert.equal(duplicate.status, 409);
    assert.equal(state.invoices.paymentRecords.length, 1);

    const rest = await fetch(`${baseUrl}/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paidOn: "2026-07-22", amount: 631600, method: "Bank transfer", reference: "UTR-200" }),
    });
    const restBody = await rest.json();
    assert.equal(rest.status, 201);
    assert.equal(restBody.data.invoice.status, "Paid");
    assert.equal(restBody.data.invoice.balanceDue, 0);
    assert.equal(restBody.data.invoice.amountPaid, 731600);

    const again = await fetch(`${baseUrl}/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paidOn: "2026-07-23", amount: 1, method: "Cash", reference: "UTR-201" }),
    });
    assert.equal(again.status, 409);
    assert.equal(state.invoices.paymentRecords.length, 2);

    const detail = await fetch(`${baseUrl}/api/invoices/${invoiceId}`, { headers });
    assert.equal((await detail.json()).data.payments.length, 2);
    const missing = await fetch(`${baseUrl}/api/invoices/${MISSING_ID}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paidOn: "2026-07-20", amount: 1, method: "Cash", reference: "UTR-404" }),
    });
    assert.equal(missing.status, 404);
  });
});

test("expenses support crud and the accountant cannot create them", async () => {
  const admin = financeApp([...permissionsForRole("admin")]);
  await withHttp(admin.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const invalid = await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ category: "", amount: -1, date: "July" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(admin.expenses.records.length, 0);

    const created = await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ category: "Ad Spend", vendor: "Meta / Google", description: "July campaigns", amount: 480000, date: "2026-07-18", organizationId: "org-2" }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.amount, 480000);
    assert.equal(createdBody.data.category, "Ad Spend");
    assert.equal(admin.expenses.records[0]?.organizationId, "org-1");
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ category: "Software", description: "SaaS", amount: 165000, date: "2026-08-02" }),
    });
    const listed = await fetch(`${baseUrl}/api/expenses?search=meta&category=Ad%20Spend&from=2026-07-01&to=2026-07-31`, { headers });
    const listedBody = await listed.json();
    assert.equal(listedBody.data.total, 1);
    assert.equal(listedBody.data.items[0].id, createdBody.data.id);

    const updated = await fetch(`${baseUrl}/api/expenses/${createdBody.data.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ amount: 500000 }),
    });
    assert.equal((await updated.json()).data.amount, 500000);

    const otherOrg = await signIn(baseUrl, "bob@digicyrus.example");
    const hidden = await fetch(`${baseUrl}/api/expenses/${createdBody.data.id}`, { headers: { cookie: otherOrg } });
    assert.equal(hidden.status, 404);
    const missing = await fetch(`${baseUrl}/api/expenses/${MISSING_ID}`, { headers });
    assert.equal(missing.status, 404);
  });

  const accountant = financeApp([...permissionsForRole("accountant")]);
  await withHttp(accountant.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const listed = await fetch(`${baseUrl}/api/expenses`, { headers: { cookie } });
    assert.equal(listed.status, 200);
    const created = await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ category: "Software", amount: 1000, date: "2026-07-01" }),
    });
    assert.equal(created.status, 403);
  });
});

test("finance summary is derived from issued invoices, payments, and expenses", async () => {
  const state = financeApp([...permissionsForRole("admin")]);
  const { client } = await seedClientAndProject(state);
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const empty = await fetch(`${baseUrl}/api/finance/summary`, { headers });
    assert.deepEqual((await empty.json()).data, { issued: 0, collected: 0, outstanding: 0, expenses: 0 });

    await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(client.id, { status: "Draft", number: "INV-DRAFT" })),
    });
    const issued = await fetch(`${baseUrl}/api/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify(invoiceBody(client.id)),
    });
    const invoiceId = (await issued.json()).data.id as string;
    await fetch(`${baseUrl}/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paidOn: "2026-07-20", amount: 100000, method: "Bank transfer", reference: "UTR-100" }),
    });
    await fetch(`${baseUrl}/api/expenses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ category: "Software", amount: 165000, date: "2026-07-05", description: "SaaS" }),
    });
    state.expenses.records.push({
      id: "foreign-expense",
      organizationId: "org-2",
      category: "Rent",
      vendor: null,
      description: "",
      amountPaise: 999_900,
      spentOn: "2026-07-01",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const summary = await fetch(`${baseUrl}/api/finance/summary`, { headers });
    assert.deepEqual((await summary.json()).data, {
      issued: 731600,
      collected: 100000,
      outstanding: 631600,
      expenses: 165000,
    });
  });

  const developer = financeApp([...permissionsForRole("developer")]);
  await withHttp(developer.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const summary = await fetch(`${baseUrl}/api/finance/summary`, { headers: { cookie } });
    assert.equal(summary.status, 403);
    const invoices = await fetch(`${baseUrl}/api/invoices`, { headers: { cookie } });
    assert.equal(invoices.status, 403);
  });

  const sales = financeApp([...permissionsForRole("sales_executive")]);
  await withHttp(sales.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const expenses = await fetch(`${baseUrl}/api/expenses`, { headers: { cookie } });
    assert.equal(expenses.status, 403);
  });
});

test("finance migration declares invoice constraints and inserts no rows", () => {
  const sql = readFileSync(new URL("../drizzle/0004_finance.sql", import.meta.url), "utf8");
  assert.equal(/insert\s+into/i.test(sql), false);
  assert.equal(sql.includes("'Draft', 'Pending', 'Paid'"), true);
  assert.equal(sql.includes("'cgst_sgst'"), true);
  assert.equal(sql.includes("'igst'"), true);
  assert.equal(sql.includes("razorpay"), false);
  assert.equal(sql.includes("cashfree"), false);
});
