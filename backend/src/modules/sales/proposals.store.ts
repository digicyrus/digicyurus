import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { proposalLines, proposals, proposalStatusEvents } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import type { AuditRequest } from "../audit/types.js";
import { insertAudit } from "../audit/write.js";
import { containsPattern } from "../crm/constants.js";
import { rethrowConstraint } from "./conflicts.js";
import { isProposalStatus, type ProposalStatus } from "./constants.js";
import { calculateProposal, type CalculatedProposalLine, type ProposalLineInput } from "./money.js";
import type { ProposalListQuery, UpdateProposalBody } from "./proposals.schema.js";
import { assertProposalTransition, proposalStatusStamp } from "./transitions.js";

export type ProposalLineRecord = {
  id: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  discountPaise: number;
  amountPaise: number;
};

export type ProposalRecord = {
  id: string;
  organizationId: string;
  number: string;
  title: string;
  clientId: string;
  opportunityId: string | null;
  status: ProposalStatus;
  validityDate: string;
  notes: string;
  rateBps: number;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  lines: ProposalLineRecord[];
  sentAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  expiredAt: Date | null;
  statusChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ProposalStatusEventRecord = {
  id: string;
  organizationId: string;
  proposalId: string;
  fromStatus: ProposalStatus | null;
  toStatus: ProposalStatus;
  createdAt: Date;
};

export type NewProposal = {
  organizationId: string;
  number: string;
  title: string;
  clientId: string;
  opportunityId: string | null;
  validityDate: string;
  notes: string;
  rateBps: number;
  lines: ProposalLineInput[];
};

export type ProposalStore = {
  list(organizationId: string, query: ProposalListQuery): Promise<{ items: ProposalRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<ProposalRecord | null>;
  findByNumber(organizationId: string, number: string): Promise<{ id: string } | null>;
  history(organizationId: string, proposalId: string): Promise<ProposalStatusEventRecord[]>;
  insert(input: NewProposal, audit?: AuditRequest | null): Promise<ProposalRecord>;
  update(organizationId: string, id: string, patch: UpdateProposalBody, audit?: AuditRequest | null): Promise<ProposalRecord | null>;
  changeStatus(organizationId: string, id: string, status: ProposalStatus, audit?: AuditRequest | null): Promise<ProposalRecord | null>;
};

function asLine(row: typeof proposalLines.$inferSelect): ProposalLineRecord {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitPricePaise: row.unitPricePaise,
    discountPaise: row.discountPaise,
    amountPaise: row.amountPaise,
  };
}

function asProposal(row: typeof proposals.$inferSelect, lines: ProposalLineRecord[]): ProposalRecord {
  if (!isProposalStatus(row.status)) throw new Error("Stored proposal status is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    number: row.number,
    title: row.title,
    clientId: row.clientId,
    opportunityId: row.opportunityId,
    status: row.status,
    validityDate: row.validityDate,
    notes: row.notes,
    rateBps: row.rateBps,
    subtotalPaise: row.subtotalPaise,
    discountPaise: row.discountPaise,
    taxPaise: row.taxPaise,
    totalPaise: row.totalPaise,
    lines,
    sentAt: row.sentAt,
    acceptedAt: row.acceptedAt,
    rejectedAt: row.rejectedAt,
    expiredAt: row.expiredAt,
    statusChangedAt: row.statusChangedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function asStatusEvent(row: typeof proposalStatusEvents.$inferSelect): ProposalStatusEventRecord {
  if (!isProposalStatus(row.toStatus)) throw new Error("Stored proposal status is invalid");
  if (row.fromStatus !== null && !isProposalStatus(row.fromStatus)) throw new Error("Stored proposal status is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    proposalId: row.proposalId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    createdAt: row.createdAt,
  };
}

function proposalWhere(organizationId: string, query: ProposalListQuery): SQL | undefined {
  const filters: SQL[] = [eq(proposals.organizationId, organizationId)];
  if (query.status) filters.push(eq(proposals.status, query.status));
  if (query.clientId) filters.push(eq(proposals.clientId, query.clientId));
  if (query.opportunityId) filters.push(eq(proposals.opportunityId, query.opportunityId));
  if (query.validityFrom) filters.push(gte(proposals.validityDate, query.validityFrom));
  if (query.validityTo) filters.push(lte(proposals.validityDate, query.validityTo));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${proposals.number} ilike ${pattern} escape '\\'
      or ${proposals.title} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function proposalOrder(query: ProposalListQuery) {
  const column = {
    number: proposals.number,
    title: proposals.title,
    status: proposals.status,
    total: proposals.totalPaise,
    validity: proposals.validityDate,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(proposals.id) : asc(proposals.id);
  return [primary, tie];
}

type Writer = Pick<Database["db"], "select" | "insert" | "delete">;

async function linesFor(db: Writer, proposalId: string): Promise<ProposalLineRecord[]> {
  const rows = await db.select().from(proposalLines).where(eq(proposalLines.proposalId, proposalId)).orderBy(asc(proposalLines.position));
  return rows.map(asLine);
}

async function replaceLines(db: Writer, proposalId: string, lines: CalculatedProposalLine[]): Promise<void> {
  await db.delete(proposalLines).where(eq(proposalLines.proposalId, proposalId));
  if (lines.length === 0) return;
  await db.insert(proposalLines).values(lines.map((line, position) => ({
    proposalId,
    position,
    description: line.description,
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    discountPaise: line.discountPaise,
    amountPaise: line.amountPaise,
  })));
}

function lineInputs(lines: ProposalLineRecord[]): ProposalLineInput[] {
  return lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPriceRupees: Math.trunc(line.unitPricePaise / 100),
    discountRupees: Math.trunc(line.discountPaise / 100),
  }));
}

export function createDrizzleProposalStore(database: Database): ProposalStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = proposalWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(proposals).where(where);
      const rows = await db
        .select()
        .from(proposals)
        .where(where)
        .orderBy(...proposalOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map((row) => asProposal(row, [])), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(proposals).where(and(eq(proposals.organizationId, organizationId), eq(proposals.id, id))).limit(1);
      if (!row) return null;
      return asProposal(row, await linesFor(db, id));
    },
    async findByNumber(organizationId, number) {
      const [row] = await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(and(eq(proposals.organizationId, organizationId), eq(proposals.number, number)))
        .limit(1);
      return row ?? null;
    },
    async history(organizationId, proposalId) {
      const rows = await db
        .select()
        .from(proposalStatusEvents)
        .where(and(eq(proposalStatusEvents.organizationId, organizationId), eq(proposalStatusEvents.proposalId, proposalId)))
        .orderBy(asc(proposalStatusEvents.createdAt), asc(proposalStatusEvents.id));
      return rows.map(asStatusEvent);
    },
    async insert(input, audit) {
      const totals = calculateProposal(input);
      const now = new Date();
      try {
        return await db.transaction(async (tx) => {
          const [row] = await tx.insert(proposals).values({
            organizationId: input.organizationId,
            number: input.number,
            title: input.title,
            clientId: input.clientId,
            opportunityId: input.opportunityId,
            status: "Draft",
            validityDate: input.validityDate,
            notes: input.notes,
            rateBps: input.rateBps,
            subtotalPaise: totals.subtotalPaise,
            discountPaise: totals.discountPaise,
            taxPaise: totals.taxPaise,
            totalPaise: totals.totalPaise,
            statusChangedAt: now,
          }).returning();
          if (!row) throw new Error("Insert did not return a row");
          await replaceLines(tx, row.id, totals.lines);
          await tx.insert(proposalStatusEvents).values({
            organizationId: input.organizationId,
            proposalId: row.id,
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
          return asProposal(row, await linesFor(tx, row.id));
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
            .from(proposals)
            .where(and(eq(proposals.organizationId, organizationId), eq(proposals.id, id)))
            .for("update")
            .limit(1);
          if (!current) return null;
          if (current.status !== "Draft") throw new AppError(409, "CONFLICT", "Only draft proposals can be edited");
          const existingLines = await linesFor(tx, id);
          const pricingChanged = patch.lines !== undefined || patch.rateBps !== undefined;
          const totals = pricingChanged
            ? calculateProposal({
              rateBps: patch.rateBps ?? current.rateBps,
              lines: patch.lines
                ? patch.lines.map((line) => ({
                  description: line.description,
                  quantity: line.quantity,
                  unitPriceRupees: line.unitPrice,
                  discountRupees: line.discount,
                }))
                : lineInputs(existingLines),
            })
            : null;
          const [row] = await tx.update(proposals).set({
            ...(patch.number !== undefined ? { number: patch.number } : {}),
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
            ...(patch.opportunityId !== undefined ? { opportunityId: patch.opportunityId } : {}),
            ...(patch.validityDate !== undefined ? { validityDate: patch.validityDate } : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
            ...(patch.rateBps !== undefined ? { rateBps: patch.rateBps } : {}),
            ...(totals ? {
              subtotalPaise: totals.subtotalPaise,
              discountPaise: totals.discountPaise,
              taxPaise: totals.taxPaise,
              totalPaise: totals.totalPaise,
            } : {}),
            updatedAt: new Date(),
          }).where(and(eq(proposals.organizationId, organizationId), eq(proposals.id, id), eq(proposals.status, "Draft"))).returning();
          if (!row) return null;
          if (patch.lines !== undefined && totals) await replaceLines(tx, id, totals.lines);
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
          return asProposal(row, await linesFor(tx, id));
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
            .from(proposals)
            .where(and(eq(proposals.organizationId, organizationId), eq(proposals.id, id)))
            .for("update")
            .limit(1);
          if (!current || !isProposalStatus(current.status)) return null;
          assertProposalTransition(current.status, status);
          const now = new Date();
          const [row] = await tx.update(proposals).set({
            status,
            statusChangedAt: now,
            updatedAt: now,
            ...proposalStatusStamp(status, now),
          }).where(and(eq(proposals.organizationId, organizationId), eq(proposals.id, id))).returning();
          if (!row) return null;
          await tx.insert(proposalStatusEvents).values({
            organizationId,
            proposalId: id,
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
          return asProposal(row, await linesFor(tx, id));
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
