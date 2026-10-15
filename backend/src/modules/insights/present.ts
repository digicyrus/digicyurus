import { paiseToRupees } from "../crm/constants.js";
import type { CampaignSummary, FinanceMonth, FinanceSummary, LeadSummary, ReferralSummary, ServiceRateSummary, StatusSummary } from "./insight.store.js";

export function presentLeadSummary(summary: LeadSummary) {
  return {
    total: summary.total,
    byStage: summary.byStage,
    bySource: summary.bySource,
    value: paiseToRupees(summary.valuePaise),
  };
}

export function presentStatusSummary(summary: StatusSummary) {
  return {
    total: summary.total,
    byStatus: summary.byStatus,
  };
}

export function presentFinance(summary: FinanceSummary, detail: boolean) {
  const issued = paiseToRupees(summary.issuedPaise);
  const expenses = paiseToRupees(summary.expensePaise);
  const base = {
    issued,
    collected: paiseToRupees(summary.collectedPaise),
    outstanding: paiseToRupees(summary.outstandingPaise),
    expenses,
    profit: paiseToRupees(summary.issuedPaise - summary.expensePaise),
  };
  if (!detail) return base;
  return {
    ...base,
    tax: paiseToRupees(summary.taxPaise),
    months: summary.months.map(presentMonth),
  };
}

function presentMonth(month: FinanceMonth) {
  return {
    month: month.month,
    revenue: paiseToRupees(month.revenuePaise),
    expenses: paiseToRupees(month.expensePaise),
    inflow: paiseToRupees(month.inflowPaise),
    outflow: paiseToRupees(month.expensePaise),
  };
}

export function presentCampaignSummary(summary: CampaignSummary) {
  return {
    total: summary.total,
    spend: paiseToRupees(summary.spendPaise),
    leads: summary.leads,
  };
}

export function presentReferralSummary(summary: ReferralSummary) {
  return {
    total: summary.total,
    revenue: paiseToRupees(summary.revenuePaise),
    commission: paiseToRupees(summary.commissionPaise),
  };
}

export function presentServiceRateSummary(summary: ServiceRateSummary) {
  return {
    total: summary.total,
    active: summary.active,
  };
}
