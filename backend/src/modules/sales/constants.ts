export const OPPORTUNITY_STAGES = ["Qualification", "Discovery", "Proposal", "Negotiation", "Won", "Lost"] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPEN_OPPORTUNITY_STAGES = ["Qualification", "Discovery", "Proposal", "Negotiation"] as const;
export type OpenOpportunityStage = (typeof OPEN_OPPORTUNITY_STAGES)[number];

export const SALES_PRIORITIES = ["High", "Medium", "Low"] as const;
export type SalesPriority = (typeof SALES_PRIORITIES)[number];

export const PROPOSAL_STATUSES = ["Draft", "Sent", "Accepted", "Rejected", "Expired"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const AGREEMENT_STATUSES = ["Draft", "Active", "Completed", "Terminated", "Expired"] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const OPPORTUNITY_SORTS = ["reference", "title", "stage", "value", "priority", "expectedClose", "source"] as const;
export const PROPOSAL_SORTS = ["number", "title", "status", "total", "validity"] as const;
export const AGREEMENT_SORTS = ["number", "title", "status", "value", "startDate", "endDate"] as const;

export function isOpportunityStage(value: string): value is OpportunityStage {
  return (OPPORTUNITY_STAGES as readonly string[]).includes(value);
}

export function isOpenOpportunityStage(value: string): value is OpenOpportunityStage {
  return (OPEN_OPPORTUNITY_STAGES as readonly string[]).includes(value);
}

export function isSalesPriority(value: string): value is SalesPriority {
  return (SALES_PRIORITIES as readonly string[]).includes(value);
}

export function isProposalStatus(value: string): value is ProposalStatus {
  return (PROPOSAL_STATUSES as readonly string[]).includes(value);
}

export function isAgreementStatus(value: string): value is AgreementStatus {
  return (AGREEMENT_STATUSES as readonly string[]).includes(value);
}

export function isTerminalAgreement(status: AgreementStatus): boolean {
  return status === "Completed" || status === "Terminated" || status === "Expired";
}
