import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { campaigns } from "../../db/schema/index.js";
import { rupeesToPaise } from "../crm/constants.js";
import { containsPattern, roiToHundredths, type CampaignStatus } from "./constants.js";
import { rethrowConstraint } from "./conflicts.js";
import type { CampaignListQuery, UpdateCampaignBody } from "./campaigns.schema.js";

export type CampaignRecord = {
  id: string;
  organizationId: string;
  name: string;
  channel: string;
  spendPaise: number;
  leads: number;
  roiHundredths: number;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type NewCampaign = {
  organizationId: string;
  name: string;
  channel: string;
  spendRupees: number;
  leads: number;
  roi: number;
  status: CampaignStatus;
};

export type CampaignStore = {
  list(organizationId: string, query: CampaignListQuery): Promise<{ items: CampaignRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<CampaignRecord | null>;
  findByName(organizationId: string, name: string): Promise<CampaignRecord | null>;
  insert(input: NewCampaign): Promise<CampaignRecord>;
  update(organizationId: string, id: string, patch: UpdateCampaignBody): Promise<CampaignRecord | null>;
};

function asCampaign(row: typeof campaigns.$inferSelect): CampaignRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    channel: row.channel,
    spendPaise: row.spendPaise,
    leads: row.leads,
    roiHundredths: row.roiHundredths,
    status: row.status as CampaignStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function campaignWhere(organizationId: string, query: CampaignListQuery): SQL | undefined {
  const filters: SQL[] = [eq(campaigns.organizationId, organizationId)];
  if (query.status) filters.push(eq(campaigns.status, query.status));
  if (query.channel) filters.push(sql`lower(${campaigns.channel}) = ${query.channel.toLowerCase()}`);
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${campaigns.name} ilike ${pattern} escape '\\'
      or ${campaigns.channel} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function campaignOrder(query: CampaignListQuery) {
  const column = {
    name: campaigns.name,
    channel: campaigns.channel,
    spend: campaigns.spendPaise,
    leads: campaigns.leads,
    status: campaigns.status,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(campaigns.id) : asc(campaigns.id);
  return [primary, tie];
}

export function createDrizzleCampaignStore(database: Database): CampaignStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = campaignWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(campaigns).where(where);
      const rows = await db
        .select()
        .from(campaigns)
        .where(where)
        .orderBy(...campaignOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asCampaign), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(campaigns).where(and(eq(campaigns.organizationId, organizationId), eq(campaigns.id, id))).limit(1);
      return row ? asCampaign(row) : null;
    },
    async findByName(organizationId, name) {
      const [row] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.organizationId, organizationId), sql`lower(${campaigns.name}) = ${name.toLowerCase()}`))
        .limit(1);
      return row ? asCampaign(row) : null;
    },
    async insert(input) {
      try {
        const [row] = await db.insert(campaigns).values({
          organizationId: input.organizationId,
          name: input.name,
          channel: input.channel,
          spendPaise: rupeesToPaise(input.spendRupees),
          leads: input.leads,
          roiHundredths: roiToHundredths(input.roi),
          status: input.status,
        }).returning();
        if (!row) throw new Error("Insert did not return a row");
        return asCampaign(row);
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch) {
      try {
        const [row] = await db.update(campaigns).set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.channel !== undefined ? { channel: patch.channel } : {}),
          ...(patch.spend !== undefined ? { spendPaise: rupeesToPaise(patch.spend) } : {}),
          ...(patch.leads !== undefined ? { leads: patch.leads } : {}),
          ...(patch.roi !== undefined ? { roiHundredths: roiToHundredths(patch.roi) } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          updatedAt: new Date(),
        }).where(and(eq(campaigns.organizationId, organizationId), eq(campaigns.id, id))).returning();
        return row ? asCampaign(row) : null;
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
