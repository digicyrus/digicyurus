import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryInsightStore, emptyInsightData, type InsightData } from "./memory-insights.js";
import { withHttp } from "./http.js";

function insightApp(permissions: readonly string[], data: InsightData) {
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
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    insights: { store: createMemoryInsightStore(data) },
  });
  return { app };
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

function sampleData(): InsightData {
  const data = emptyInsightData();
  data.clients.push(
    { organizationId: "org-1", customerSince: "2026-07-01" },
    { organizationId: "org-2", customerSince: "2026-07-01" },
  );
  data.leads.push(
    { organizationId: "org-1", stage: "New", source: "Website", valuePaise: 10000, createdAt: new Date("2026-07-02T00:00:00.000Z") },
    { organizationId: "org-1", stage: "New", source: "Website", valuePaise: 5000, createdAt: new Date("2026-07-03T00:00:00.000Z") },
    { organizationId: "org-1", stage: "Won", source: "Referral", valuePaise: 20000, createdAt: new Date("2026-08-01T00:00:00.000Z") },
    { organizationId: "org-2", stage: "New", source: "Website", valuePaise: 90000, createdAt: new Date("2026-07-02T00:00:00.000Z") },
  );
  data.projects.push(
    { organizationId: "org-1", status: "On Track", startDate: "2026-07-01" },
    { organizationId: "org-1", status: "Delayed", startDate: "2026-06-01" },
    { organizationId: "org-2", status: "On Track", startDate: "2026-07-01" },
  );
  data.tasks.push({ organizationId: "org-1", status: "Backlog", dueDate: "2026-07-04" });
  data.followUps.push({ organizationId: "org-1", status: "Due", dueAt: new Date("2026-07-04T10:00:00.000Z") });
  data.invoices.push(
    { organizationId: "org-1", status: "Pending", issueDate: "2026-07-01", totalPaise: 100000, amountPaidPaise: 40000, taxPaise: 18000 },
    { organizationId: "org-1", status: "Draft", issueDate: "2026-07-01", totalPaise: 900000, amountPaidPaise: 0, taxPaise: 0 },
    { organizationId: "org-1", status: "Pending", issueDate: "2026-06-01", totalPaise: 100000, amountPaidPaise: 10000, taxPaise: 0 },
    { organizationId: "org-2", status: "Pending", issueDate: "2026-07-01", totalPaise: 500000, amountPaidPaise: 0, taxPaise: 0 },
  );
  data.payments.push(
    { organizationId: "org-1", paidOn: "2026-07-15", amountPaise: 40000 },
    { organizationId: "org-1", paidOn: "2026-08-01", amountPaise: 10000 },
  );
  data.expenses.push({ organizationId: "org-1", spentOn: "2026-07-02", amountPaise: 20000 });
  data.employees.push(
    { organizationId: "org-1", createdAt: new Date("2026-07-01T00:00:00.000Z") },
    { organizationId: "org-1", createdAt: new Date("2026-05-01T00:00:00.000Z") },
  );
  data.campaigns.push(
    { organizationId: "org-1", spendPaise: 22000000, leads: 148, createdAt: new Date("2026-07-01T00:00:00.000Z") },
    { organizationId: "org-1", spendPaise: 8000000, leads: 10, createdAt: new Date("2026-07-08T00:00:00.000Z") },
  );
  data.content.push({ organizationId: "org-1", status: "Published", publishDate: "2026-07-06" });
  data.referrals.push({ organizationId: "org-1", revenuePaise: 145000000, commissionPaise: 5000000, createdAt: new Date("2026-07-01T00:00:00.000Z") });
  data.attendance.push(
    { organizationId: "org-1", workDate: "2026-07-03" },
    { organizationId: "org-1", workDate: "2026-08-03" },
  );
  return data;
}

