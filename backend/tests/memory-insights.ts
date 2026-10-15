import { applyCounts, CONTENT_STATUS_COUNTS, FOLLOW_UP_STATUS_COUNTS, LEAD_STAGE_COUNTS, PROJECT_STATUS_COUNTS, TASK_STATUS_COUNTS } from "../src/modules/insights/catalog.js";
import type { CampaignSummary, FinanceMonth, FinanceSummary, InsightStore, LeadSummary, ReferralSummary, ServiceRateSummary, StatusSummary } from "../src/modules/insights/insight.store.js";
import { dateInRange, monthKey, timestampInRange, type DateRange } from "../src/modules/insights/range.js";

export type InsightData = {
  clients: { organizationId: string; customerSince: string }[];
  leads: { organizationId: string; stage: string; source: string; valuePaise: number; createdAt: Date }[];
  projects: { organizationId: string; status: string; startDate: string }[];
  tasks: { organizationId: string; status: string; dueDate: string | null }[];
  followUps: { organizationId: string; status: string; dueAt: Date }[];
  invoices: { organizationId: string; status: string; issueDate: string; totalPaise: number; amountPaidPaise: number; taxPaise: number }[];
  payments: { organizationId: string; paidOn: string; amountPaise: number }[];
  expenses: { organizationId: string; spentOn: string; amountPaise: number }[];
  employees: { organizationId: string; createdAt: Date }[];
  campaigns: { organizationId: string; spendPaise: number; leads: number; createdAt: Date }[];
  content: { organizationId: string; status: string; publishDate: string }[];
  referrals: { organizationId: string; revenuePaise: number; commissionPaise: number; createdAt: Date }[];
  serviceRates: { organizationId: string; active: boolean; createdAt: Date }[];
  attendance: { organizationId: string; workDate: string }[];
};

export function emptyInsightData(): InsightData {
  return {
    clients: [],
    leads: [],
    projects: [],
    tasks: [],
    followUps: [],
    invoices: [],
    payments: [],
    expenses: [],
    employees: [],
    campaigns: [],
    content: [],
    referrals: [],
    serviceRates: [],
    attendance: [],
  };
}

function counts(rows: { key: string }[], fill: () => Record<string, number>): Record<string, number> {
  const grouped = new Map<string, number>();
  for (const row of rows) grouped.set(row.key, (grouped.get(row.key) ?? 0) + 1);
  return applyCounts(fill(), [...grouped.entries()].map(([key, count]) => ({ key, count })));
}

