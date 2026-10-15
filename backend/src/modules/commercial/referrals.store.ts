import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { referrals } from "../../db/schema/index.js";
import { rupeesToPaise } from "../crm/constants.js";
import { containsPattern, type ReferralStatus } from "./constants.js";
import { rethrowConstraint } from "./conflicts.js";
import type { ReferralListQuery, UpdateReferralBody } from "./referrals.schema.js";

export type ReferralRecord = {
  id: string;
  organizationId: string;
  code: string;
  partner: string;
  clientId: string | null;
  deals: number;
  revenuePaise: number;
  commissionPaise: number;
  status: ReferralStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type NewReferral = {
  organizationId: string;
  code: string;
  partner: string;
  clientId: string | null;
  deals: number;
  revenueRupees: number;
  commissionRupees: number;
  status: ReferralStatus;
};

export type ReferralStore = {
  list(organizationId: string, query: ReferralListQuery): Promise<{ items: ReferralRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<ReferralRecord | null>;
  findByCode(organizationId: string, code: string): Promise<ReferralRecord | null>;
  insert(input: NewReferral): Promise<ReferralRecord>;
  update(organizationId: string, id: string, patch: UpdateReferralBody): Promise<ReferralRecord | null>;
};

function asReferral(row: typeof referrals.$inferSelect): ReferralRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    partner: row.partner,
    clientId: row.clientId,
    deals: row.deals,
    revenuePaise: row.revenuePaise,
    commissionPaise: row.commissionPaise,
    status: row.status as ReferralStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function referralWhere(organizationId: string, query: ReferralListQuery): SQL | undefined {
  const filters: SQL[] = [eq(referrals.organizationId, organizationId)];
  if (query.status) filters.push(eq(referrals.status, query.status));
  if (query.clientId) filters.push(eq(referrals.clientId, query.clientId));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${referrals.partner} ilike ${pattern} escape '\\'
      or ${referrals.code} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function referralOrder(query: ReferralListQuery) {
  const column = {
    partner: referrals.partner,
    code: referrals.code,
    deals: referrals.deals,
    revenue: referrals.revenuePaise,
    commission: referrals.commissionPaise,
    status: referrals.status,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(referrals.id) : asc(referrals.id);
  return [primary, tie];
}

export function createDrizzleReferralStore(database: Database): ReferralStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = referralWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(referrals).where(where);
      const rows = await db
        .select()
        .from(referrals)
        .where(where)
        .orderBy(...referralOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asReferral), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(referrals).where(and(eq(referrals.organizationId, organizationId), eq(referrals.id, id))).limit(1);
      return row ? asReferral(row) : null;
    },
    async findByCode(organizationId, code) {
      const [row] = await db.select().from(referrals).where(and(eq(referrals.organizationId, organizationId), eq(referrals.code, code))).limit(1);
      return row ? asReferral(row) : null;
    },
    async insert(input) {
      try {
        const [row] = await db.insert(referrals).values({
          organizationId: input.organizationId,
          code: input.code,
          partner: input.partner,
          clientId: input.clientId,
          deals: input.deals,
          revenuePaise: rupeesToPaise(input.revenueRupees),
          commissionPaise: rupeesToPaise(input.commissionRupees),
          status: input.status,
        }).returning();
        if (!row) throw new Error("Insert did not return a row");
        return asReferral(row);
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch) {
      try {
        const [row] = await db.update(referrals).set({
          ...(patch.code !== undefined ? { code: patch.code } : {}),
          ...(patch.partner !== undefined ? { partner: patch.partner } : {}),
          ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
          ...(patch.deals !== undefined ? { deals: patch.deals } : {}),
          ...(patch.revenue !== undefined ? { revenuePaise: rupeesToPaise(patch.revenue) } : {}),
          ...(patch.commission !== undefined ? { commissionPaise: rupeesToPaise(patch.commission) } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          updatedAt: new Date(),
        }).where(and(eq(referrals.organizationId, organizationId), eq(referrals.id, id))).returning();
        return row ? asReferral(row) : null;
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
