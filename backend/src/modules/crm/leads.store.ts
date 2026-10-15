import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { insertAudit } from "../audit/write.js";
import type { AuditRequest } from "../audit/types.js";
import { leads } from "../../db/schema/index.js";
import { containsPattern, isLeadPriority, isLeadStage, rupeesToPaise, type LeadPriority, type LeadStage } from "./constants.js";
import { rethrowConstraint } from "./conflicts.js";
import type { LeadListQuery, UpdateLeadBody } from "./leads.schema.js";

export type LeadRecord = {
  id: string;
  organizationId: string;
  clientId: string | null;
  code: string;
  company: string;
  person: string;
  stage: LeadStage;
  valuePaise: number;
  source: string;
  priority: LeadPriority;
  expectedClose: string;
  probability: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewLead = {
  organizationId: string;
  code: string;
  company: string;
  person: string;
  value: number;
  source: string;
  priority: LeadPriority;
  expectedClose: string;
  probability: number;
};

export type LeadStore = {
  list(organizationId: string, query: LeadListQuery): Promise<{ items: LeadRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<LeadRecord | null>;
  findByCode(organizationId: string, code: string): Promise<LeadRecord | null>;
  insert(input: NewLead): Promise<LeadRecord>;
  update(organizationId: string, id: string, patch: UpdateLeadBody): Promise<LeadRecord | null>;
  moveStage(organizationId: string, id: string, stage: LeadStage, audit?: AuditRequest | null): Promise<LeadRecord | null>;
};

function asLead(row: typeof leads.$inferSelect): LeadRecord {
  if (!isLeadStage(row.stage) || !isLeadPriority(row.priority)) throw new Error("Stored lead is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    code: row.code,
    company: row.company,
    person: row.person,
    stage: row.stage,
    valuePaise: row.valuePaise,
    source: row.source,
    priority: row.priority,
    expectedClose: row.expectedClose,
    probability: row.probability,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function leadWhere(organizationId: string, query: LeadListQuery): SQL | undefined {
  const filters: SQL[] = [eq(leads.organizationId, organizationId)];
  if (query.stage) filters.push(eq(leads.stage, query.stage));
  if (query.priority) filters.push(eq(leads.priority, query.priority));
  if (query.source) filters.push(sql`lower(${leads.source}) = ${query.source.toLowerCase()}`);
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${leads.company} ilike ${pattern} escape '\\'
      or ${leads.person} ilike ${pattern} escape '\\'
      or ${leads.code} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function leadOrder(query: LeadListQuery) {
  const column = {
    company: leads.company,
    code: leads.code,
    stage: leads.stage,
    value: leads.valuePaise,
    priority: leads.priority,
    closing: leads.expectedClose,
    probability: leads.probability,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(leads.id) : asc(leads.id);
  return [primary, tie];
}

export function createDrizzleLeadStore(database: Database): LeadStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = leadWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(leads).where(where);
      const rows = await db
        .select()
        .from(leads)
        .where(where)
        .orderBy(...leadOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asLead), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.organizationId, organizationId), eq(leads.id, id)))
        .limit(1);
      return row ? asLead(row) : null;
    },
    async findByCode(organizationId, code) {
      const [row] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.organizationId, organizationId), eq(leads.code, code)))
        .limit(1);
      return row ? asLead(row) : null;
    },
    async insert(input) {
      try {
        const [row] = await db
          .insert(leads)
          .values({
            organizationId: input.organizationId,
            code: input.code,
            company: input.company,
            person: input.person,
            stage: "New",
            valuePaise: rupeesToPaise(input.value),
            source: input.source,
            priority: input.priority,
            expectedClose: input.expectedClose,
            probability: input.probability,
            clientId: null,
          })
          .returning();
        if (!row) throw new Error("Insert did not return a row");
        return asLead(row);
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch) {
      try {
        const [row] = await db
          .update(leads)
          .set({
            ...(patch.code !== undefined ? { code: patch.code } : {}),
            ...(patch.company !== undefined ? { company: patch.company } : {}),
            ...(patch.person !== undefined ? { person: patch.person } : {}),
            ...(patch.value !== undefined ? { valuePaise: rupeesToPaise(patch.value) } : {}),
            ...(patch.source !== undefined ? { source: patch.source } : {}),
            ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
            ...(patch.closing !== undefined ? { expectedClose: patch.closing } : {}),
            ...(patch.probability !== undefined ? { probability: patch.probability } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(leads.organizationId, organizationId), eq(leads.id, id)))
          .returning();
        return row ? asLead(row) : null;
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async moveStage(organizationId, id, stage, audit) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(leads)
          .where(and(eq(leads.organizationId, organizationId), eq(leads.id, id)))
          .limit(1);
        if (!current) return null;
        const [row] = await tx
          .update(leads)
          .set({ stage, updatedAt: new Date() })
          .where(and(eq(leads.organizationId, organizationId), eq(leads.id, id)))
          .returning();
        if (!row) return null;
        if (audit) {
          await insertAudit(tx, {
            organizationId,
            actorUserId: audit.draft.actorUserId,
            action: audit.draft.action,
            resourceType: audit.draft.resourceType,
            resourceId: id,
            metadata: { from: current.stage, to: stage },
          });
        }
        return asLead(row);
      });
    },
  };
}
