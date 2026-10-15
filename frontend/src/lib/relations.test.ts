import assert from "node:assert/strict";
import { test } from "vitest";

import { ApiError } from "./api";
import { apiFailure } from "./crm";
import { newProjectDraft, newTaskDraft, taskListQuery } from "./delivery";
import { invoiceBody } from "./finance";
import { appendOptions, blankRelation, canBrowseEmployees, displayOptions, hasMore, linkedLabel, requireRelation } from "./relations";

const clientId = "11111111-1111-4111-8111-111111111111";

test("new relationships start blank and must be chosen", () => {
    assert.equal(blankRelation(), "");
    assert.equal(newProjectDraft().clientId, "");
    assert.equal(newTaskDraft().projectId, "");
    assert.equal(requireRelation("", "client"), "Choose a client");
    assert.equal(requireRelation(clientId, "client"), null);

    const invoice = invoiceBody({
        number: "INV-1",
        clientId: "",
        projectId: "",
        issueDate: "2026-07-01",
        dueDate: "2026-07-15",
        status: "Draft",
        supply: "cgst_sgst",
        ratePercent: "18",
        lines: [{ description: "Design", quantity: "1", unitPrice: "1000" }],
    });
    assert.equal(invoice.ok, false);
    if (!invoice.ok) assert.equal(invoice.fields.clientId, "Choose a client");
});

test("relationship pages keep the selection and report further records", () => {
    const selected = { id: clientId, label: "Northwind" };
    const first = [{ id: "aaaaaaa1-1111-4111-8111-111111111111", label: "Acme" }];
    const second = [{ id: "bbbbbbb2-2222-4222-8222-222222222222", label: "Bright" }];
    const pageTwo = appendOptions([selected, ...first], second);
    assert.deepEqual(pageTwo.map((option) => option.id), [clientId, first[0]?.id, second[0]?.id]);
    assert.deepEqual(displayOptions(second, selected).map((option) => option.label), ["Northwind", "Bright"]);
    assert.equal(hasMore(1, 20, 41), true);
    assert.equal(hasMore(3, 20, 41), false);

    const tasks = taskListQuery({
        page: 2,
        pageSize: 20,
        projectId: "22222222-2222-4222-8222-222222222222",
        status: "Review",
        priority: "High",
        dueFrom: "2026-07-01",
        dueTo: "2026-07-31",
        assigneeUserId: "33333333-3333-4333-8333-333333333333",
    });
    assert.equal(tasks.page, 2);
    assert.equal(tasks.projectId, "22222222-2222-4222-8222-222222222222");
    assert.equal(tasks.status, "Review");
    assert.equal(tasks.dueFrom, "2026-07-01");
});

test("unresolved names stay distinct from missing links, and lookup errors stay visible", () => {
    const labels: Record<string, string | null> = { [clientId]: null };
    assert.equal(linkedLabel(null, labels, "No client", "Client name unavailable"), "No client");
    assert.equal(linkedLabel(clientId, labels, "No client", "Client name unavailable"), "Client name unavailable");
    assert.equal(linkedLabel(clientId, { [clientId]: "Northwind" }, "No client", "Client name unavailable"), "Northwind");
    assert.equal(canBrowseEmployees(["follow_ups:create"]), false);
    assert.equal(canBrowseEmployees(["employees:view"]), true);

    const failure = apiFailure(new ApiError(403, "FORBIDDEN", "You do not have access to this.", {}));
    assert.equal(failure.status, 403);
    assert.equal(failure.message, "You do not have access to this.");
});
