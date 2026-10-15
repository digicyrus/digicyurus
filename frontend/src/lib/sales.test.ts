import assert from "node:assert/strict";
import { test } from "vitest";

import { ApiError, createApiClient } from "./api";
import { apiFailure } from "./crm";
import {
    AGREEMENT_RECORD_NOTE,
    PROPOSAL_SENT_NOTE,
    agreementBody,
    agreementEditScope,
    agreementStatusBody,
    blankAgreementForm,
    canChangeAgreementStatus,
    canChangeProposalStatus,
    canCreateOpportunity,
    canMoveOpportunity,
    canUpdateOpportunity,
    canViewForecast,
    canViewPipeline,
    createSalesApi,
    forecastRange,
    forecastWeightCopy,
    monthRange,
    nextAgreementStatuses,
    nextProposalStatuses,
    opportunityBody,
    previewProposal,
    probabilityBody,
    proposalBody,
    proposalStatusBody,
    showWeightedAmount,
    stageChangeBody,
    type AgreementForm,
    type OpenStage,
    type OpportunityForm,
    type ProposalForm,
} from "./sales";

const clientId = "11111111-1111-4111-8111-111111111111";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function opportunityForm(overrides: Partial<OpportunityForm> = {}): OpportunityForm {
    return {
        reference: "OPP-1",
        title: "Website rebuild",
        clientId,
        leadId: "",
        ownerEmployeeId: "",
        value: "50000",
        expectedClose: "2026-10-20",
        source: "Referral",
        priority: "High",
        notes: "",
        stage: "Qualification",
        lostReason: "",
        closedOn: "",
        ...overrides,
    };
}

function proposalForm(overrides: Partial<ProposalForm> = {}): ProposalForm {
    return {
        number: "PR-1",
        title: "Website proposal",
        clientId,
        opportunityId: "",
        validityDate: "2026-11-01",
        notes: "",
        ratePercent: "18",
        lines: [{ description: "Build", quantity: "2", unitPrice: "50000", discount: "5000" }],
        ...overrides,
    };
}

function agreementForm(overrides: Partial<AgreementForm> = {}): AgreementForm {
    return {
        ...blankAgreementForm(),
        number: "AG-1",
        title: "Retainer",
        description: "Monthly support",
        clientId,
        startDate: "2026-10-01",
        endDate: "2027-09-30",
        value: "120000",
        ...overrides,
    };
}

