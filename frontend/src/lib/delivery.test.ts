import assert from "node:assert/strict";
import { test } from "vitest";

import { createApiClient } from "./api";
import { createDeliveryApi, isoDate, plannerTime } from "./delivery";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("delivery requests use the session cookie and supported fields only", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createDeliveryApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            calls.push({ url, init });
            if (url.includes("/api/planner?")) {
                return jsonResponse({ data: { items: [], from: "2026-07-01", to: "2026-07-07" }, error: null });
            }
            return jsonResponse({ data: { id: "row-1" }, error: null });
        },
    }));

    await client.projects.list({ page: 1, search: "Nimbus", status: "Delayed", priority: "High" });
    assert.equal(calls[0]?.url, "http://localhost:4000/api/projects?page=1&search=Nimbus&status=Delayed&priority=High");
    assert.equal(calls[0]?.init?.credentials, "include");

    await client.projects.create({
        code: "P-1",
        name: "Portal",
        description: "",
        clientId: "11111111-1111-4111-8111-111111111111",
        status: "On Track",
        priority: "Medium",
        startDate: "2026-07-01",
        dueDate: "2026-08-01",
    });
    const project = JSON.parse(String(calls[1]?.init?.body)) as Record<string, unknown>;
    assert.equal(project.clientId, "11111111-1111-4111-8111-111111111111");
    assert.equal("organizationId" in project, false);
    assert.equal("managerEmployeeId" in project, false);
    assert.equal("budget" in project, false);

    await client.tasks.create({
        projectId: "22222222-2222-4222-8222-222222222222",
        title: "Checkout",
        description: "",
        status: "Backlog",
        priority: "High",
        assigneeUserId: "33333333-3333-4333-8333-333333333333",
    });
    const task = JSON.parse(String(calls[2]?.init?.body)) as Record<string, unknown>;
    assert.equal(task.assigneeUserId, "33333333-3333-4333-8333-333333333333");
    assert.equal("assigneeEmployeeId" in task, false);

    await client.planner.list({ from: "2026-07-01", to: "2026-07-07" });
    assert.equal(calls[3]?.url, "http://localhost:4000/api/planner?from=2026-07-01&to=2026-07-07");
    await client.planner.update("entry-1", { done: true, time: "09:30", tag: "Delivery" });
    assert.deepEqual(JSON.parse(String(calls[4]?.init?.body)), { done: true, time: "09:30", tag: "Delivery" });
    assert.equal(isoDate(new Date(2026, 6, 1)), "2026-07-01");
});

test("planner times are sent as HH:MM", () => {
    assert.equal(plannerTime("09:30:00"), "09:30");
    assert.equal(plannerTime("9:05:45.100"), "09:05");
    assert.equal(plannerTime("14:05"), "14:05");
    assert.equal(plannerTime(""), null);
    assert.equal(plannerTime("   "), null);
    assert.equal(plannerTime(null), null);
    assert.equal(plannerTime("25:99:00"), "25:99:00");
});
