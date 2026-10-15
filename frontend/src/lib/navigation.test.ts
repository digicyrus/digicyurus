import assert from "node:assert/strict";
import { test } from "vitest";

import { ACCOUNT_WORKFLOW_MESSAGE, accountWorkflowAvailable, canOpenPlanner, visibleNav } from "./navigation";

test("account workflows stay unavailable and do not claim success", () => {
    assert.equal(accountWorkflowAvailable(), false);
    assert.doesNotMatch(ACCOUNT_WORKFLOW_MESSAGE, /sent|updated|created|verified|verification/i);
});

test("navigation follows the signed-in permissions", () => {
    const developer = visibleNav(["projects:view", "tasks:view", "tasks:update", "planner:view", "planner:update"]).map((item) => item.to);
    assert.deepEqual(developer, ["/projects"]);
    assert.equal(canOpenPlanner(["planner:view"]), true);

    const sales = visibleNav([
        "dashboard:view",
        "clients:view",
        "leads:view",
        "sales:view",
        "proposals:view",
        "agreements:view",
    ]).map((item) => item.to);
    assert.deepEqual(sales, ["/", "/crm", "/leads", "/sales"]);
    assert.equal(canOpenPlanner(sales), false);

    const accountant = visibleNav(["finance:view", "invoices:view", "expenses:view", "referrals:view", "reports:view"]).map((item) => item.to);
    assert.deepEqual(accountant, ["/finance", "/reports"]);

    const marketing = visibleNav(["campaigns:view", "content:view", "leads:view", "reports:view"]).map((item) => item.to);
    assert.deepEqual(marketing, ["/leads", "/marketing", "/reports"]);

    assert.deepEqual(visibleNav([]).map((item) => item.to), []);
    assert.equal(canOpenPlanner([]), false);
});
