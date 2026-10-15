import { api } from "./api";
import { toQuery, type Page } from "./crm";
import { basisPoints, percentFromBps, wholeRupees } from "./finance";

export const OPPORTUNITY_STAGES = ["Qualification", "Discovery", "Proposal", "Negotiation", "Won", "Lost"] as const;
export const OPEN_STAGES = ["Qualification", "Discovery", "Proposal", "Negotiation"] as const;
export const SALES_PRIORITIES = ["High", "Medium", "Low"] as const;
export const PROPOSAL_STATUSES = ["Draft", "Sent", "Accepted", "Rejected", "Expired"] as const;
export const AGREEMENT_STATUSES = ["Draft", "Active", "Completed", "Terminated", "Expired"] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type OpenStage = (typeof OPEN_STAGES)[number];
export type SalesPriority = (typeof SALES_PRIORITIES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];
export type ForecastWeighting = "unconfigured" | "partial" | "complete";

export const PROPOSAL_SENT_NOTE = "Changing a proposal to Sent records the status. It does not send an email.";
export const AGREEMENT_RECORD_NOTE = "Agreements record status and terms only. There is no electronic signature or document upload.";

const PROPOSAL_NEXT: Record<ProposalStatus, readonly ProposalStatus[]> = {
    Draft: ["Sent"],
    Sent: ["Accepted", "Rejected", "Expired"],
    Accepted: [],
    Rejected: [],
    Expired: [],
};

const AGREEMENT_NEXT: Record<AgreementStatus, readonly AgreementStatus[]> = {
    Draft: ["Active"],
    Active: ["Completed", "Terminated", "Expired"],
    Completed: [],
    Terminated: [],
    Expired: [],
};

export type Opportunity = {
    id: string;
    reference: string;
    title: string;
    clientId: string | null;
    leadId: string | null;
    ownerEmployeeId: string | null;
    value: number;
    expectedClose: string;
    source: string;
    priority: SalesPriority;
    notes: string;
    stage: OpportunityStage;
    lostReason: string | null;
    closedOn: string | null;
    createdAt: string;
    updatedAt: string;
};

export type StageEvent = {
    id: string;
    fromStage: OpportunityStage | null;
    toStage: OpportunityStage;
    lostReason: string | null;
    closedOn: string | null;
    createdAt: string;
};

export type OpportunityDetail = Opportunity & { stageHistory: StageEvent[] };

export type PipelineSummary = {
    stages: { stage: OpportunityStage; count: number; value: number }[];
    open: { count: number; value: number };
    closed: { count: number; value: number };
};

export type ForecastStage = {
    stage: OpportunityStage;
    count: number;
    value: number;
    probability: number | null;
    weightedForecast: number | null;
};

export type Forecast = {
    period: { from: string; to: string };
    pipelineCount: number;
    pipelineValue: number;
    periodPipelineCount: number;
    periodPipelineValue: number;
    weightedForecast: number | null;
    periodWeightedForecast: number | null;
    weighting: ForecastWeighting;
    unweightedPipelineValue: number;
    closedDeals: {
        basis: "opportunity_closed_value";
        wonCount: number;
        wonValue: number;
        lostCount: number;
        lostValue: number;
    };
    byStage: ForecastStage[];
    byOwner: { ownerEmployeeId: string | null; count: number; pipelineValue: number; weightedForecast: number | null }[];
    byExpectedCloseMonth: { month: string; count: number; pipelineValue: number; weightedForecast: number | null }[];
};

export type StageProbability = {
    stage: OpenStage;
    probability: number;
    updatedAt: string;
};

export type ProposalLine = {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    amount: number;
};

export type Proposal = {
    id: string;
    number: string;
    title: string;
    clientId: string;
    opportunityId: string | null;
    status: ProposalStatus;
    validityDate: string;
    notes: string;
    rateBps: number;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    sentAt: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    expiredAt: string | null;
    statusChangedAt: string;
    createdAt: string;
    updatedAt: string;
};

