import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { expenses, invoices } from "../../db/schema/index.js";

export type FinanceSummary = {
  issuedPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  expensePaise: number;
};

export type FinanceSummaryStore = {
  summary(organizationId: string): Promise<FinanceSummary>;
};

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createDrizzleFinanceSummaryStore(database: Database): FinanceSummaryStore {
  const { db } = database;
  return {
    async summary(organizationId) {
      const [issued] = await db
        .select({
          total: sql<string>`coalesce(sum(${invoices.totalPaise}), 0)`,
          paid: sql<string>`coalesce(sum(${invoices.amountPaidPaise}), 0)`,
        })
        .from(invoices)
        .where(and(eq(invoices.organizationId, organizationId), sql`${invoices.status} <> 'Draft'`));
      const [spent] = await db
        .select({ total: sql<string>`coalesce(sum(${expenses.amountPaise}), 0)` })
        .from(expenses)
        .where(eq(expenses.organizationId, organizationId));
      const issuedPaise = asNumber(issued?.total);
      const collectedPaise = asNumber(issued?.paid);
      return {
        issuedPaise,
        collectedPaise,
        outstandingPaise: issuedPaise - collectedPaise,
        expensePaise: asNumber(spent?.total),
      };
    },
  };
}
