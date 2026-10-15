import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { serviceRates } from "../../db/schema/index.js";
import { rupeesToPaise } from "../crm/constants.js";
import { containsPattern } from "./constants.js";
import { rethrowConstraint } from "./conflicts.js";
import type { ServiceRateListQuery, UpdateServiceRateBody } from "./service-rates.schema.js";

export type ServiceRateRecord = {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  unit: string;
  ratePaise: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NewServiceRate = {
  organizationId: string;
  name: string;
  description: string;
  unit: string;
  rateRupees: number;
  active: boolean;
};

export type ServiceRateStore = {
  list(organizationId: string, query: ServiceRateListQuery): Promise<{ items: ServiceRateRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<ServiceRateRecord | null>;
  findByName(organizationId: string, name: string): Promise<ServiceRateRecord | null>;
  insert(input: NewServiceRate): Promise<ServiceRateRecord>;
  update(organizationId: string, id: string, patch: UpdateServiceRateBody): Promise<ServiceRateRecord | null>;
};

function asServiceRate(row: typeof serviceRates.$inferSelect): ServiceRateRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    unit: row.unit,
    ratePaise: row.ratePaise,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serviceRateWhere(organizationId: string, query: ServiceRateListQuery): SQL | undefined {
  const filters: SQL[] = [eq(serviceRates.organizationId, organizationId)];
  if (query.active) filters.push(eq(serviceRates.active, query.active === "true"));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${serviceRates.name} ilike ${pattern} escape '\\'
      or ${serviceRates.description} ilike ${pattern} escape '\\'
      or ${serviceRates.unit} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function serviceRateOrder(query: ServiceRateListQuery) {
  const column = {
    name: serviceRates.name,
    unit: serviceRates.unit,
    rate: serviceRates.ratePaise,
    active: serviceRates.active,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(serviceRates.id) : asc(serviceRates.id);
  return [primary, tie];
}

export function createDrizzleServiceRateStore(database: Database): ServiceRateStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = serviceRateWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(serviceRates).where(where);
      const rows = await db
        .select()
        .from(serviceRates)
        .where(where)
        .orderBy(...serviceRateOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asServiceRate), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(serviceRates).where(and(eq(serviceRates.organizationId, organizationId), eq(serviceRates.id, id))).limit(1);
      return row ? asServiceRate(row) : null;
    },
    async findByName(organizationId, name) {
      const [row] = await db
        .select()
        .from(serviceRates)
        .where(and(eq(serviceRates.organizationId, organizationId), sql`lower(${serviceRates.name}) = ${name.toLowerCase()}`))
        .limit(1);
      return row ? asServiceRate(row) : null;
    },
    async insert(input) {
      try {
        const [row] = await db.insert(serviceRates).values({
          organizationId: input.organizationId,
          name: input.name,
          description: input.description,
          unit: input.unit,
          ratePaise: rupeesToPaise(input.rateRupees),
          active: input.active,
        }).returning();
        if (!row) throw new Error("Insert did not return a row");
        return asServiceRate(row);
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch) {
      try {
        const [row] = await db.update(serviceRates).set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
          ...(patch.rate !== undefined ? { ratePaise: rupeesToPaise(patch.rate) } : {}),
          ...(patch.active !== undefined ? { active: patch.active } : {}),
          updatedAt: new Date(),
        }).where(and(eq(serviceRates.organizationId, organizationId), eq(serviceRates.id, id))).returning();
        return row ? asServiceRate(row) : null;
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