export function createMemoryInsightStore(data: InsightData): InsightStore {
  return {
    async countClients(organizationId, range) {
      return data.clients.filter((row) => row.organizationId === organizationId && dateInRange(row.customerSince, range)).length;
    },
    async leadSummary(organizationId, range: DateRange): Promise<LeadSummary> {
      const rows = data.leads.filter((row) => row.organizationId === organizationId && timestampInRange(row.createdAt, range));
      return {
        total: rows.length,
        byStage: counts(rows.map((row) => ({ key: row.stage })), LEAD_STAGE_COUNTS),
        bySource: Object.fromEntries([...new Set(rows.map((row) => row.source))].map((source) => [source, rows.filter((row) => row.source === source).length])),
        valuePaise: rows.reduce((sum, row) => sum + row.valuePaise, 0),
      };
    },
    async projectSummary(organizationId, range): Promise<StatusSummary> {
      const rows = data.projects.filter((row) => row.organizationId === organizationId && dateInRange(row.startDate, range));
      return { total: rows.length, byStatus: counts(rows.map((row) => ({ key: row.status })), PROJECT_STATUS_COUNTS) };
    },
    async taskSummary(organizationId, range): Promise<StatusSummary> {
      const rows = data.tasks.filter((row) => row.organizationId === organizationId && dateInRange(row.dueDate, range));
      return { total: rows.length, byStatus: counts(rows.map((row) => ({ key: row.status })), TASK_STATUS_COUNTS) };
    },
    async followUpSummary(organizationId, range): Promise<StatusSummary> {
      const rows = data.followUps.filter((row) => row.organizationId === organizationId && timestampInRange(row.dueAt, range));
      return { total: rows.length, byStatus: counts(rows.map((row) => ({ key: row.status })), FOLLOW_UP_STATUS_COUNTS) };
    },
    async financeSummary(organizationId, range): Promise<FinanceSummary> {
      const issuedRows = data.invoices.filter((row) => row.organizationId === organizationId && row.status !== "Draft" && dateInRange(row.issueDate, range));
      const issuedPaise = issuedRows.reduce((sum, row) => sum + row.totalPaise, 0);
      const paidOnIssued = issuedRows.reduce((sum, row) => sum + row.amountPaidPaise, 0);
      const taxPaise = issuedRows.reduce((sum, row) => sum + row.taxPaise, 0);
      const ranged = Boolean(range.from || range.to);
      const paymentRows = data.payments.filter((row) => row.organizationId === organizationId && dateInRange(row.paidOn, range));
      const collectedPaise = ranged
        ? paymentRows.reduce((sum, row) => sum + row.amountPaise, 0)
        : data.invoices.filter((row) => row.organizationId === organizationId && row.status !== "Draft").reduce((sum, row) => sum + row.amountPaidPaise, 0);
      const expenseRows = data.expenses.filter((row) => row.organizationId === organizationId && dateInRange(row.spentOn, range));
      const months = new Map<string, FinanceMonth>();
      const ensure = (month: string): FinanceMonth => {
        const current = months.get(month) ?? { month, revenuePaise: 0, expensePaise: 0, inflowPaise: 0 };
        months.set(month, current);
        return current;
      };
      for (const row of issuedRows) ensure(monthKey(row.issueDate)).revenuePaise += row.totalPaise;
      for (const row of expenseRows) ensure(monthKey(row.spentOn)).expensePaise += row.amountPaise;
      for (const row of data.payments.filter((item) => item.organizationId === organizationId && dateInRange(item.paidOn, range))) {
        ensure(monthKey(row.paidOn)).inflowPaise += row.amountPaise;
      }
      return {
        issuedPaise,
        collectedPaise,
        outstandingPaise: issuedPaise - (ranged ? paidOnIssued : collectedPaise),
        expensePaise: expenseRows.reduce((sum, row) => sum + row.amountPaise, 0),
        taxPaise,
        months: [...months.values()].sort((left, right) => left.month.localeCompare(right.month)),
      };
    },
    async countEmployees(organizationId, range) {
      return data.employees.filter((row) => row.organizationId === organizationId && timestampInRange(row.createdAt, range)).length;
    },
    async campaignSummary(organizationId, range): Promise<CampaignSummary> {
      const rows = data.campaigns.filter((row) => row.organizationId === organizationId && timestampInRange(row.createdAt, range));
      return {
        total: rows.length,
        spendPaise: rows.reduce((sum, row) => sum + row.spendPaise, 0),
        leads: rows.reduce((sum, row) => sum + row.leads, 0),
      };
    },
    async contentSummary(organizationId, range): Promise<StatusSummary> {
      const rows = data.content.filter((row) => row.organizationId === organizationId && dateInRange(row.publishDate, range));
      return { total: rows.length, byStatus: counts(rows.map((row) => ({ key: row.status })), CONTENT_STATUS_COUNTS) };
    },
    async referralSummary(organizationId, range): Promise<ReferralSummary> {
      const rows = data.referrals.filter((row) => row.organizationId === organizationId && timestampInRange(row.createdAt, range));
      return {
        total: rows.length,
        revenuePaise: rows.reduce((sum, row) => sum + row.revenuePaise, 0),
        commissionPaise: rows.reduce((sum, row) => sum + row.commissionPaise, 0),
      };
    },
    async serviceRateSummary(organizationId, range): Promise<ServiceRateSummary> {
      const rows = data.serviceRates.filter((row) => row.organizationId === organizationId && timestampInRange(row.createdAt, range));
      return { total: rows.length, active: rows.filter((row) => row.active).length };
    },
    async countAttendance(organizationId, range) {
      return data.attendance.filter((row) => row.organizationId === organizationId && dateInRange(row.workDate, range)).length;
    },
  };
}
