import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { auditLogs } from "../../db/schema/index.js";
import { redact } from "./redact.js";
import type { AuditListQuery } from "./audit.schema.js";
import type { AuditRecord, NewAuditEvent } from "./types.js";

export type AuditLogStore = {
  append(event: NewAuditEvent): Promise<AuditRecord>;
  list(organizationId: string, query: AuditListQuery): Promise<{ items: AuditRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<AuditRecord | null>;
};

function asAudit(row: typeof auditLogs.$inferSelect): AuditRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    actorUserId: row.actorUserId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    metadata: redact(row.metadata),
    createdAt: row.createdAt,
  };
}

function rangeEnd(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
}

function whereFor(organizationId: string, query: AuditListQuery): SQL | undefined {
  const filters: SQL[] = [eq(auditLogs.organizationId, organizationId)];
  if (query.resourceType) filters.push(eq(auditLogs.resourceType, query.resourceType));
  if (query.actor) filters.push(eq(auditLogs.actorUserId, query.actor));
  if (query.action) filters.push(eq(auditLogs.action, query.action));
  if (query.from) filters.push(gte(auditLogs.createdAt, new Date(`${query.from}T00:00:00.000Z`)));
  if (query.to) filters.push(lt(auditLogs.createdAt, rangeEnd(query.to)));
  return and(...filters);
}

export function createDrizzleAuditStore(database: Database): AuditLogStore {
  const { db } = database;
  return {
    async append(event) {
      const [row] = await db.insert(auditLogs).values({
        organizationId: event.organizationId,
        actorUserId: event.actorUserId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        metadata: redact(event.metadata),
      }).returning();
      if (!row) throw new Error("Insert did not return a row");
      return asAudit(row);
    },
    async list(organizationId, query) {
      const where = whereFor(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(auditLogs).where(where);
      const rows = await db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asAudit), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(auditLogs).where(and(eq(auditLogs.organizationId, organizationId), eq(auditLogs.id, id))).limit(1);
      return row ? asAudit(row) : null;
    },
  };
}