export type ProposalDetail = Proposal & {
    lines: ProposalLine[];
    statusHistory: { id: string; fromStatus: ProposalStatus | null; toStatus: ProposalStatus; createdAt: string }[];
};

export type Agreement = {
    id: string;
    number: string;
    title: string;
    description: string;
    clientId: string;
    opportunityId: string | null;
    proposalId: string | null;
    startDate: string;
    endDate: string;
    value: number;
    status: AgreementStatus;
    activatedAt: string | null;
    completedAt: string | null;
    terminatedAt: string | null;
    expiredAt: string | null;
    statusChangedAt: string;
    createdAt: string;
    updatedAt: string;
};

export type AgreementDetail = Agreement & {
    statusHistory: { id: string; fromStatus: AgreementStatus | null; toStatus: AgreementStatus; createdAt: string }[];
};

export type OpportunityDraft = {
    reference: string;
    title: string;
    clientId: string | null;
    leadId: string | null;
    ownerEmployeeId: string | null;
    value: number;
    expectedClose: string;
    source: string;
    priority: SalesPriority;
    notes: string;
    stage: OpportunityStage;
    lostReason?: string;
    closedOn?: string;
};

export type OpportunityUpdate = Omit<OpportunityDraft, "stage" | "lostReason" | "closedOn">;

export type StageChange = {
    stage: OpportunityStage;
    lostReason?: string;
    closedOn?: string;
};

export type ProposalLineInput = {
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
};

export type ProposalDraft = {
    number: string;
    title: string;
    clientId: string;
    opportunityId: string | null;
    validityDate: string;
    notes: string;
    rateBps: number;
    lines: ProposalLineInput[];
};

export type AgreementDraft = {
    number: string;
    title: string;
    description: string;
    clientId: string;
    opportunityId: string | null;
    proposalId: string | null;
    startDate: string;
    endDate: string;
    value: number;
};

export type AgreementContentUpdate = {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    value: number;
};

export type Checked<T> = { ok: true; body: T } | { ok: false; message: string; fields: Record<string, string> };

export type OpportunityForm = {
    reference: string;
    title: string;
    clientId: string;
    leadId: string;
    ownerEmployeeId: string;
    value: string;
    expectedClose: string;
    source: string;
    priority: SalesPriority;
    notes: string;
    stage: OpportunityStage;
    lostReason: string;
    closedOn: string;
};

export type ProposalLineForm = {
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
};

export type ProposalForm = {
    number: string;
    title: string;
    clientId: string;
    opportunityId: string;
    validityDate: string;
    notes: string;
    ratePercent: string;
    lines: ProposalLineForm[];
};

export type AgreementForm = {
    number: string;
    title: string;
    description: string;
    clientId: string;
    opportunityId: string;
    proposalId: string;
    startDate: string;
    endDate: string;
    value: string;
};

type RequestClient = {
    request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
};

function has(permissions: readonly string[], key: string): boolean {
    return permissions.includes(key);
}

export function canViewPipeline(permissions: readonly string[]): boolean {
    return has(permissions, "pipeline:view");
}

export function canCreateOpportunity(permissions: readonly string[]): boolean {
    return has(permissions, "pipeline:create");
}

export function canUpdateOpportunity(permissions: readonly string[]): boolean {
    return has(permissions, "pipeline:update");
}

export function canMoveOpportunity(permissions: readonly string[]): boolean {
    return has(permissions, "pipeline:move_stage");
}

export function canViewForecast(permissions: readonly string[]): boolean {
    return has(permissions, "forecast:view");
}

export function canViewProposals(permissions: readonly string[]): boolean {
    return has(permissions, "proposals:view");
}

export function canCreateProposal(permissions: readonly string[]): boolean {
    return has(permissions, "proposals:create");
}

export function canUpdateProposal(permissions: readonly string[]): boolean {
    return has(permissions, "proposals:update");
}

