import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { assets } from "../../db/schema/index.js";
import type { AuditRequest } from "../audit/types.js";
import { insertAudit } from "../audit/write.js";
import { rupeesToPaise } from "../crm/constants.js";
import { containsPattern, type AssetStatus, type AssetType } from "./constants.js";
import { rethrowConstraint } from "./conflicts.js";
import type { AssetListQuery, UpdateAssetBody } from "./assets.schema.js";

export type AssetRecord = {
  id: string;
  organizationId: string;
  name: string;
  type: AssetType;
  vendor: string;
  renewalOn: string;
  costPaise: number;
  status: AssetStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type NewAsset = {
  organizationId: string;
  name: string;
  type: AssetType;
  vendor: string;
  renewalOn: string;
  costRupees: number;
  status: AssetStatus;
};

export type AssetStore = {
  list(organizationId: string, query: AssetListQuery): Promise<{ items: AssetRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<AssetRecord | null>;
  findByName(organizationId: string, name: string): Promise<AssetRecord | null>;
  insert(input: NewAsset, audit?: AuditRequest | null): Promise<AssetRecord>;
  update(organizationId: string, id: string, patch: UpdateAssetBody, audit?: AuditRequest | null): Promise<AssetRecord | null>;
};

function asAsset(row: typeof assets.$inferSelect): AssetRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    type: row.type as AssetType,
    vendor: row.vendor,
    renewalOn: row.renewalOn,
    costPaise: row.costPaise,
    status: row.status as AssetStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assetWhere(organizationId: string, query: AssetListQuery): SQL | undefined {
  const filters: SQL[] = [eq(assets.organizationId, organizationId)];
  if (query.type) filters.push(eq(assets.type, query.type));
  if (query.status) filters.push(eq(assets.status, query.status));
  if (query.from) filters.push(gte(assets.renewalOn, query.from));
  if (query.to) filters.push(lte(assets.renewalOn, query.to));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${assets.name} ilike ${pattern} escape '\\'
      or ${assets.vendor} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function assetOrder(query: AssetListQuery) {
  const column = {
    name: assets.name,
    type: assets.type,
    vendor: assets.vendor,
    renewal: assets.renewalOn,
    cost: assets.costPaise,
    status: assets.status,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(assets.id) : asc(assets.id);
  return [primary, tie];
}

export function createDrizzleAssetStore(database: Database): AssetStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = assetWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(assets).where(where);
      const rows = await db
        .select()
        .from(assets)
        .where(where)
        .orderBy(...assetOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asAsset), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(assets).where(and(eq(assets.organizationId, organizationId), eq(assets.id, id))).limit(1);
      return row ? asAsset(row) : null;
    },
    async findByName(organizationId, name) {
      const [row] = await db
        .select()
        .from(assets)
        .where(and(eq(assets.organizationId, organizationId), sql`lower(${assets.name}) = ${name.toLowerCase()}`))
        .limit(1);
      return row ? asAsset(row) : null;
    },
    async insert(input, audit) {
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx.insert(assets).values({
            organizationId: input.organizationId,
            name: input.name,
            type: input.type,
            vendor: input.vendor,
            renewalOn: input.renewalOn,
            costPaise: rupeesToPaise(input.costRupees),
            status: input.status,
          }).returning();
          if (!row) throw new Error("Insert did not return a row");
          if (audit) {
            await insertAudit(tx, {
              organizationId: input.organizationId,
              actorUserId: audit.draft.actorUserId,
              action: audit.draft.action,
              resourceType: audit.draft.resourceType,
              resourceId: row.id,
              metadata: audit.draft.metadata ?? {},
            });
          }
          return asAsset(row);
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch, audit) {
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx.update(assets).set({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.type !== undefined ? { type: patch.type } : {}),
            ...(patch.vendor !== undefined ? { vendor: patch.vendor } : {}),
            ...(patch.renewal !== undefined ? { renewalOn: patch.renewal } : {}),
            ...(patch.cost !== undefined ? { costPaise: rupeesToPaise(patch.cost) } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            updatedAt: new Date(),
          }).where(and(eq(assets.organizationId, organizationId), eq(assets.id, id))).returning();
          if (!row) return null;
          if (audit) {
            await insertAudit(tx, {
              organizationId,
              actorUserId: audit.draft.actorUserId,
              action: audit.draft.action,
              resourceType: audit.draft.resourceType,
              resourceId: id,
              metadata: audit.draft.metadata ?? {},
            });
          }
          return asAsset(row);
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