test("sales requests follow the phase contracts and surface API errors", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createSalesApi(createApiClient({
        baseUrl: "http://localhost:4000",
        fetch: async (url, init) => {
            calls.push({ url, init });
            if (url.endsWith("/stage")) {
                return jsonResponse({
                    data: null,
                    error: { code: "VALIDATION_ERROR", message: "Request validation failed", fields: { lostReason: "Lost reason is required" } },
                }, 400);
            }
            if (url.includes("/proposals/") && url.endsWith("/status")) {
                return jsonResponse({
                    data: null,
                    error: { code: "FORBIDDEN", message: "Forbidden", fields: {} },
                }, 403);
            }
            return jsonResponse({ data: { id: "row-1", items: [], stages: [] }, error: null });
        },
    }));

    await client.opportunities.list({ page: 2, pageSize: 20, stage: "Negotiation", priority: "High", search: "web" });
    assert.equal(calls[0]?.url, "http://localhost:4000/api/sales/opportunities?page=2&pageSize=20&stage=Negotiation&priority=High&search=web");
    assert.equal(calls[0]?.init?.credentials, "include");

    await client.opportunities.summary();
    assert.equal(calls[1]?.url, "http://localhost:4000/api/sales/opportunities/summary");

    const created = opportunityBody(opportunityForm(), "create");
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal("organizationId" in created.body, false);
    assert.equal("stage" in created.body, true);
    await client.opportunities.create(created.body);
    const posted = JSON.parse(String(calls[2]?.init?.body)) as { value: number; clientId: string; stage: string };
    assert.equal(posted.value, 50000);
    assert.equal(posted.clientId, clientId);
    assert.equal(posted.stage, "Qualification");

    const edited = opportunityBody(opportunityForm({ title: "Website refresh" }), "edit");
    assert.equal(edited.ok, true);
    if (!edited.ok) return;
    assert.equal("stage" in edited.body, false);
    await client.opportunities.update("opp-1", edited.body);
    assert.equal(calls[3]?.init?.method, "PATCH");
    assert.equal(calls[3]?.url, "http://localhost:4000/api/sales/opportunities/opp-1");

    await assert.rejects(() => client.opportunities.changeStage("opp-1", { stage: "Lost" }), (error: unknown) => {
        const failure = apiFailure(error);
        assert.equal(failure.status, 400);
        assert.equal(failure.fields.lostReason, "Lost reason is required");
        return true;
    });

    await client.forecast.get({ from: "2026-10-01", to: "2026-10-31" });
    assert.equal(calls[5]?.url, "http://localhost:4000/api/sales/forecast?from=2026-10-01&to=2026-10-31");

    await client.forecast.saveProbabilities({ stages: [{ stage: "Qualification", probability: 25 }] });
    assert.equal(calls[6]?.init?.method, "PUT");
    assert.equal(calls[6]?.url, "http://localhost:4000/api/sales/stage-probabilities");

    const proposal = proposalBody(proposalForm());
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;
    assert.equal("status" in proposal.body, false);
    assert.equal("email" in proposal.body, false);
    await client.proposals.create(proposal.body);
    assert.equal(calls[7]?.url, "http://localhost:4000/api/sales/proposals");

    const sent = proposalStatusBody("Draft", "Sent");
    assert.equal(sent.ok, true);
    if (!sent.ok) return;
    assert.deepEqual(sent.body, { status: "Sent" });
    await assert.rejects(() => client.proposals.changeStatus("pr-1", sent.body), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(apiFailure(error).status, 403);
        assert.equal(apiFailure(error).message, "You do not have access to this.");
        return true;
    });

    const agreement = agreementBody(agreementForm(), "create");
    assert.equal(agreement.ok, true);
    if (!agreement.ok) return;
    assert.equal("status" in agreement.body, false);
    assert.equal("signature" in agreement.body, false);
    await client.agreements.create(agreement.body);
    assert.equal(calls[9]?.url, "http://localhost:4000/api/sales/agreements");
    assert.equal(AGREEMENT_RECORD_NOTE.includes("electronic signature"), true);
    assert.equal(PROPOSAL_SENT_NOTE.includes("does not send an email"), true);
});

test("opportunity forms require a lost reason and keep stage changes explicit", () => {
    const lost = opportunityBody(opportunityForm({ stage: "Lost" }), "create");
    assert.equal(lost.ok, false);
    if (!lost.ok) assert.equal(lost.fields.lostReason, "Lost reason is required");

    const recorded = opportunityBody(opportunityForm({ stage: "Lost", lostReason: "Budget cut", closedOn: "2026-10-15" }), "create");
    assert.equal(recorded.ok, true);
    if (recorded.ok) {
        assert.equal(recorded.body.lostReason, "Budget cut");
        assert.equal(recorded.body.closedOn, "2026-10-15");
    }

    const openWithReason = stageChangeBody({ stage: "Discovery", lostReason: "Budget cut", closedOn: "" });
    assert.equal(openWithReason.ok, false);
    if (!openWithReason.ok) assert.equal(openWithReason.fields.lostReason, "Lost reason applies only when the stage is Lost");

    const move = stageChangeBody({ stage: "Lost", lostReason: "  Chose another vendor  ", closedOn: "" });
    assert.equal(move.ok, true);
    if (move.ok) {
        assert.deepEqual(move.body, { stage: "Lost", lostReason: "Chose another vendor" });
        assert.equal("closedOn" in move.body, false);
    }

    const won = stageChangeBody({ stage: "Won", lostReason: "", closedOn: "2026-02-31" });
    assert.equal(won.ok, false);
    if (!won.ok) assert.equal(won.fields.closedOn, "Enter a valid date");
});

test("proposal totals, status changes, and draft-only edits follow the server rules", () => {
    const proposal = proposalBody(proposalForm());
    assert.equal(proposal.ok, true);
    if (!proposal.ok) return;
    assert.equal(proposal.body.rateBps, 1800);
    assert.equal(proposal.body.lines[0]?.discount, 5000);
    const preview = previewProposal(proposal.body);
    assert.deepEqual(preview, { subtotal: 100000, discount: 5000, tax: 17100, total: 112100, lineAmounts: [95000] });

    const overDiscount = proposalBody(proposalForm({
        lines: [{ description: "Build", quantity: "1", unitPrice: "1000", discount: "1001" }],
    }));
    assert.equal(overDiscount.ok, false);
    if (!overDiscount.ok) assert.equal(overDiscount.fields["lines.0.discount"], "Discount cannot exceed the line amount");

    assert.deepEqual(nextProposalStatuses("Draft"), ["Sent"]);
    assert.deepEqual(nextProposalStatuses("Sent"), ["Accepted", "Rejected", "Expired"]);
    assert.deepEqual(nextProposalStatuses("Accepted"), []);
    const skipped = proposalStatusBody("Draft", "Accepted");
    assert.equal(skipped.ok, false);
    if (!skipped.ok) assert.match(skipped.message, /Draft to Accepted/);
    const same = proposalStatusBody("Sent", "Sent");
    assert.equal(same.ok, false);
});