export function canChangeProposalStatus(permissions: readonly string[]): boolean {
    return has(permissions, "proposals:change_status");
}

export function canViewAgreements(permissions: readonly string[]): boolean {
    return has(permissions, "agreements:view");
}

export function canCreateAgreement(permissions: readonly string[]): boolean {
    return has(permissions, "agreements:create");
}

export function canUpdateAgreement(permissions: readonly string[]): boolean {
    return has(permissions, "agreements:update");
}

export function canChangeAgreementStatus(permissions: readonly string[]): boolean {
    return has(permissions, "agreements:change_status");
}

export function nextProposalStatuses(status: ProposalStatus): ProposalStatus[] {
    return [...PROPOSAL_NEXT[status]];
}

export function nextAgreementStatuses(status: AgreementStatus): AgreementStatus[] {
    return [...AGREEMENT_NEXT[status]];
}

export function canEditProposal(status: ProposalStatus): boolean {
    return status === "Draft";
}

export function agreementEditScope(status: AgreementStatus): "draft" | "active" | "closed" {
    if (status === "Draft") return "draft";
    if (status === "Active") return "active";
    return "closed";
}

export function isIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function monthRange(year: number, month: number): { from: string; to: string } {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from, to: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

export function currentMonthRange(now = new Date()): { from: string; to: string } {
    return monthRange(now.getFullYear(), now.getMonth() + 1);
}

export function forecastWeightCopy(weighting: ForecastWeighting): string {
    if (weighting === "unconfigured") return "Stage probabilities are not configured. Weighted forecast is unavailable.";
    if (weighting === "partial") return "Some open stages have no probability. Their value is listed as unweighted pipeline value and is not treated as zero inside the weighted forecast.";
    return "Weighted forecast uses a probability for every open stage.";
}

export function showWeightedAmount(weighting: ForecastWeighting, value: number | null): value is number {
    return weighting !== "unconfigured" && value !== null;
}

export function blankOpportunityForm(): OpportunityForm {
    return {
        reference: "",
        title: "",
        clientId: "",
        leadId: "",
        ownerEmployeeId: "",
        value: "",
        expectedClose: "",
        source: "",
        priority: "Medium",
        notes: "",
        stage: "Qualification",
        lostReason: "",
        closedOn: "",
    };
}

export function opportunityFormFrom(record: Opportunity): OpportunityForm {
    return {
        reference: record.reference,
        title: record.title,
        clientId: record.clientId ?? "",
        leadId: record.leadId ?? "",
        ownerEmployeeId: record.ownerEmployeeId ?? "",
        value: String(record.value),
        expectedClose: record.expectedClose,
        source: record.source,
        priority: record.priority,
        notes: record.notes,
        stage: record.stage,
        lostReason: record.lostReason ?? "",
        closedOn: record.closedOn ?? "",
    };
}

export function blankProposalLine(): ProposalLineForm {
    return { description: "", quantity: "1", unitPrice: "", discount: "0" };
}

export function blankProposalForm(): ProposalForm {
    return {
        number: "",
        title: "",
        clientId: "",
        opportunityId: "",
        validityDate: "",
        notes: "",
        ratePercent: "",
        lines: [blankProposalLine()],
    };
}

export function proposalFormFrom(record: ProposalDetail): ProposalForm {
    return {
        number: record.number,
        title: record.title,
        clientId: record.clientId,
        opportunityId: record.opportunityId ?? "",
        validityDate: record.validityDate,
        notes: record.notes,
        ratePercent: percentFromBps(record.rateBps),
        lines: record.lines.map((line) => ({
            description: line.description,
            quantity: String(line.quantity),
            unitPrice: String(line.unitPrice),
            discount: String(line.discount),
        })),
    };
}

export function blankAgreementForm(): AgreementForm {
    return {
        number: "",
        title: "",
        description: "",
        clientId: "",
        opportunityId: "",
        proposalId: "",
        startDate: "",
        endDate: "",
        value: "",
    };
}

export function agreementFormFrom(record: Agreement): AgreementForm {
    return {
        number: record.number,
        title: record.title,
        description: record.description,
        clientId: record.clientId,
        opportunityId: record.opportunityId ?? "",
        proposalId: record.proposalId ?? "",
        startDate: record.startDate,
        endDate: record.endDate,
        value: String(record.value),
    };
}

function invalid<T>(message: string, fields: Record<string, string>): Checked<T> {
    return { ok: false, message, fields };
}

function requiredText(value: string, field: string, label: string, max: number, fields: Record<string, string>): string {
    const trimmed = value.trim();
    if (!trimmed) fields[field] = `Enter a ${label}`;
    else if (trimmed.length > max) fields[field] = `Use at most ${max} characters`;
    return trimmed;
}

function boundedText(value: string, field: string, max: number, fields: Record<string, string>): string {
    const trimmed = value.trim();
    if (trimmed.length > max) fields[field] = `Use at most ${max} characters`;
    return trimmed;
}

function rupeesField(value: string, field: string, fields: Record<string, string>): number | null {
    const amount = wholeRupees(value);
    if (amount === null || amount > 10_000_000) {
        fields[field] = "Enter a whole number of rupees up to 10000000";
        return null;
    }
    return amount;
}

function dateField(value: string, field: string, fields: Record<string, string>): void {
    if (!isIsoDate(value)) fields[field] = "Enter a valid date";
}

function optionalDate(value: string, field: string, fields: Record<string, string>): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (!isIsoDate(trimmed)) {
        fields[field] = "Enter a valid date";
        return undefined;
    }
    return trimmed;
}