test("dashboard totals follow permissions and ignore drafts and other organizations", async () => {
  const data = sampleData();
  const admin = insightApp(permissionsForRole("admin"), data);
  await withHttp(admin.app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/dashboard/summary`)).status, 401);
    const cookie = await signIn(baseUrl);
    const response = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.clients, 1);
    assert.equal(body.data.leads, null);
    assert.equal(body.data.projects.total, 2);
    assert.equal(body.data.projects.byStatus.Delayed, 1);
    assert.equal(body.data.tasks.total, 1);
    assert.equal(body.data.finance.issued, 2000);
    assert.equal(body.data.finance.collected, 500);
    assert.equal(body.data.finance.outstanding, 1500);
    assert.equal(body.data.finance.expenses, 200);
    assert.equal(body.data.finance.profit, 1800);
    assert.equal(body.data.finance.tax, undefined);
    assert.equal(body.data.employees, 2);
    assert.equal(body.data.referrals.commission, 50000);
    assert.equal(body.data.campaigns, null);
    assert.equal(body.data.attendance, 2);
    assert.equal(JSON.stringify(body).includes("org-1"), false);

    const other = await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie: await signIn(baseUrl, "bob@digicyrus.example") } });
    const otherBody = await other.json();
    assert.equal(otherBody.data.clients, 1);
    assert.equal(otherBody.data.finance.issued, 5000);
    assert.equal(otherBody.data.projects.total, 1);
  });

  const sales = insightApp(permissionsForRole("sales_executive"), data);
  await withHttp(sales.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const body = await (await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie } })).json();
    assert.equal(body.data.leads.total, 3);
    assert.equal(body.data.leads.byStage.New, 2);
    assert.equal(body.data.leads.bySource.Website, 2);
    assert.equal(body.data.leads.value, 350);
    assert.equal(body.data.followUps.byStatus.Due, 1);
    assert.equal(body.data.finance, null);
    assert.equal(body.data.projects, null);
    assert.equal(body.data.employees, null);
  });

  const empty = insightApp(permissionsForRole("admin"), emptyInsightData());
  await withHttp(empty.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const body = await (await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie } })).json();
    assert.equal(body.data.clients, 0);
    assert.equal(body.data.finance.issued, 0);
    assert.equal(body.data.projects.byStatus.Completed, 0);
  });

  const developer = insightApp(permissionsForRole("developer"), data);
  await withHttp(developer.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    assert.equal((await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie } })).status, 403);
  });
});

test("reports aggregate a date range and keep module data behind its permission", async () => {
  const data = sampleData();
  const admin = insightApp(permissionsForRole("admin"), data);
  await withHttp(admin.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie };
    const backwards = await fetch(`${baseUrl}/api/reports/overview?from=2026-08-01&to=2026-07-01`, { headers });
    assert.equal(backwards.status, 400);

    const overview = await fetch(`${baseUrl}/api/reports/overview?from=2026-07-01&to=2026-07-31`, { headers });
    const overviewBody = await overview.json();
    assert.equal(overview.status, 200);
    assert.equal(overviewBody.data.finance.issued, 1000);
    assert.equal(overviewBody.data.finance.collected, 400);
    assert.equal(overviewBody.data.finance.outstanding, 600);
    assert.equal(overviewBody.data.finance.expenses, 200);
    assert.equal(overviewBody.data.finance.tax, 180);
    assert.equal(overviewBody.data.finance.profit, 800);
    assert.equal(overviewBody.data.projects.total, 1);
    assert.equal(overviewBody.data.employees, 1);
    assert.equal(overviewBody.data.attendance, 1);
    assert.equal(overviewBody.data.leads, null);

    const finance = await fetch(`${baseUrl}/api/reports/finance?from=2026-07-01&to=2026-08-31`, { headers });
    const financeBody = await finance.json();
    assert.equal(finance.status, 200);
    assert.equal(financeBody.data.issued, 1000);
    assert.equal(financeBody.data.collected, 500);
    const august = financeBody.data.months.find((month: { month: string }) => month.month === "2026-08");
    assert.equal(august.revenue, 0);
    assert.equal(august.inflow, 100);
    assert.equal(august.outflow, 0);
    const july = financeBody.data.months.find((month: { month: string }) => month.month === "2026-07");
    assert.equal(july.revenue, 1000);
    assert.equal(july.expenses, 200);
    assert.equal(july.inflow, 400);

    const projects = await fetch(`${baseUrl}/api/reports/projects`, { headers });
    const projectsBody = await projects.json();
    assert.equal(projectsBody.data.total, 2);
    assert.equal(projectsBody.data.tasks.total, 1);
    assert.equal((await fetch(`${baseUrl}/api/reports/sales`, { headers })).status, 403);
  });

  const marketing = insightApp(permissionsForRole("marketing_executive"), data);
  await withHttp(marketing.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie };
    assert.equal((await fetch(`${baseUrl}/api/dashboard/summary`, { headers })).status, 403);
    const overview = await (await fetch(`${baseUrl}/api/reports/overview`, { headers })).json();
    assert.equal(overview.data.leads.total, 3);
    assert.equal(overview.data.campaigns.spend, 300000);
    assert.equal(overview.data.campaigns.leads, 158);
    assert.equal(overview.data.campaigns.roi, undefined);
    assert.equal(overview.data.content.byStatus.Published, 1);
    assert.equal(overview.data.finance, null);
    const marketingReport = await (await fetch(`${baseUrl}/api/reports/marketing`, { headers })).json();
    assert.equal(marketingReport.data.campaigns.spend, 300000);
    assert.equal((await fetch(`${baseUrl}/api/reports/finance`, { headers })).status, 403);
    const sales = await (await fetch(`${baseUrl}/api/reports/sales`, { headers })).json();
    assert.equal(sales.data.value, 350);
    assert.equal(sales.data.byStage.Won, 1);
  });

  const accountant = insightApp(permissionsForRole("accountant"), data);
  await withHttp(accountant.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    assert.equal((await fetch(`${baseUrl}/api/reports/finance`, { headers: { cookie } })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/reports/hr`, { headers: { cookie } })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/dashboard/summary`, { headers: { cookie } })).status, 403);
  });

  const hr = insightApp(permissionsForRole("hr"), data);
  await withHttp(hr.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    assert.equal((await fetch(`${baseUrl}/api/reports/hr?from=2026-07-01&to=2026-07-31`, { headers: { cookie } })).status, 403);
  });

  await withHttp(admin.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const body = await (await fetch(`${baseUrl}/api/reports/hr?from=2026-07-01&to=2026-07-31`, { headers: { cookie } })).json();
    assert.equal(body.data.employees, 1);
    assert.equal(body.data.attendance, 1);
  });
});