test("agreement edits and status changes stay inside the permitted scope", () => {
    const backwards = agreementBody(agreementForm({ endDate: "2026-09-01" }), "create");
    assert.equal(backwards.ok, false);
    if (!backwards.ok) assert.equal(backwards.fields.endDate, "End date must be on or after the start date");

    const active = agreementBody(agreementForm(), "active");
    assert.equal(active.ok, true);
    if (active.ok) {
        assert.equal("number" in active.body, false);
        assert.equal("clientId" in active.body, false);
        assert.equal("opportunityId" in active.body, false);
        assert.equal("proposalId" in active.body, false);
        assert.equal(active.body.value, 120000);
    }

    assert.equal(agreementEditScope("Draft"), "draft");
    assert.equal(agreementEditScope("Active"), "active");
    assert.equal(agreementEditScope("Terminated"), "closed");
    assert.deepEqual(nextAgreementStatuses("Draft"), ["Active"]);
    assert.deepEqual(nextAgreementStatuses("Active"), ["Completed", "Terminated", "Expired"]);
    const illegal = agreementStatusBody("Draft", "Completed");
    assert.equal(illegal.ok, false);
    const allowed = agreementStatusBody("Active", "Terminated");
    assert.equal(allowed.ok, true);
    if (allowed.ok) assert.deepEqual(allowed.body, { status: "Terminated" });
});

test("forecast labels missing probabilities and permissions stay on each action", () => {
    assert.deepEqual(monthRange(2026, 10), { from: "2026-10-01", to: "2026-10-31" });
    const range = forecastRange("2026-10-31", "2026-10-01");
    assert.equal(range.ok, false);
    if (!range.ok) assert.equal(range.fields.to, "End date must be on or after the start date");

    assert.equal(showWeightedAmount("unconfigured", null), false);
    assert.equal(showWeightedAmount("partial", 250), true);
    assert.equal(showWeightedAmount("complete", 0), true);
    assert.match(forecastWeightCopy("unconfigured"), /not configured/);
    assert.match(forecastWeightCopy("partial"), /not treated as zero/);

    const weights = probabilityBody({
        Qualification: "25",
        Discovery: "0",
        Proposal: "",
        Negotiation: "10.5",
    });
    assert.equal(weights.ok, false);
    if (!weights.ok) assert.equal(weights.fields.Negotiation, "Enter a whole percent from 0 to 100");

    const saved = probabilityBody({ Qualification: "25", Discovery: "0", Proposal: "", Negotiation: "" });
    assert.equal(saved.ok, true);
    if (saved.ok) {
        assert.deepEqual(saved.body.stages, [
            { stage: "Qualification" satisfies OpenStage, probability: 25 },
            { stage: "Discovery", probability: 0 },
        ]);
    }
    const cleared = probabilityBody({ Qualification: "", Discovery: "", Proposal: "", Negotiation: "" });
    assert.equal(cleared.ok, true);
    if (cleared.ok) assert.deepEqual(cleared.body.stages, []);

    const viewer = ["sales:view"];
    assert.equal(canViewPipeline(viewer), false);
    assert.equal(canCreateOpportunity(viewer), false);
    assert.equal(canViewForecast(viewer), false);
    const mover = ["pipeline:view", "pipeline:move_stage"];
    assert.equal(canMoveOpportunity(mover), true);
    assert.equal(canUpdateOpportunity(mover), false);
    assert.equal(canChangeProposalStatus(["proposals:view", "proposals:update"]), false);
    assert.equal(canChangeAgreementStatus(["agreements:update"]), false);
    assert.equal(apiFailure(new ApiError(403, "FORBIDDEN", "Forbidden")).message, "You do not have access to this.");
});
