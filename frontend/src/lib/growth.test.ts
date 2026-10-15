import assert from "node:assert/strict";
import { test } from "vitest";

import { ApiError, createApiClient } from "./api";
import { apiFailure } from "./crm";
import {
    campaignBody,
    canCreateReferrals,
    canManageCampaigns,
    canUpdateServiceRates,
    canViewReferrals,
    contentBody,
    createGrowthApi,
    formatRoi,
    parseRoi,
    referralBody,
    serviceRateBody,
    wholeRupees,
} from "./growth";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("growth requests keep stored money and honor permission boundaries", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createGrowthApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            calls.push({ url, init });
            const body = init?.body ? JSON.parse(String(init.body)) as { name?: string } : null;
            if (url.endsWith("/api/campaigns") && body?.name === "Taken") {
                return jsonResponse({ data: null, error: { code: "CONFLICT", message: "This name is already in use", fields: { name: "Already in use" } } }, 409);
            }
            if (url.endsWith("/api/service-rates") && init?.method === "POST") {
                return jsonResponse({ data: null, error: { code: "FORBIDDEN", message: "Forbidden", fields: {} } }, 403);
            }
            return jsonResponse({ data: { id: "row-1", items: [] }, error: null });
        },
    }));

    const marketing = ["campaigns:view", "content:view", "leads:view"];
    assert.equal(canManageCampaigns(marketing), true);
    assert.equal(canUpdateServiceRates(marketing), false);
    assert.equal(canCreateReferrals(marketing), false);
    assert.equal(canViewReferrals(["referrals:view"]), true);
    assert.equal(canCreateReferrals(["referrals:view"]), false);
    assert.equal(canUpdateServiceRates(["service_rates:view"]), false);
    assert.equal(canUpdateServiceRates(["service_rates:view", "service_rates:update"]), true);

    await client.campaigns.list({ page: 1, search: "Monsoon", status: "Running", channel: "Meta" });
    assert.equal(calls[0]?.url, "http://localhost:4000/api/campaigns?page=1&search=Monsoon&status=Running&channel=Meta");
    assert.equal(calls[0]?.init?.credentials, "include");

    const campaign = campaignBody({ name: "Taken", channel: "Meta", spend: "1500", leads: "12", roi: "2.50", status: "Paused" });
    assert.equal(campaign.ok, true);
    if (!campaign.ok) return;
    assert.equal(campaign.body.spend, 1500);
    assert.equal(campaign.body.roi, 2.5);
    assert.equal("organizationId" in campaign.body, false);
    await assert.rejects(() => client.campaigns.create(campaign.body), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(apiFailure(error).fields.name, "Already in use");
        return true;
    });
    assert.equal(campaignBody({ name: "A", channel: "Meta", spend: "10.5", leads: "1", roi: "2", status: "Running" }).ok, false);
    assert.equal(parseRoi("1.234"), null);

    const content = contentBody({ title: "Blog", channel: "Site", date: "2026-07-01", status: "Scheduled" });
    assert.equal(content.ok, true);
    if (!content.ok) return;
    await client.content.create(content.body);
    assert.equal(calls[2]?.init?.credentials, "include");
    assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), content.body);

    const referral = referralBody({
        code: "R-1",
        partner: "North",
        clientId: "",
        deals: "2",
        revenue: "1000",
        commission: "100",
        status: "Pending",
    });
    assert.equal(referral.ok, true);
    if (!referral.ok) return;
    assert.equal(referral.body.clientId, null);
    assert.equal(referral.body.commission, 100);
    assert.equal(referral.body.revenue, 1000);

    const rate = serviceRateBody({ name: "SEO", description: "", unit: "Monthly", rate: "65000", active: true });
    assert.equal(rate.ok, true);
    if (!rate.ok) return;
    assert.equal("tax" in rate.body, false);
    await assert.rejects(() => client.serviceRates.create(rate.body), (error: unknown) => {
        assert.equal(apiFailure(error).status, 403);
        assert.equal(apiFailure(error).message, "You do not have access to this.");
        return true;
    });
    assert.equal(formatRoi(2.5), "2.5");
    assert.equal(wholeRupees("10.50"), null);
});
