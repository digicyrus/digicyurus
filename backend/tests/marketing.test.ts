import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createApp } from "../src/app.js";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.js";
import { permissionsForRole } from "../src/modules/auth/permissions.js";
import { authUser, createFakeVerifier, createMemoryAuthStore } from "./memory-auth.js";
import { createMemoryCampaignStore, createMemoryContentStore } from "./memory-marketing.js";
import { withHttp } from "./http.js";

const MISSING_ID = "22222222-2222-4222-8222-222222222222";

function marketingApp(permissions: readonly string[], organizationId = "org-1") {
  const auth = createMemoryAuthStore();
  auth.users.push(authUser({
    email: "ada@digicyrus.example",
    organizationId,
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
  const campaigns = createMemoryCampaignStore();
  const content = createMemoryContentStore();
  const app = createApp({
    auth: {
      store: auth,
      verifier: createFakeVerifier(),
      secureCookies: false,
      rateLimiter: createLoginRateLimiter(),
    },
    marketing: { campaigns, content },
  });
  return { app, campaigns, content };
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

function campaignBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Monsoon Retail Push",
    channel: "Meta Ads",
    spend: 220000,
    leads: 148,
    roi: 3.4,
    status: "Running",
    ...overrides,
  };
}

test("campaigns store entered results and honor uniqueness, filters, and view permission", async () => {
  const state = marketingApp(permissionsForRole("marketing_executive"));
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    assert.equal((await fetch(`${baseUrl}/api/campaigns`)).status, 401);

    const invalid = await fetch(`${baseUrl}/api/campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify(campaignBody({ status: "Completed", spend: -1 })),
    });
    assert.equal(invalid.status, 400);
    assert.equal(state.campaigns.records.length, 0);

    const created = await fetch(`${baseUrl}/api/campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...campaignBody(), organizationId: "org-2", sessions: 30400 }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.name, "Monsoon Retail Push");
    assert.equal(createdBody.data.spend, 220000);
    assert.equal(createdBody.data.roi, 3.4);
    assert.equal(createdBody.data.leads, 148);
    assert.equal(createdBody.data.sessions, undefined);
    assert.equal(state.campaigns.records[0]?.organizationId, "org-1");
    assert.equal(state.campaigns.records[0]?.spendPaise, 22000000);
    assert.equal(state.campaigns.records[0]?.roiHundredths, 340);
    assert.equal(JSON.stringify(createdBody).includes("org-1"), false);

    const duplicate = await fetch(`${baseUrl}/api/campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify(campaignBody({ name: "monsoon retail push", channel: "Google Ads" })),
    });
    assert.equal(duplicate.status, 409);

    await fetch(`${baseUrl}/api/campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify(campaignBody({ name: "Healthcare Search", channel: "Google Ads", spend: 180000, leads: 96, roi: 2.7, status: "Running" })),
    });
    await fetch(`${baseUrl}/api/campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify(campaignBody({ name: "LinkedIn Thought Leadership", channel: "LinkedIn", spend: 80000, leads: 41, roi: 1.9, status: "Paused" })),
    });

    const search = await fetch(`${baseUrl}/api/campaigns?search=health&status=Running&channel=Google%20Ads&page=1&pageSize=1`, { headers });
    const searchBody = await search.json();
    assert.equal(search.status, 200);
    assert.equal(searchBody.data.total, 1);
    assert.equal(searchBody.data.items[0].name, "Healthcare Search");

    const id = createdBody.data.id as string;
    const detail = await fetch(`${baseUrl}/api/campaigns/${id}`, { headers });
    assert.equal(detail.status, 200);
    const patched = await fetch(`${baseUrl}/api/campaigns/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "Paused", spend: 210000 }),
    });
    const patchedBody = await patched.json();
    assert.equal(patched.status, 200);
    assert.equal(patchedBody.data.status, "Paused");
    assert.equal(patchedBody.data.spend, 210000);
    assert.equal(patchedBody.data.roi, 3.4);

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    const hidden = await fetch(`${baseUrl}/api/campaigns/${id}`, { headers: { cookie: otherCookie } });
    assert.equal(hidden.status, 404);
    const foreignList = await fetch(`${baseUrl}/api/campaigns`, { headers: { cookie: otherCookie } });
    const foreignBody = await foreignList.json();
    assert.equal(foreignBody.data.total, 0);
    assert.equal((await fetch(`${baseUrl}/api/campaigns/${MISSING_ID}`, { headers })).status, 404);
  });

  const admin = marketingApp(permissionsForRole("admin"));
  await withHttp(admin.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const response = await fetch(`${baseUrl}/api/campaigns`, { headers: { cookie } });
    assert.equal(response.status, 403);
  });
});

test("content items use calendar dates and the content view permission", async () => {
  const state = marketingApp(permissionsForRole("marketing_executive"));
  await withHttp(state.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    const headers = { cookie, "content-type": "application/json" };
    const invalid = await fetch(`${baseUrl}/api/content`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Case study", channel: "LinkedIn", date: "Mon 04", status: "Scheduled" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(state.content.records.length, 0);

    const created = await fetch(`${baseUrl}/api/content`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Case study: Vertex portal", channel: "LinkedIn", date: "2026-08-04", status: "Scheduled", organizationId: "org-2" }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.date, "2026-08-04");
    assert.equal(createdBody.data.status, "Scheduled");
    assert.equal(state.content.records[0]?.organizationId, "org-1");

    await fetch(`${baseUrl}/api/content`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "SEO blog: agency ops", channel: "Blog", date: "2026-08-06", status: "Published" }),
    });
    await fetch(`${baseUrl}/api/content`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Reel", channel: "Instagram", date: "2026-08-05", status: "Draft" }),
    });

    const range = await fetch(`${baseUrl}/api/content?from=2026-08-04&to=2026-08-05&sort=date`, { headers });
    const rangeBody = await range.json();
    assert.equal(range.status, 200);
    assert.equal(rangeBody.data.total, 2);
    assert.equal(rangeBody.data.items[0].title, "Case study: Vertex portal");

    const backwards = await fetch(`${baseUrl}/api/content?from=2026-08-06&to=2026-08-01`, { headers });
    assert.equal(backwards.status, 400);

    const id = createdBody.data.id as string;
    const patched = await fetch(`${baseUrl}/api/content/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "Published" }),
    });
    const patchedBody = await patched.json();
    assert.equal(patched.status, 200);
    assert.equal(patchedBody.data.status, "Published");

    const otherCookie = await signIn(baseUrl, "bob@digicyrus.example");
    assert.equal((await fetch(`${baseUrl}/api/content/${id}`, { headers: { cookie: otherCookie } })).status, 404);
  });

  const admin = marketingApp(permissionsForRole("admin"));
  await withHttp(admin.app, async (baseUrl) => {
    const cookie = await signIn(baseUrl);
    assert.equal((await fetch(`${baseUrl}/api/content`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" })).status, 403);
  });
});

test("growth migration records campaigns, content, referrals, and rates without demo rows", () => {
  const sql = readFileSync(new URL("../drizzle/0006_growth.sql", import.meta.url), "utf8");
  assert.equal(/insert into/i.test(sql), false);
  assert.equal(sql.includes("campaigns_org_name_unique"), true);
  assert.equal(sql.includes("content_items_status_check"), true);
  assert.equal(sql.includes("referrals_org_code_unique"), true);
  assert.equal(sql.includes("service_rates_org_name_unique"), true);
  assert.equal(/create table "traffic"/i.test(sql), false);
  assert.equal(sql.toLowerCase().includes("seo"), false);
});
