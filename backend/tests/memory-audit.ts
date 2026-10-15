import { randomUUID } from "node:crypto";

import type { AuditListQuery } from "../src/modules/audit/audit.schema.js";
import type { AuditLogStore } from "../src/modules/audit/audit.store.js";
import { redact } from "../src/modules/audit/redact.js";
import type { AuditRecord, NewAuditEvent } from "../src/modules/audit/types.js";

function inRange(value: Date, from?: string, to?: string): boolean {
  if (from && value < new Date(`${from}T00:00:00.000Z`)) return false;
  if (to) {
    const [year, month, day] = to.split("-").map(Number);
    const end = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
    if (value >= end) return false;
  }
  return true;
}

export function createMemoryAuditStore(): AuditLogStore & { records: AuditRecord[]; failNext: boolean } {
  const records: AuditRecord[] = [];
  const store = {
    records,
    failNext: false,
    async append(event: NewAuditEvent) {
      if (store.failNext) {
        store.failNext = false;
        throw new Error("audit unavailable");
      }
      const record: AuditRecord = {
        id: randomUUID(),
        organizationId: event.organizationId,
        actorUserId: event.actorUserId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        metadata: redact(event.metadata),
        createdAt: new Date(),
      };
      records.push(record);
      return record;
    },
    async list(organizationId: string, query: AuditListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.resourceType ? record.resourceType === query.resourceType : true))
        .filter((record) => (query.actor ? record.actorUserId === query.actor : true))
        .filter((record) => (query.action ? record.action === query.action : true))
        .filter((record) => inRange(record.createdAt, query.from, query.to))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
      return {
        items: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: filtered.length,
      };
    },
    async find(organizationId: string, id: string) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
  };
  return store;
}
