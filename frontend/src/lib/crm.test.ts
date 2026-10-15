import assert from "node:assert/strict";
import { test } from "vitest";

import { ApiError, createApiClient } from "./api";
import { apiFailure, createCrmApi, stageChangeBody, toQuery } from "./crm";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("crm requests keep the session cookie and omit organization and role", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createCrmApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            calls.push({ url, init });
            return jsonResponse({
                data: { items: [], page: 2, pageSize: 20, total: 0 },
                error: null,
            });
        },
    }));

    await client.clients.list({ page: 2, search: "Nimbus", status: "Active" });
    const listed = calls[0];
    assert.equal(listed?.url, "http://localhost:4000/api/clients?page=2&search=Nimbus&status=Active");
    assert.equal(listed?.init?.credentials, "include");
    assert.equal(listed?.url?.includes("organization"), false);
    assert.equal(toQuery({ industry: undefined, search: "" }), "");

    await client.leads.create({
        code: "L-1",
        company: "Sunrise",
        person: "Yash",
        value: 1000,
        source: "Website",
        priority: "High",
        closing: "2026-08-01",
        probability: 10,
    });
    const created = JSON.parse(String(calls[1]?.init?.body)) as Record<string, unknown>;
    assert.equal(calls[1]?.url, "http://localhost:4000/api/leads");
    assert.equal("stage" in created, false);
    assert.equal("organizationId" in created, false);
    assert.equal("role" in created, false);

    await client.leads.moveStage("lead-1", "Won");
    assert.equal(calls[2]?.url, "http://localhost:4000/api/leads/lead-1/stage");
    assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), stageChangeBody("Won"));
    assert.equal(calls.some((call) => call.url.includes("/api/clients") && call.init?.method === "POST"), false);
});

test("crm failures keep validation, permission, conflict, and session errors", async () => {
    const client = createCrmApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url) => {
            if (url.endsWith("/stage")) {
                return jsonResponse({ data: null, error: { code: "FORBIDDEN", message: "Forbidden", fields: {} } }, 403);
            }
            if (url.endsWith("/api/clients")) {
                return jsonResponse({ data: null, error: { code: "CONFLICT", message: "This code is already in use", fields: { code: "Already in use" } } }, 409);
            }
            return jsonResponse({ data: null, error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required", fields: {} } }, 401);
        },
    }));

    await assert.rejects(client.clients.create({
        code: "C-1",
        name: "Nimbus",
        contactName: "Kabir",
        industry: "Retail",
        status: "Active",
        rating: 5,
        customerSince: "2026-01-01",
    }), (error: unknown) => {
        const failure = apiFailure(error);
        assert.equal(failure.status, 409);
        assert.equal(failure.fields.code, "Already in use");
        return true;
    });
    await assert.rejects(client.leads.moveStage("lead-1", "Contacted"), (error: unknown) => {
        assert.equal(apiFailure(error).status, 403);
        assert.ok(error instanceof ApiError);
        return true;
    });
    await assert.rejects(client.followUps.list(), (error: unknown) => {
        assert.equal(apiFailure(error).status, 401);
        return true;
    });
});
