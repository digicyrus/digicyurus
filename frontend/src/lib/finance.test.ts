import assert from "node:assert/strict";
import { test } from "vitest";

import { ApiError, createApiClient } from "./api";
import { apiFailure } from "./crm";
import { basisPoints, createFinanceApi, invoiceBody, paymentBody, wholeRupees } from "./finance";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("finance requests use the session cookie and whole rupees", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createFinanceApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            calls.push({ url, init });
            if (url.endsWith("/payments")) {
                return jsonResponse({
                    data: null,
                    error: { code: "CONFLICT", message: "This reference is already in use", fields: { reference: "Already in use" } },
                }, 409);
            }
            return jsonResponse({ data: { id: "row-1", items: [] }, error: null });
        },
    }));

    await client.invoices.list({ page: 1, status: "Overdue", clientId: "11111111-1111-4111-8111-111111111111", dueFrom: "2026-07-01" });
    assert.equal(calls[0]?.url, "http://localhost:4000/api/invoices?page=1&status=Overdue&clientId=11111111-1111-4111-8111-111111111111&dueFrom=2026-07-01");
    assert.equal(calls[0]?.init?.credentials, "include");

    const invoice = invoiceBody({
        number: "INV-1",
        clientId: "11111111-1111-4111-8111-111111111111",
        projectId: "",
        issueDate: "2026-07-01",
        dueDate: "2026-07-15",
        status: "Draft",
        supply: "cgst_sgst",
        ratePercent: "18",
        lines: [{ description: "Design", quantity: "2", unitPrice: "1500" }],
    });
    assert.equal(invoice.ok, true);
    if (!invoice.ok) return;
    assert.equal(invoice.body.rateBps, 1800);
    assert.equal(invoice.body.projectId, null);
    assert.equal(invoice.body.lines[0]?.unitPrice, 1500);
    assert.equal("organizationId" in invoice.body, false);
    assert.equal("gstin" in invoice.body, false);
    await client.invoices.create(invoice.body);
    const sent = JSON.parse(String(calls[1]?.init?.body)) as { lines: { unitPrice: number }[] };
    assert.equal(Number.isInteger(sent.lines[0]?.unitPrice), true);

    const draftPayment = paymentBody({ status: "Draft", balanceDue: 3000 }, {
        paidOn: "2026-07-02",
        amount: "1000",
        method: "Bank transfer",
        reference: "UTR-1",
        notes: "",
    });
    assert.equal(draftPayment.ok, false);
    if (!draftPayment.ok) assert.match(draftPayment.message, /Draft/);

    const over = paymentBody({ status: "Pending", balanceDue: 3000 }, {
        paidOn: "2026-07-02",
        amount: "3001",
        method: "Bank transfer",
        reference: "UTR-1",
        notes: "",
    });
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.fields.amount, "Exceeds the outstanding balance");

    const payment = paymentBody({ status: "Overdue", balanceDue: 3000 }, {
        paidOn: "2026-07-02",
        amount: "1000",
        method: "Bank transfer",
        reference: "UTR-1",
        notes: "",
    });
    assert.equal(payment.ok, true);
    if (!payment.ok) return;
    await assert.rejects(() => client.invoices.recordPayment("inv-1", payment.body), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(apiFailure(error).fields.reference, "Already in use");
        return true;
    });
    const posted = JSON.parse(String(calls[2]?.init?.body)) as { amount: number };
    assert.equal(posted.amount, 1000);
    assert.equal(calls[2]?.init?.credentials, "include");
    assert.equal(wholeRupees("10.50"), null);
    assert.equal(basisPoints("18.5"), 1850);
});
