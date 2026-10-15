import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { opportunities, opportunityStageEvents } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuditRequest } from "../audit/types.js";
import { insertAudit } from "../audit/write.js";
import { containsPattern, rupeesToPaise } from "../crm/constants.js";
import { rethrowConstraint } from "./conflicts.js";
import { isOpportunityStage, isSalesPriority, type OpportunityStage, type SalesPriority } from "./constants.js";
import { summarizeStages, type ForecastSource, type StageSummary } from "./metrics.js";
import type { OpportunityListQuery, UpdateOpportunityBody } from "./opportunities.schema.js";
import { resolveOpportunityClose } from "./transitions.js";

export type OpportunityRecord = {
  id: string;
  organizationId: string;
  reference: string;
  title: string;
  clientId: string | null;
  leadId: string | null;
  ownerEmployeeId: string | null;
  valuePaise: number;
  expectedClose: string;
  source: string;
  priority: SalesPriority;
  notes: string;
  stage: OpportunityStage;
  lostReason: string | null;
  closedOn: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StageEventRecord = {
  id: string;
  organizationId: string;
  opportunityId: string;
  fromStage: OpportunityStage | null;
  toStage: OpportunityStage;
  lostReason: string | null;
  closedOn: string | null;
  createdAt: Date;
};

export type NewOpportunity = {
  organizationId: string;
  reference: string;
  title: string;
  clientId: string | null;
  leadId: string | null;
  ownerEmployeeId: string | null;
  valueRupees: number;
  expectedClose: string;
  source: string;
  priority: SalesPriority;
  notes: string;
  stage: OpportunityStage;
  lostReason: string | null;
  closedOn: string | null;
  today: string;
};

export type StageChange = {
  stage: OpportunityStage;
  lostReason?: string | null;
  closedOn?: string | null;
  today: string;
};

export type OpportunityStore = {
  list(organizationId: string, query: OpportunityListQuery): Promise<{ items: OpportunityRecord[]; total: number }>;
  summary(organizationId: string): Promise<StageSummary[]>;
  find(organizationId: string, id: string): Promise<OpportunityRecord | null>;
  findByReference(organizationId: string, reference: string): Promise<{ id: string } | null>;
  history(organizationId: string, opportunityId: string): Promise<StageEventRecord[]>;
  forecastSources(organizationId: string): Promise<ForecastSource[]>;
  insert(input: NewOpportunity, audit?: AuditRequest | null): Promise<OpportunityRecord>;
  update(organizationId: string, id: string, patch: UpdateOpportunityBody, audit?: AuditRequest | null): Promise<OpportunityRecord | null>;
  changeStage(organizationId: string, id: string, input: StageChange, audit?: AuditRequest | null): Promise<OpportunityRecord | null>;
};

function asOpportunity(row: typeof opportunities.$inferSelect): OpportunityRecord {
  if (!isOpportunityStage(row.stage) || !isSalesPriority(row.priority)) throw new Error("Stored opportunity is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    reference: row.reference,
    title: row.title,
    clientId: row.clientId,
    leadId: row.leadId,
    ownerEmployeeId: row.ownerEmployeeId,
    valuePaise: row.valuePaise,
    expectedClose: row.expectedClose,
    source: row.source,
    priority: row.priority,
    notes: row.notes,
    stage: row.stage,
    lostReason: row.lostReason,
    closedOn: row.closedOn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function asStageEvent(row: typeof opportunityStageEvents.$inferSelect): StageEventRecord {
  if (!isOpportunityStage(row.toStage)) throw new Error("Stored opportunity stage is invalid");
  if (row.fromStage !== null && !isOpportunityStage(row.fromStage)) throw new Error("Stored opportunity stage is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    opportunityId: row.opportunityId,
    fromStage: row.fromStage === null ? null : row.fromStage,
    toStage: row.toStage,
    lostReason: row.lostReason,
    closedOn: row.closedOn,
    createdAt: row.createdAt,
  };
}

function opportunityWhere(organizationId: string, query: OpportunityListQuery): SQL | undefined {
  const filters: SQL[] = [eq(opportunities.organizationId, organizationId)];
  if (query.stage) filters.push(eq(opportunities.stage, query.stage));
  if (query.priority) filters.push(eq(opportunities.priority, query.priority));
  if (query.source) filters.push(sql`lower(${opportunities.source}) = ${query.source.toLowerCase()}`);
  if (query.clientId) filters.push(eq(opportunities.clientId, query.clientId));
  if (query.leadId) filters.push(eq(opportunities.leadId, query.leadId));
  if (query.ownerEmployeeId) filters.push(eq(opportunities.ownerEmployeeId, query.ownerEmployeeId));
  if (query.expectedFrom) filters.push(gte(opportunities.expectedClose, query.expectedFrom));
  if (query.expectedTo) filters.push(lte(opportunities.expectedClose, query.expectedTo));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${opportunities.reference} ilike ${pattern} escape '\\'
      or ${opportunities.title} ilike ${pattern} escape '\\'
      or ${opportunities.source} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function opportunityOrder(query: OpportunityListQuery) {
  const column = {
    reference: opportunities.reference,
    title: opportunities.title,
    stage: opportunities.stage,
    value: opportunities.valuePaise,
    priority: opportunities.priority,
    expectedClose: opportunities.expectedClose,
    source: opportunities.source,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(opportunities.id) : asc(opportunities.id);
  return [primary, tie];
}

type Writer = Pick<Database["db"], "insert">;

async function addStageEvent(db: Writer, input: {
  organizationId: string;
  opportunityId: string;
  fromStage: OpportunityStage | null;
  toStage: OpportunityStage;
  lostReason: string | null;
  closedOn: string | null;
}): Promise<void> {
  await db.insert(opportunityStageEvents).values(input);
}

export function createDrizzleOpportunityStore(database: Database): OpportunityStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = opportunityWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(opportunities).where(where);
      const rows = await db
        .select()
        .from(opportunities)
        .where(where)
        .orderBy(...opportunityOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asOpportunity), total: Number(counted?.value ?? 0) };
    },
    async summary(organizationId) {
      const rows = await db
        .select({ stage: opportunities.stage, valuePaise: opportunities.valuePaise })
        .from(opportunities)
        .where(eq(opportunities.organizationId, organizationId));
      return summarizeStages(rows.map((row) => {
        if (!isOpportunityStage(row.stage)) throw new Error("Stored opportunity stage is invalid");
        return { stage: row.stage, valuePaise: row.valuePaise };
      }));
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(opportunities).where(and(eq(opportunities.organizationId, organizationId), eq(opportunities.id, id))).limit(1);
      return row ? asOpportunity(row) : null;
    },
    async findByReference(organizationId, reference) {
      const [row] = await db
        .select({ id: opportunities.id })
        .from(opportunities)
        .where(and(eq(opportunities.organizationId, organizationId), eq(opportunities.reference, reference)))
        .limit(1);
      return row ?? null;
    },
    async history(organizationId, opportunityId) {
      const rows = await db
        .select()
        .from(opportunityStageEvents)
        .where(and(eq(opportunityStageEvents.organizationId, organizationId), eq(opportunityStageEvents.opportunityId, opportunityId)))
        .orderBy(asc(opportunityStageEvents.createdAt), asc(opportunityStageEvents.id));
      return rows.map(asStageEvent);
    },
    async forecastSources(organizationId) {
      const rows = await db
        .select({
          stage: opportunities.stage,
          ownerEmployeeId: opportunities.ownerEmployeeId,
          valuePaise: opportunities.valuePaise,
          expectedClose: opportunities.expectedClose,
          closedOn: opportunities.closedOn,
        })
        .from(opportunities)
        .where(eq(opportunities.organizationId, organizationId));
      return rows.map((row) => {
        if (!isOpportunityStage(row.stage)) throw new Error("Stored opportunity stage is invalid");
        return {
          stage: row.stage,
          ownerEmployeeId: row.ownerEmployeeId,
          valuePaise: row.valuePaise,
          expectedClose: row.expectedClose,
          closedOn: row.closedOn,
        };
      });
    },
    async insert(input, audit) {
      const close = resolveOpportunityClose(input);
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx.insert(opportunities).values({
            organizationId: input.organizationId,
            reference: input.reference,
            title: input.title,
            clientId: input.clientId,
            leadId: input.leadId,
            ownerEmployeeId: input.ownerEmployeeId,
            valuePaise: rupeesToPaise(input.valueRupees),
            expectedClose: input.expectedClose,
            source: input.source,
            priority: input.priority,
            notes: input.notes,
            stage: close.stage,
            lostReason: close.lostReason,
            closedOn: close.closedOn,
          }).returning();
          if (!row) throw new Error("Insert did not return a row");
          await addStageEvent(tx, {
            organizationId: input.organizationId,
            opportunityId: row.id,
            fromStage: null,
            toStage: close.stage,
            lostReason: close.lostReason,
            closedOn: close.closedOn,
          });
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
          return asOpportunity(row);
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch, audit) {
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx.update(opportunities).set({
            ...(patch.reference !== undefined ? { reference: patch.reference } : {}),
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
            ...(patch.leadId !== undefined ? { leadId: patch.leadId } : {}),
            ...(patch.ownerEmployeeId !== undefined ? { ownerEmployeeId: patch.ownerEmployeeId } : {}),
            ...(patch.value !== undefined ? { valuePaise: rupeesToPaise(patch.value) } : {}),
            ...(patch.expectedClose !== undefined ? { expectedClose: patch.expectedClose } : {}),
            ...(patch.source !== undefined ? { source: patch.source } : {}),
            ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
            updatedAt: new Date(),
          }).where(and(eq(opportunities.organizationId, organizationId), eq(opportunities.id, id))).returning();
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
          return asOpportunity(row);
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async changeStage(organizationId, id, input, audit) {
      try {
        return await db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(opportunities)
            .where(and(eq(opportunities.organizationId, organizationId), eq(opportunities.id, id)))
            .for("update")
            .limit(1);
          if (!current || !isOpportunityStage(current.stage)) return null;
          if (current.stage === input.stage) throw new AppError(409, "CONFLICT", "Opportunity is already in this stage");
          const close = resolveOpportunityClose(input);
          const [row] = await tx.update(opportunities).set({
            stage: close.stage,
            lostReason: close.lostReason,
            closedOn: close.closedOn,
            updatedAt: new Date(),
          }).where(and(eq(opportunities.organizationId, organizationId), eq(opportunities.id, id))).returning();
          if (!row) return null;
          await addStageEvent(tx, {
            organizationId,
            opportunityId: id,
            fromStage: current.stage,
            toStage: close.stage,
            lostReason: close.lostReason,
            closedOn: close.closedOn,
          });
          if (audit) {
            await insertAudit(tx, {
              organizationId,
              actorUserId: audit.draft.actorUserId,
              action: audit.draft.action,
              resourceType: audit.draft.resourceType,
              resourceId: id,
              metadata: { from: current.stage, to: close.stage, lostReason: close.lostReason, closedOn: close.closedOn },
            });
          }
          return asOpportunity(row);
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
