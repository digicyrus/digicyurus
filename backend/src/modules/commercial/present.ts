import { paiseToRupees } from "../crm/constants.js";
import type { ReferralRecord } from "./referrals.store.js";
import type { ServiceRateRecord } from "./service-rates.store.js";

export function presentReferral(record: ReferralRecord) {
  return {
    id: record.id,
    code: record.code,
    partner: record.partner,
    clientId: record.clientId,
    deals: record.deals,
    revenue: paiseToRupees(record.revenuePaise),
    commission: paiseToRupees(record.commissionPaise),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentServiceRate(record: ServiceRateRecord) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    unit: record.unit,
    rate: paiseToRupees(record.ratePaise),
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