function relationOrNull(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

export function opportunityBody(input: OpportunityForm, mode: "create"): Checked<OpportunityDraft>;
export function opportunityBody(input: OpportunityForm, mode: "edit"): Checked<OpportunityUpdate>;
export function opportunityBody(input: OpportunityForm, mode: "create" | "edit"): Checked<OpportunityDraft | OpportunityUpdate> {
    const fields: Record<string, string> = {};
    const reference = requiredText(input.reference, "reference", "reference", 40, fields);
    const title = requiredText(input.title, "title", "title", 200, fields);
    const source = requiredText(input.source, "source", "source", 80, fields);
    const notes = boundedText(input.notes, "notes", 2000, fields);
    const value = rupeesField(input.value, "value", fields);
    dateField(input.expectedClose, "expectedClose", fields);
    const shared = {
        reference,
        title,
        clientId: relationOrNull(input.clientId),
        leadId: relationOrNull(input.leadId),
        ownerEmployeeId: relationOrNull(input.ownerEmployeeId),
        value: value ?? 0,
        expectedClose: input.expectedClose,
        source,
        priority: input.priority,
        notes,
    };
    if (mode === "edit") {
        if (Object.keys(fields).length > 0) return invalid("Check the opportunity", fields);
        return { ok: true, body: shared };
    }
    const lostReason = boundedText(input.lostReason, "lostReason", 500, fields);
    const closedOn = optionalDate(input.closedOn, "closedOn", fields);
    if (input.stage === "Lost" && !lostReason) fields.lostReason = "Lost reason is required";
    if (input.stage !== "Lost" && lostReason) fields.lostReason = "Lost reason applies only when the stage is Lost";
    if (input.stage !== "Won" && input.stage !== "Lost" && closedOn) fields.closedOn = "Closed date applies only when the stage is Won or Lost";
    if (Object.keys(fields).length > 0 || value === null) return invalid("Check the opportunity", fields);
    const body: OpportunityDraft = { ...shared, value, stage: input.stage };
    if (input.stage === "Lost") body.lostReason = lostReason;
    if (closedOn && (input.stage === "Won" || input.stage === "Lost")) body.closedOn = closedOn;
    return { ok: true, body };
}

export function stageChangeBody(input: { stage: OpportunityStage; lostReason: string; closedOn: string }): Checked<StageChange> {
    const fields: Record<string, string> = {};
    const lostReason = boundedText(input.lostReason, "lostReason", 500, fields);
    const closedOn = optionalDate(input.closedOn, "closedOn", fields);
    if (input.stage === "Lost" && !lostReason) fields.lostReason = "Lost reason is required";
    if (input.stage !== "Lost" && lostReason) fields.lostReason = "Lost reason applies only when the stage is Lost";
    if (input.stage !== "Won" && input.stage !== "Lost" && closedOn) fields.closedOn = "Closed date applies only when the stage is Won or Lost";
    if (Object.keys(fields).length > 0) return invalid("Check the stage change", fields);
    const body: StageChange = { stage: input.stage };
    if (input.stage === "Lost" && lostReason) body.lostReason = lostReason;
    if (closedOn && (input.stage === "Won" || input.stage === "Lost")) body.closedOn = closedOn;
    return { ok: true, body };
}

export function proposalBody(input: ProposalForm): Checked<ProposalDraft> {
    const fields: Record<string, string> = {};
    const number = requiredText(input.number, "number", "number", 40, fields);
    const title = requiredText(input.title, "title", "title", 200, fields);
    const notes = boundedText(input.notes, "notes", 2000, fields);
    const rateBps = basisPoints(input.ratePercent);
    if (!input.clientId.trim()) fields.clientId = "Choose a client";
    if (rateBps === null) fields.rateBps = "Enter a tax rate up to 100 percent";
    dateField(input.validityDate, "validityDate", fields);
    if (input.lines.length < 1) fields.lines = "Add at least one line";
    if (input.lines.length > 50) fields.lines = "Use at most 50 lines";
    const lines = input.lines.map((line, index) => {
        const quantity = wholeRupees(line.quantity);
        const unitPrice = rupeesField(line.unitPrice, `lines.${index}.unitPrice`, fields);
        const discount = line.discount.trim() === "" ? 0 : rupeesField(line.discount, `lines.${index}.discount`, fields);
        if (!line.description.trim()) fields[`lines.${index}.description`] = "Enter a description";
        else if (line.description.trim().length > 200) fields[`lines.${index}.description`] = "Use at most 200 characters";
        if (quantity === null || quantity < 1 || quantity > 10_000) fields[`lines.${index}.quantity`] = "Enter a whole quantity from 1 to 10000";
        if (unitPrice !== null && discount !== null && quantity !== null && discount > quantity * unitPrice) {
            fields[`lines.${index}.discount`] = "Discount cannot exceed the line amount";
        }
        return {
            description: line.description.trim(),
            quantity: quantity ?? 0,
            unitPrice: unitPrice ?? 0,
            discount: discount ?? 0,
        };
    });
    if (Object.keys(fields).length > 0 || rateBps === null) return invalid("Check the proposal", fields);
    return {
        ok: true,
        body: {
            number,
            title,
            clientId: input.clientId,
            opportunityId: relationOrNull(input.opportunityId),
            validityDate: input.validityDate,
            notes,
            rateBps,
            lines,
        },
    };
}

function taxPaise(subtotalPaise: number, rateBps: number): number {
    const whole = Math.floor(subtotalPaise / 10000) * rateBps;
    const remainder = subtotalPaise % 10000;
    return whole + Math.floor((remainder * rateBps + 5000) / 10000);
}

export function previewProposal(body: Pick<ProposalDraft, "lines" | "rateBps">): { subtotal: number; discount: number; tax: number; total: number; lineAmounts: number[] } {
    const lineAmounts = body.lines.map((line) => line.quantity * line.unitPrice - line.discount);
    const subtotal = body.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const discount = body.lines.reduce((sum, line) => sum + line.discount, 0);
    const taxablePaise = (subtotal - discount) * 100;
    const tax = Math.trunc(taxPaise(taxablePaise, body.rateBps) / 100);
    return { subtotal, discount, tax, total: subtotal - discount + tax, lineAmounts };
}

export function proposalStatusBody(from: ProposalStatus, to: ProposalStatus): Checked<{ status: ProposalStatus }> {
    if (!PROPOSAL_NEXT[from].includes(to)) {
        return invalid(`Cannot change this proposal from ${from} to ${to}`, {});
    }
    return { ok: true, body: { status: to } };
}

export function agreementBody(input: AgreementForm, scope: "active"): Checked<AgreementContentUpdate>;
export function agreementBody(input: AgreementForm, scope: "create" | "draft"): Checked<AgreementDraft>;
export function agreementBody(input: AgreementForm, scope: "create" | "draft" | "active"): Checked<AgreementDraft | AgreementContentUpdate> {
    const fields: Record<string, string> = {};
    const title = requiredText(input.title, "title", "title", 200, fields);
    const description = boundedText(input.description, "description", 4000, fields);
    const value = rupeesField(input.value, "value", fields);
    dateField(input.startDate, "startDate", fields);
    dateField(input.endDate, "endDate", fields);
    if (isIsoDate(input.startDate) && isIsoDate(input.endDate) && input.endDate < input.startDate) {
        fields.endDate = "End date must be on or after the start date";
    }
    if (scope === "active") {
        if (Object.keys(fields).length > 0 || value === null) return invalid("Check the agreement", fields);
        return { ok: true, body: { title, description, startDate: input.startDate, endDate: input.endDate, value } };
    }
    const number = requiredText(input.number, "number", "number", 40, fields);
    if (!input.clientId.trim()) fields.clientId = "Choose a client";
    if (Object.keys(fields).length > 0 || value === null) return invalid("Check the agreement", fields);
    return {
        ok: true,
        body: {
            number,
            title,
            description,
            clientId: input.clientId,
            opportunityId: relationOrNull(input.opportunityId),
            proposalId: relationOrNull(input.proposalId),
            startDate: input.startDate,
            endDate: input.endDate,
            value,
        },
    };
}

export function agreementStatusBody(from: AgreementStatus, to: AgreementStatus): Checked<{ status: AgreementStatus }> {
    if (!AGREEMENT_NEXT[from].includes(to)) {
        return invalid(`Cannot change this agreement from ${from} to ${to}`, {});
    }
    return { ok: true, body: { status: to } };
}

export function probabilityBody(input: Record<OpenStage, string>): Checked<{ stages: { stage: OpenStage; probability: number }[] }> {
    const fields: Record<string, string> = {};
    const stages: { stage: OpenStage; probability: number }[] = [];
    for (const stage of OPEN_STAGES) {
        const text = input[stage].trim();
        if (!text) continue;
        if (!/^\d+$/.test(text)) {
            fields[stage] = "Enter a whole percent from 0 to 100";
            continue;
        }
        const probability = Number(text);
        if (probability > 100) fields[stage] = "Enter a whole percent from 0 to 100";
        else stages.push({ stage, probability });
    }
    if (Object.keys(fields).length > 0) return invalid("Check the stage probabilities", fields);
    return { ok: true, body: { stages } };
}

export function forecastRange(from: string, to: string): Checked<{ from: string; to: string }> {
    const fields: Record<string, string> = {};
    if (!isIsoDate(from)) fields.from = "Enter a valid date";
    if (!isIsoDate(to)) fields.to = "Enter a valid date";
    if (!fields.from && !fields.to && from > to) fields.to = "End date must be on or after the start date";
    if (Object.keys(fields).length > 0) return invalid("Check the forecast period", fields);
    return { ok: true, body: { from, to } };
}

export function createSalesApi(client: RequestClient) {
    return {
        opportunities: {
            list(query: {
                page?: number;
                pageSize?: number;
                search?: string;
                stage?: OpportunityStage;
                priority?: SalesPriority;
                source?: string;
                clientId?: string;
                leadId?: string;
                ownerEmployeeId?: string;
                expectedFrom?: string;
                expectedTo?: string;
                sort?: "reference" | "title" | "stage" | "value" | "priority" | "expectedClose" | "source";
                direction?: "asc" | "desc";
            } = {}) {
                return client.request<Page<Opportunity>>(`/api/sales/opportunities${toQuery(query)}`);
            },
            summary() {
                return client.request<PipelineSummary>("/api/sales/opportunities/summary");
            },
            get(id: string) {
                return client.request<OpportunityDetail>(`/api/sales/opportunities/${encodeURIComponent(id)}`);
            },
            create(body: OpportunityDraft) {
                return client.request<OpportunityDetail>("/api/sales/opportunities", { method: "POST", body });
            },
            update(id: string, body: OpportunityUpdate) {
                return client.request<OpportunityDetail>(`/api/sales/opportunities/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
            changeStage(id: string, body: StageChange) {
                return client.request<OpportunityDetail>(`/api/sales/opportunities/${encodeURIComponent(id)}/stage`, { method: "POST", body });
            },
        },
        forecast: {
            get(query: { from: string; to: string }) {
                return client.request<Forecast>(`/api/sales/forecast${toQuery(query)}`);
            },
            probabilities() {
                return client.request<{ stages: StageProbability[] }>("/api/sales/stage-probabilities");
            },
            saveProbabilities(body: { stages: { stage: OpenStage; probability: number }[] }) {
                return client.request<{ stages: StageProbability[] }>("/api/sales/stage-probabilities", { method: "PUT", body });
            },
        },
        proposals: {
            list(query: {
                page?: number;
                pageSize?: number;
                search?: string;
                status?: ProposalStatus;
                clientId?: string;
                opportunityId?: string;
                validityFrom?: string;
                validityTo?: string;
                sort?: "number" | "title" | "status" | "total" | "validity";
                direction?: "asc" | "desc";
            } = {}) {
                return client.request<Page<Proposal>>(`/api/sales/proposals${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<ProposalDetail>(`/api/sales/proposals/${encodeURIComponent(id)}`);
            },
            create(body: ProposalDraft) {
                return client.request<ProposalDetail>("/api/sales/proposals", { method: "POST", body });
            },
            update(id: string, body: ProposalDraft) {
                return client.request<ProposalDetail>(`/api/sales/proposals/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
            changeStatus(id: string, body: { status: ProposalStatus }) {
                return client.request<ProposalDetail>(`/api/sales/proposals/${encodeURIComponent(id)}/status`, { method: "POST", body });
            },
        },
        agreements: {
            list(query: {
                page?: number;
                pageSize?: number;
                search?: string;
                status?: AgreementStatus;
                clientId?: string;
                opportunityId?: string;
                proposalId?: string;
                endFrom?: string;
                endTo?: string;
                sort?: "number" | "title" | "status" | "value" | "startDate" | "endDate";
                direction?: "asc" | "desc";
            } = {}) {
                return client.request<Page<Agreement>>(`/api/sales/agreements${toQuery(query)}`);
            },
            get(id: string) {
                return client.request<AgreementDetail>(`/api/sales/agreements/${encodeURIComponent(id)}`);
            },
            create(body: AgreementDraft) {
                return client.request<AgreementDetail>("/api/sales/agreements", { method: "POST", body });
            },
            update(id: string, body: AgreementDraft | AgreementContentUpdate) {
                return client.request<AgreementDetail>(`/api/sales/agreements/${encodeURIComponent(id)}`, { method: "PATCH", body });
            },
            changeStatus(id: string, body: { status: AgreementStatus }) {
                return client.request<AgreementDetail>(`/api/sales/agreements/${encodeURIComponent(id)}/status`, { method: "POST", body });
            },
        },
    };
}

export const sales = createSalesApi(api);
