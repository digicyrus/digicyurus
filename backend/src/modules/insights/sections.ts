import type { InsightStore } from "./insight.store.js";
import { presentCampaignSummary, presentFinance, presentLeadSummary, presentReferralSummary, presentServiceRateSummary, presentStatusSummary } from "./present.js";
import type { DateRange } from "./range.js";

export type InsightView = {
  clients: number | null;
  leads: ReturnType<typeof presentLeadSummary> | null;
  projects: ReturnType<typeof presentStatusSummary> | null;
  tasks: ReturnType<typeof presentStatusSummary> | null;
  followUps: ReturnType<typeof presentStatusSummary> | null;
  finance: ReturnType<typeof presentFinance> | null;
  employees: number | null;
  campaigns: ReturnType<typeof presentCampaignSummary> | null;
  content: ReturnType<typeof presentStatusSummary> | null;
  referrals: ReturnType<typeof presentReferralSummary> | null;
  serviceRates: ReturnType<typeof presentServiceRateSummary> | null;
  attendance: number | null;
};

export async function loadInsight(
  store: InsightStore,
  organizationId: string,
  range: DateRange,
  permissions: readonly string[],
  financeDetail: boolean,
): Promise<InsightView> {
  const allowed = (key: string) => permissions.includes(key);
  const [clients, leads, projects, tasks, followUps, finance, employees, campaigns, content, referrals, serviceRates, attendance] = await Promise.all([
    allowed("clients:view") ? store.countClients(organizationId, range) : null,
    allowed("leads:view") ? store.leadSummary(organizationId, range).then(presentLeadSummary) : null,
    allowed("projects:view") ? store.projectSummary(organizationId, range).then(presentStatusSummary) : null,
    allowed("tasks:view") ? store.taskSummary(organizationId, range).then(presentStatusSummary) : null,
    allowed("follow_ups:view") ? store.followUpSummary(organizationId, range).then(presentStatusSummary) : null,
    allowed("finance:view") ? store.financeSummary(organizationId, range).then((summary) => presentFinance(summary, financeDetail)) : null,
    allowed("employees:view") ? store.countEmployees(organizationId, range) : null,
    allowed("campaigns:view") ? store.campaignSummary(organizationId, range).then(presentCampaignSummary) : null,
    allowed("content:view") ? store.contentSummary(organizationId, range).then(presentStatusSummary) : null,
    allowed("referrals:view") ? store.referralSummary(organizationId, range).then(presentReferralSummary) : null,
    allowed("service_rates:view") ? store.serviceRateSummary(organizationId, range).then(presentServiceRateSummary) : null,
    allowed("attendance:view") ? store.countAttendance(organizationId, range) : null,
  ]);
  return { clients, leads, projects, tasks, followUps, finance, employees, campaigns, content, referrals, serviceRates, attendance };
}
