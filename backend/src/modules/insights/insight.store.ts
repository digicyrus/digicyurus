import { and, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import {
  attendance,
  campaigns,
  clients,
  contentItems,
  employees,
  expenses,
  followUps,
  invoicePayments,
  invoices,
  leads,
  projects,
  referrals,
  serviceRates,
  tasks,
} from "../../db/schema/index.js";
import {
  applyCounts,
  CONTENT_STATUS_COUNTS,
  FOLLOW_UP_STATUS_COUNTS,
  LEAD_STAGE_COUNTS,
  PROJECT_STATUS_COUNTS,
  TASK_STATUS_COUNTS,
} from "./catalog.js";
import { rangeEndExclusive, rangeStart, type DateRange } from "./range.js";

export type CountMap = Record<string, number>;

export type LeadSummary = {
  total: number;
  byStage: CountMap;
  bySource: CountMap;
  valuePaise: number;
};

export type StatusSummary = {
  total: number;
  byStatus: CountMap;
};

export type FinanceMonth = {
  month: string;
  revenuePaise: number;
  expensePaise: number;
  inflowPaise: number;
};

export type FinanceSummary = {
  issuedPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  expensePaise: number;
  taxPaise: number;
  months: FinanceMonth[];
};

export type CampaignSummary = {
  total: number;
  spendPaise: number;
  leads: number;
};

export type ReferralSummary = {
  total: number;
  revenuePaise: number;
  commissionPaise: number;
};

export type ServiceRateSummary = {
  total: number;
  active: number;
};

export type InsightStore = {
  countClients(organizationId: string, range: DateRange): Promise<number>;
  leadSummary(organizationId: string, range: DateRange): Promise<LeadSummary>;
  projectSummary(organizationId: string, range: DateRange): Promise<StatusSummary>;
  taskSummary(organizationId: string, range: DateRange): Promise<StatusSummary>;
  followUpSummary(organizationId: string, range: DateRange): Promise<StatusSummary>;
  financeSummary(organizationId: string, range: DateRange): Promise<FinanceSummary>;
  countEmployees(organizationId: string, range: DateRange): Promise<number>;
  campaignSummary(organizationId: string, range: DateRange): Promise<CampaignSummary>;
  contentSummary(organizationId: string, range: DateRange): Promise<StatusSummary>;
  referralSummary(organizationId: string, range: DateRange): Promise<ReferralSummary>;
  serviceRateSummary(organizationId: string, range: DateRange): Promise<ServiceRateSummary>;
  countAttendance(organizationId: string, range: DateRange): Promise<number>;
};

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateBounds(column: SQLWrapper, range: DateRange): SQL[] {
  const filters: SQL[] = [];
  if (range.from) filters.push(sql`${column} >= ${range.from}`);
  if (range.to) filters.push(sql`${column} <= ${range.to}`);
  return filters;
}

function timeBounds(column: SQLWrapper, range: DateRange): SQL[] {
  const filters: SQL[] = [];
  if (range.from) filters.push(sql`${column} >= ${rangeStart(range.from)}`);
  if (range.to) filters.push(sql`${column} < ${rangeEndExclusive(range.to)}`);
  return filters;
}

export function createDrizzleInsightStore(database: Database): InsightStore {
  const { db } = database;

  return {
    async countClients(organizationId, range) {
      const [row] = await db
        .select({ value: sql<number>`cast(count(*) as int)` })
        .from(clients)
        .where(and(eq(clients.organizationId, organizationId), ...dateBounds(clients.customerSince, range)));
      return asNumber(row?.value);
    },
    async leadSummary(organizationId, range) {
      const where = and(eq(leads.organizationId, organizationId), ...timeBounds(leads.createdAt, range));
      const [totals] = await db
        .select({
          total: sql<number>`cast(count(*) as int)`,
          value: sql<string>`coalesce(sum(${leads.valuePaise}), 0)`,
        })
        .from(leads)
        .where(where);
      const stages = await db
        .select({ key: leads.stage, count: sql<number>`cast(count(*) as int)` })
        .from(leads)
        .where(where)
        .groupBy(leads.stage);
      const sources = await db
        .select({ key: leads.source, count: sql<number>`cast(count(*) as int)` })
        .from(leads)
        .where(where)
        .groupBy(leads.source);
      return {
        total: asNumber(totals?.total),
        byStage: applyCounts(LEAD_STAGE_COUNTS(), stages.map((row) => ({ key: row.key, count: asNumber(row.count) }))),
        bySource: Object.fromEntries(sources.map((row) => [row.key, asNumber(row.count)])),
        valuePaise: asNumber(totals?.value),
      };
    },
    async projectSummary(organizationId, range) {
      const where = and(eq(projects.organizationId, organizationId), ...dateBounds(projects.startDate, range));
      const [totals] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(projects).where(where);
      const rows = await db
        .select({ key: projects.status, count: sql<number>`cast(count(*) as int)` })
        .from(projects)
        .where(where)
        .groupBy(projects.status);
      return {
        total: asNumber(totals?.value),
        byStatus: applyCounts(PROJECT_STATUS_COUNTS(), rows.map((row) => ({ key: row.key, count: asNumber(row.count) }))),
      };
    },
    async taskSummary(organizationId, range) {
      const where = and(eq(tasks.organizationId, organizationId), ...dateBounds(tasks.dueDate, range));
      const [totals] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(tasks).where(where);
      const rows = await db
        .select({ key: tasks.status, count: sql<number>`cast(count(*) as int)` })
        .from(tasks)
        .where(where)
        .groupBy(tasks.status);
      return {
        total: asNumber(totals?.value),
        byStatus: applyCounts(TASK_STATUS_COUNTS(), rows.map((row) => ({ key: row.key, count: asNumber(row.count) }))),
      };
    },
    async followUpSummary(organizationId, range) {
      const where = and(eq(followUps.organizationId, organizationId), ...timeBounds(followUps.dueAt, range));
      const [totals] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(followUps).where(where);
      const rows = await db
        .select({ key: followUps.status, count: sql<number>`cast(count(*) as int)` })
        .from(followUps)
        .where(where)
        .groupBy(followUps.status);
      return {
        total: asNumber(totals?.value),
        byStatus: applyCounts(FOLLOW_UP_STATUS_COUNTS(), rows.map((row) => ({ key: row.key, count: asNumber(row.count) }))),
      };
    },
    async financeSummary(organizationId, range) {
      const issuedWhere = and(eq(invoices.organizationId, organizationId), sql`${invoices.status} <> 'Draft'`, ...dateBounds(invoices.issueDate, range));
      const [issued] = await db
        .select({
          total: sql<string>`coalesce(sum(${invoices.totalPaise}), 0)`,
          paid: sql<string>`coalesce(sum(${invoices.amountPaidPaise}), 0)`,
          tax: sql<string>`coalesce(sum(${invoices.cgstPaise} + ${invoices.sgstPaise} + ${invoices.igstPaise}), 0)`,
        })
        .from(invoices)
        .where(issuedWhere);
      const ranged = Boolean(range.from || range.to);
      let collectedPaise = asNumber(issued?.paid);
      if (ranged) {
        const [paid] = await db
          .select({ total: sql<string>`coalesce(sum(${invoicePayments.amountPaise}), 0)` })
          .from(invoicePayments)
          .where(and(eq(invoicePayments.organizationId, organizationId), ...dateBounds(invoicePayments.paidOn, range)));
        collectedPaise = asNumber(paid?.total);
      }
      const [spent] = await db
        .select({ total: sql<string>`coalesce(sum(${expenses.amountPaise}), 0)` })
        .from(expenses)
        .where(and(eq(expenses.organizationId, organizationId), ...dateBounds(expenses.spentOn, range)));
      const issuedPaise = asNumber(issued?.total);
      const paidOnIssued = asNumber(issued?.paid);
      const revenueMonths = await db
        .select({
          month: sql<string>`to_char(${invoices.issueDate}, 'YYYY-MM')`,
          amount: sql<string>`coalesce(sum(${invoices.totalPaise}), 0)`,
        })
        .from(invoices)
        .where(issuedWhere)
        .groupBy(sql`to_char(${invoices.issueDate}, 'YYYY-MM')`);
      const expenseMonths = await db
        .select({
          month: sql<string>`to_char(${expenses.spentOn}, 'YYYY-MM')`,
          amount: sql<string>`coalesce(sum(${expenses.amountPaise}), 0)`,
        })
        .from(expenses)
        .where(and(eq(expenses.organizationId, organizationId), ...dateBounds(expenses.spentOn, range)))
        .groupBy(sql`to_char(${expenses.spentOn}, 'YYYY-MM')`);
      const inflowMonths = await db
        .select({
          month: sql<string>`to_char(${invoicePayments.paidOn}, 'YYYY-MM')`,
          amount: sql<string>`coalesce(sum(${invoicePayments.amountPaise}), 0)`,
        })
        .from(invoicePayments)
        .where(and(eq(invoicePayments.organizationId, organizationId), ...dateBounds(invoicePayments.paidOn, range)))
        .groupBy(sql`to_char(${invoicePayments.paidOn}, 'YYYY-MM')`);
      const months = new Map<string, FinanceMonth>();
      const ensure = (month: string): FinanceMonth => {
        const current = months.get(month) ?? { month, revenuePaise: 0, expensePaise: 0, inflowPaise: 0 };
        months.set(month, current);
        return current;
      };
      for (const row of revenueMonths) ensure(row.month).revenuePaise += asNumber(row.amount);
      for (const row of expenseMonths) ensure(row.month).expensePaise += asNumber(row.amount);
      for (const row of inflowMonths) ensure(row.month).inflowPaise += asNumber(row.amount);
      return {
        issuedPaise,
        collectedPaise,
        outstandingPaise: issuedPaise - (ranged ? paidOnIssued : collectedPaise),
        expensePaise: asNumber(spent?.total),
        taxPaise: asNumber(issued?.tax),
        months: [...months.values()].sort((left, right) => left.month.localeCompare(right.month)),
      };
    },
    async countEmployees(organizationId, range) {
      const [row] = await db
        .select({ value: sql<number>`cast(count(*) as int)` })
        .from(employees)
        .where(and(eq(employees.organizationId, organizationId), ...timeBounds(employees.createdAt, range)));
      return asNumber(row?.value);
    },
    async campaignSummary(organizationId, range) {
      const [row] = await db
        .select({
          total: sql<number>`cast(count(*) as int)`,
          spend: sql<string>`coalesce(sum(${campaigns.spendPaise}), 0)`,
          leads: sql<string>`coalesce(sum(${campaigns.leads}), 0)`,
        })
        .from(campaigns)
        .where(and(eq(campaigns.organizationId, organizationId), ...timeBounds(campaigns.createdAt, range)));
      return { total: asNumber(row?.total), spendPaise: asNumber(row?.spend), leads: asNumber(row?.leads) };
    },
    async contentSummary(organizationId, range) {
      const where = and(eq(contentItems.organizationId, organizationId), ...dateBounds(contentItems.publishDate, range));
      const [totals] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(contentItems).where(where);
      const rows = await db
        .select({ key: contentItems.status, count: sql<number>`cast(count(*) as int)` })
        .from(contentItems)
        .where(where)
        .groupBy(contentItems.status);
      return {
        total: asNumber(totals?.value),
        byStatus: applyCounts(CONTENT_STATUS_COUNTS(), rows.map((row) => ({ key: row.key, count: asNumber(row.count) }))),
      };
    },
    async referralSummary(organizationId, range) {
      const [row] = await db
        .select({
          total: sql<number>`cast(count(*) as int)`,
          revenue: sql<string>`coalesce(sum(${referrals.revenuePaise}), 0)`,
          commission: sql<string>`coalesce(sum(${referrals.commissionPaise}), 0)`,
        })
        .from(referrals)
        .where(and(eq(referrals.organizationId, organizationId), ...timeBounds(referrals.createdAt, range)));
      return { total: asNumber(row?.total), revenuePaise: asNumber(row?.revenue), commissionPaise: asNumber(row?.commission) };
    },
    async serviceRateSummary(organizationId, range) {
      const where = and(eq(serviceRates.organizationId, organizationId), ...timeBounds(serviceRates.createdAt, range));
      const [row] = await db
        .select({
          total: sql<number>`cast(count(*) as int)`,
          active: sql<number>`cast(count(*) filter (where ${serviceRates.active}) as int)`,
        })
        .from(serviceRates)
        .where(where);
      return { total: asNumber(row?.total), active: asNumber(row?.active) };
    },
    async countAttendance(organizationId, range) {
      const [row] = await db
        .select({ value: sql<number>`cast(count(*) as int)` })
        .from(attendance)
        .where(and(eq(attendance.organizationId, organizationId), ...dateBounds(attendance.workDate, range)));
      return asNumber(row?.value);
    },
  };
}
