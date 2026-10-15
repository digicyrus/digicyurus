import { AppError } from "../../lib/errors.js";
import type { ClientStore } from "../crm/clients.store.js";
import type { LeadStore } from "../crm/leads.store.js";
import type { EmployeeStore } from "../hr/employees.store.js";
import type { OpportunityStore } from "./opportunities.store.js";
import type { ProposalStore } from "./proposals.store.js";

export async function assertOpportunityLinks(
  dependencies: { clients: ClientStore; leads: LeadStore; employees: EmployeeStore },
  organizationId: string,
  input: { clientId: string | null; leadId: string | null; ownerEmployeeId: string | null },
): Promise<void> {
  if (input.clientId) {
    const client = await dependencies.clients.find(organizationId, input.clientId);
    if (!client) throw new AppError(404, "NOT_FOUND", "Client not found");
  }
  if (input.leadId) {
    const lead = await dependencies.leads.find(organizationId, input.leadId);
    if (!lead) throw new AppError(404, "NOT_FOUND", "Lead not found");
    if (input.clientId && lead.clientId && lead.clientId !== input.clientId) {
      throw new AppError(409, "CONFLICT", "Lead does not belong to this client");
    }
  }
  if (input.ownerEmployeeId) {
    const employee = await dependencies.employees.find(organizationId, input.ownerEmployeeId);
    if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");
  }
}

export async function assertProposalLinks(
  dependencies: { clients: ClientStore; opportunities: OpportunityStore },
  organizationId: string,
  input: { clientId: string; opportunityId: string | null },
): Promise<void> {
  const client = await dependencies.clients.find(organizationId, input.clientId);
  if (!client) throw new AppError(404, "NOT_FOUND", "Client not found");
  if (!input.opportunityId) return;
  const opportunity = await dependencies.opportunities.find(organizationId, input.opportunityId);
  if (!opportunity) throw new AppError(404, "NOT_FOUND", "Opportunity not found");
  if (opportunity.clientId && opportunity.clientId !== input.clientId) {
    throw new AppError(409, "CONFLICT", "Opportunity does not belong to this client");
  }
}

export async function assertAgreementLinks(
  dependencies: { clients: ClientStore; opportunities: OpportunityStore; proposals: ProposalStore },
  organizationId: string,
  input: { clientId: string; opportunityId: string | null; proposalId: string | null },
): Promise<void> {
  const client = await dependencies.clients.find(organizationId, input.clientId);
  if (!client) throw new AppError(404, "NOT_FOUND", "Client not found");
  if (input.opportunityId) {
    const opportunity = await dependencies.opportunities.find(organizationId, input.opportunityId);
    if (!opportunity) throw new AppError(404, "NOT_FOUND", "Opportunity not found");
    if (opportunity.clientId && opportunity.clientId !== input.clientId) {
      throw new AppError(409, "CONFLICT", "Opportunity does not belong to this client");
    }
  }
  if (!input.proposalId) return;
  const proposal = await dependencies.proposals.find(organizationId, input.proposalId);
  if (!proposal) throw new AppError(404, "NOT_FOUND", "Proposal not found");
  if (proposal.clientId !== input.clientId) throw new AppError(409, "CONFLICT", "Proposal does not belong to this client");
  if (proposal.opportunityId && input.opportunityId && proposal.opportunityId !== input.opportunityId) {
    throw new AppError(409, "CONFLICT", "Proposal is linked to a different opportunity");
  }
}
