import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { agreements, agreementStatusEvents } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuditRequest } from "../audit/types.js";
import { insertAudit } from "../audit/write.js";
import { containsPattern, rupeesToPaise } from "../crm/constants.js";
import type { AgreementListQuery, UpdateAgreementBody } from "./agreements.schema.js";
import { rethrowConstraint } from "./conflicts.js";
import { isAgreementStatus, isTerminalAgreement, type AgreementStatus } from "./constants.js";
import { agreementStatusStamp, assertAgreementTransition } from "./transitions.js";

export type AgreementRecord = {
  id: string;
  organizationId: string;
  number: string;
  title: string;
  description: string;
  clientId: string;
  opportunityId: string | null;
  proposalId: string | null;
  startDate: string;
  endDate: string;
  valuePaise: number;
  status: AgreementStatus;
  activatedAt: Date | null;
  completedAt: Date | null;
  terminatedAt: Date | null;
  expiredAt: Date | null;
  statusChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AgreementStatusEventRecord = {
  id: string;
  organizationId: string;
  agreementId: string;
  fromStatus: AgreementStatus | null;
  toStatus: AgreementStatus;
  createdAt: Date;
};

export type NewAgreement = {
  organizationId: string;
  number: string;
  title: string;
  description: string;
  clientId: string;
  opportunityId: string | null;
  proposalId: string | null;
  startDate: string;
  endDate: string;
  valueRupees: number;
};

export type AgreementStore = {
  list(organizationId: string, query: AgreementListQuery): Promise<{ items: AgreementRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<AgreementRecord | null>;
  findByNumber(organizationId: string, number: string): Promise<{ id: string } | null>;
  history(organizationId: string, agreementId: string): Promise<AgreementStatusEventRecord[]>;
  insert(input: NewAgreement, audit?: AuditRequest | null): Promise<AgreementRecord>;
  update(organizationId: string, id: string, patch: UpdateAgreementBody, audit?: AuditRequest | null): Promise<AgreementRecord | null>;
  changeStatus(organizationId: string, id: string, status: AgreementStatus, audit?: AuditRequest | null): Promise<AgreementRecord | null>;
};

function asAgreement(row: typeof agreements.$inferSelect): AgreementRecord {
  if (!isAgreementStatus(row.status)) throw new Error("Stored agreement status is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    number: row.number,
    title: row.title,
    description: row.description,
    clientId: row.clientId,
    opportunityId: row.opportunityId,
    proposalId: row.proposalId,
    startDate: row.startDate,
    endDate: row.endDate,
    valuePaise: row.valuePaise,
    status: row.status,
    activatedAt: row.activatedAt,
    completedAt: row.completedAt,
    terminatedAt: row.terminatedAt,
    expiredAt: row.expiredAt,
    statusChangedAt: row.statusChangedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function asStatusEvent(row: typeof agreementStatusEvents.$inferSelect): AgreementStatusEventRecord {
  if (!isAgreementStatus(row.toStatus)) throw new Error("Stored agreement status is invalid");
  if (row.fromStatus !== null && !isAgreementStatus(row.fromStatus)) throw new Error("Stored agreement status is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    agreementId: row.agreementId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    createdAt: row.createdAt,
  };
}

function agreementWhere(organizationId: string, query: AgreementListQuery): SQL | undefined {
  const filters: SQL[] = [eq(agreements.organizationId, organizationId)];
  if (query.status) filters.push(eq(agreements.status, query.status));
  if (query.clientId) filters.push(eq(agreements.clientId, query.clientId));
  if (query.opportunityId) filters.push(eq(agreements.opportunityId, query.opportunityId));
  if (query.proposalId) filters.push(eq(agreements.proposalId, query.proposalId));
  if (query.endFrom) filters.push(gte(agreements.endDate, query.endFrom));
  if (query.endTo) filters.push(lte(agreements.endDate, query.endTo));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${agreements.number} ilike ${pattern} escape '\\'
      or ${agreements.title} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function agreementOrder(query: AgreementListQuery) {
  const column = {
    number: agreements.number,
    title: agreements.title,
    status: agreements.status,
    value: agreements.valuePaise,
    startDate: agreements.startDate,
    endDate: agreements.endDate,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(agreements.id) : asc(agreements.id);
  return [primary, tie];
}

export function createDrizzleAgreementStore(database: Database): AgreementStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = agreementWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(agreements).where(where);
      const rows = await db
        .select()
        .from(agreements)
        .where(where)
        .orderBy(...agreementOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asAgreement), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(agreements).where(and(eq(agreements.organizationId, organizationId), eq(agreements.id, id))).limit(1);
      return row ? asAgreement(row) : null;
    },
    async findByNumber(organizationId, number) {
      const [row] = await db
        .select({ id: agreements.id })
        .from(agreements)
        .where(and(eq(agreements.organizationId, organizationId), eq(agreements.number, number)))
        .limit(1);
      return row ?? null;
    },
    async history(organizationId, agreementId) {
      const rows = await db
        .select()
        .from(agreementStatusEvents)
        .where(and(eq(agreementStatusEvents.organizationId, organizationId), eq(agreementStatusEvents.agreementId, agreementId)))
        .orderBy(asc(agreementStatusEvents.createdAt), asc(agreementStatusEvents.id));
      return rows.map(asStatusEvent);
    },
    async insert(input, audit) {
      const now = new Date();
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx.insert(agreements).values({
            organizationId: input.organizationId,
            number: input.number,
            title: input.title,
            description: input.description,
            clientId: input.clientId,
            opportunityId: input.opportunityId,
            proposalId: input.proposalId,
            startDate: input.startDate,
            endDate: input.endDate,
            valuePaise: rupeesToPaise(input.valueRupees),
            status: "Draft",
            statusChangedAt: now,
          }).returning();
          if (!row) throw new Error("Insert did not return a row");
          await tx.insert(agreementStatusEvents).values({
            organizationId: input.organizationId,
            agreementId: row.id,
            fromStatus: null,
            toStatus: "Draft",
            createdAt: now,
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
          return asAgreement(row);
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch, audit) {
      try {
        return await db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(agreements)
            .where(and(eq(agreements.organizationId, organizationId), eq(agreements.id, id)))
            .for("update")
            .limit(1);
          if (!current || !isAgreementStatus(current.status)) return null;
          if (isTerminalAgreement(current.status)) throw new AppError(409, "CONFLICT", "Closed agreements cannot be edited");
          if (current.status === "Active" && (patch.number !== undefined || patch.clientId !== undefined || patch.opportunityId !== undefined || patch.proposalId !== undefined)) {
            throw new AppError(409, "CONFLICT", "Active agreements can only change title, description, dates, and value");
          }
          const startDate = patch.startDate ?? current.startDate;
          const endDate = patch.endDate ?? current.endDate;
          if (endDate < startDate) {
            throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { endDate: "End date must be on or after the start date" });
          }
          const [row] = await tx.update(agreements).set({
            ...(patch.number !== undefined ? { number: patch.number } : {}),
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
            ...(patch.opportunityId !== undefined ? { opportunityId: patch.opportunityId } : {}),
            ...(patch.proposalId !== undefined ? { proposalId: patch.proposalId } : {}),
            ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
            ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
            ...(patch.value !== undefined ? { valuePaise: rupeesToPaise(patch.value) } : {}),
            updatedAt: new Date(),
          }).where(and(eq(agreements.organizationId, organizationId), eq(agreements.id, id))).returning();
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
          return asAgreement(row);
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async changeStatus(organizationId, id, status, audit) {
      try {
        return await db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(agreements)
            .where(and(eq(agreements.organizationId, organizationId), eq(agreements.id, id)))
            .for("update")
            .limit(1);
          if (!current || !isAgreementStatus(current.status)) return null;
          assertAgreementTransition(current.status, status);
          const now = new Date();
          const [row] = await tx.update(agreements).set({
            status,
            statusChangedAt: now,
            updatedAt: now,
            ...agreementStatusStamp(status, now),
          }).where(and(eq(agreements.organizationId, organizationId), eq(agreements.id, id))).returning();
          if (!row) return null;
          await tx.insert(agreementStatusEvents).values({
            organizationId,
            agreementId: id,
            fromStatus: current.status,
            toStatus: status,
            createdAt: now,
          });
          if (audit) {
            await insertAudit(tx, {
              organizationId,
              actorUserId: audit.draft.actorUserId,
              action: audit.draft.action,
              resourceType: audit.draft.resourceType,
              resourceId: id,
              metadata: { from: current.status, to: status },
            });
          }
          return asAgreement(row);
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
