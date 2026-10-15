import { and, asc, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { employees, followUps } from "../../db/schema/index.js";
import { isFollowUpStatus, type FollowUpStatus } from "./constants.js";
import type { FollowUpListQuery, UpdateFollowUpBody } from "./follow-ups.schema.js";

export type FollowUpRecord = {
  id: string;
  organizationId: string;
  clientId: string | null;
  leadId: string | null;
  ownerEmployeeId: string;
  dueAt: Date;
  status: FollowUpStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type NewFollowUp = Omit<FollowUpRecord, "id" | "createdAt" | "updatedAt">;

export type FollowUpStore = {
  list(organizationId: string, query: FollowUpListQuery): Promise<{ items: FollowUpRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<FollowUpRecord | null>;
  findEmployee(organizationId: string, id: string): Promise<{ id: string } | null>;
  insert(input: NewFollowUp): Promise<FollowUpRecord>;
  update(organizationId: string, id: string, patch: UpdateFollowUpBody): Promise<FollowUpRecord | null>;
};

function asFollowUp(row: typeof followUps.$inferSelect): FollowUpRecord {
  if (!isFollowUpStatus(row.status)) throw new Error("Stored follow-up status is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    leadId: row.leadId,
    ownerEmployeeId: row.ownerEmployeeId,
    dueAt: row.dueAt,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function followUpWhere(organizationId: string, query: FollowUpListQuery): SQL | undefined {
  const filters: SQL[] = [eq(followUps.organizationId, organizationId)];
  if (query.clientId) filters.push(eq(followUps.clientId, query.clientId));
  if (query.leadId) filters.push(eq(followUps.leadId, query.leadId));
  if (query.status) filters.push(eq(followUps.status, query.status));
  return and(...filters);
}

export function createDrizzleFollowUpStore(database: Database): FollowUpStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = followUpWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(followUps).where(where);
      const rows = await db
        .select()
        .from(followUps)
        .where(where)
        .orderBy(asc(followUps.dueAt), asc(followUps.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asFollowUp), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db
        .select()
        .from(followUps)
        .where(and(eq(followUps.organizationId, organizationId), eq(followUps.id, id)))
        .limit(1);
      return row ? asFollowUp(row) : null;
    },
    async findEmployee(organizationId, id) {
      const [row] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.organizationId, organizationId), eq(employees.id, id)))
        .limit(1);
      return row ?? null;
    },
    async insert(input) {
      const [row] = await db.insert(followUps).values(input).returning();
      if (!row) throw new Error("Insert did not return a row");
      return asFollowUp(row);
    },
    async update(organizationId, id, patch) {
      const [row] = await db
        .update(followUps)
        .set({
          ...(patch.clientId !== undefined ? { clientId: patch.clientId ?? null } : {}),
          ...(patch.leadId !== undefined ? { leadId: patch.leadId ?? null } : {}),
          ...(patch.ownerEmployeeId !== undefined ? { ownerEmployeeId: patch.ownerEmployeeId } : {}),
          ...(patch.dueAt !== undefined ? { dueAt: new Date(patch.dueAt) } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(followUps.organizationId, organizationId), eq(followUps.id, id)))
        .returning();
      return row ? asFollowUp(row) : null;
    },
  };
}
