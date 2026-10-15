import type { ClientRecord } from "./clients.store.js";
import { paiseToRupees } from "./constants.js";
import type { FollowUpRecord } from "./follow-ups.store.js";
import type { LeadRecord } from "./leads.store.js";

export function presentClient(record: ClientRecord) {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    contactName: record.contactName,
    industry: record.industry,
    status: record.status,
    rating: record.rating,
    customerSince: record.customerSince,
    email: record.email,
    phone: record.phone,
    lifetimeValue: 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentLead(record: LeadRecord) {
  return {
    id: record.id,
    code: record.code,
    company: record.company,
    person: record.person,
    stage: record.stage,
    value: paiseToRupees(record.valuePaise),
    source: record.source,
    priority: record.priority,
    closing: record.expectedClose,
    probability: record.probability,
    clientId: record.clientId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentFollowUp(record: FollowUpRecord) {
  return {
    id: record.id,
    clientId: record.clientId,
    leadId: record.leadId,
    ownerEmployeeId: record.ownerEmployeeId,
    dueAt: record.dueAt.toISOString(),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
