import assert from "node:assert/strict";
import { test } from "vitest";

import { ApiError, createApiClient } from "./api";
import { assetBody, canCreateAssets, canUpdateAssets, canViewAssets, createAssetsApi } from "./assets";
import { apiFailure } from "./crm";
import {
    availableSections,
    canViewDashboard,
    canViewFinanceReport,
    canViewHrReport,
    canViewMarketingReport,
    createInsightsApi,
    isCurrentReportRequest,
    loadReportSection,
    type InsightView,
} from "./insights";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const emptyView = {
    clients: null,
    leads: null,
    projects: null,
    tasks: null,
    followUps: null,
    finance: null,
    employees: null,
    campaigns: null,
    content: null,
    referrals: null,
    serviceRates: null,
    attendance: null,
} satisfies InsightView;

test("insights and assets follow permissions, date ranges, and whole rupees", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const insights = createInsightsApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            calls.push({ url, init });
            return jsonResponse({ data: { ...emptyView, clients: 4, leads: { total: 2, byStage: {}, bySource: {}, value: 1000 } }, error: null });
        },
    }));
    const assets = createAssetsApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            calls.push({ url, init });
            const body = init?.body ? JSON.parse(String(init.body)) as { name?: string } : null;
            if (body?.name === "Taken") {
                return jsonResponse({ data: null, error: { code: "CONFLICT", message: "This name is already in use", fields: { name: "Already in use" } } }, 409);
            }
            if (init?.method === "POST") {
                return jsonResponse({ data: null, error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);
            }
            return jsonResponse({ data: { items: [], total: 0 }, error: null });
        },
    }));

    const marketing = ["reports:view", "campaigns:view", "content:view"];
    assert.equal(canViewDashboard(marketing), false);
    assert.equal(canViewMarketingReport(marketing), true);
    assert.equal(canViewFinanceReport(marketing), false);
    assert.equal(canViewHrReport(["reports:view", "employees:view"]), true);
    assert.equal(canViewHrReport(["reports:view"]), false);
    assert.equal(canViewAssets(["assets:view"]), true);
    assert.equal(canCreateAssets(["assets:view"]), false);
    assert.equal(canUpdateAssets(["assets:update"]), true);

    const summary = await insights.dashboard();
    assert.equal(calls[0]?.url, "http://localhost:4000/api/dashboard/summary");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.deepEqual(availableSections(summary), ["clients", "leads"]);
    assert.equal(summary.finance, null);

    await insights.reports.overview({ from: "2026-07-01", to: "2026-07-31" });
    assert.equal(calls[1]?.url, "http://localhost:4000/api/reports/overview?from=2026-07-01&to=2026-07-31");
    await insights.reports.finance({});
    assert.equal(calls[2]?.url, "http://localhost:4000/api/reports/finance");

    const asset = assetBody({ name: "Taken", type: "Domain", vendor: "Namecheap", renewal: "2026-08-01", cost: "1200", status: "Active" });
    assert.equal(asset.ok, true);
    if (!asset.ok) return;
    assert.equal(asset.body.cost, 1200);
    assert.equal("organizationId" in asset.body, false);
    await assert.rejects(() => assets.create(asset.body), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(apiFailure(error).fields.name, "Already in use");
        return true;
    });
    const denied = assetBody({ name: "Mail", type: "License", vendor: "Google", renewal: "2026-09-01", cost: "10.5", status: "Due Soon" });
    assert.equal(denied.ok, false);
    const allowed = assetBody({ name: "Mail", type: "License", vendor: "Google", renewal: "2026-09-01", cost: "500", status: "Due Soon" });
    assert.equal(allowed.ok, true);
    if (!allowed.ok) return;
    await assert.rejects(() => assets.create(allowed.body), (error: unknown) => {
        assert.equal(apiFailure(error).status, 403);
        assert.equal(apiFailure(error).message, "You do not have access to this.");
        return true;
    });

    await assets.list({ page: 1, search: "ssl", type: "SSL", status: "Due Soon", from: "2026-07-01", to: "2026-12-31" });
    assert.equal(calls[5]?.url, "http://localhost:4000/api/assets?page=1&search=ssl&type=SSL&status=Due+Soon&from=2026-07-01&to=2026-12-31");
    assert.equal(calls[5]?.init?.credentials, "include");
});

test("one failed report leaves the other reports intact", async () => {
    const calls: string[] = [];
    const reports = createInsightsApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url) => {
            calls.push(url);
            if (url.includes("/api/reports/finance")) {
                return jsonResponse({ data: null, error: { code: "FORBIDDEN", message: "Forbidden" } }, 403);
            }
            if (url.includes("/api/reports/sales")) {
                return jsonResponse({ data: null, error: { code: "INTERNAL_ERROR", message: "Sales report failed" } }, 500);
            }
            if (url.includes("/api/reports/hr")) {
                return jsonResponse({ data: { employees: 3, attendance: 1 }, error: null });
            }
            return jsonResponse({ data: emptyView, error: null });
        },
    }));
    const range = { from: "2026-07-01", to: "2026-07-31" };
    const [overview, finance, sales, hr, projects] = await Promise.all([
        loadReportSection(true, () => reports.reports.overview(range)),
        loadReportSection(true, () => reports.reports.finance(range)),
        loadReportSection(true, () => reports.reports.sales(range)),
        loadReportSection(true, () => reports.reports.hr(range)),
        loadReportSection(false, () => reports.reports.projects(range)),
    ]);

    assert.equal(overview.status, "success");
    if (overview.status === "success") assert.equal(overview.data.clients, null);
    assert.equal(finance.status, "error");
    if (finance.status === "error") assert.equal(finance.statusCode, 403);
    assert.equal(sales.status, "error");
    if (sales.status === "error") {
        assert.equal(sales.statusCode, 500);
        assert.equal(sales.message, "Sales report failed");
    }
    assert.equal(hr.status, "success");
    if (hr.status === "success") assert.equal(hr.data.employees, 3);
    assert.equal(projects.status, "unavailable");
    assert.equal(calls.some((url) => url.includes("/api/reports/projects")), false);
    assert.equal(calls.filter((url) => url.includes("from=2026-07-01&to=2026-07-31")).length, 4);
    assert.equal(isCurrentReportRequest(1, 2), false);
    assert.equal(isCurrentReportRequest(2, 2), true);
});
