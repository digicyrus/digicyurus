import type { AuditRecord } from "./types.js";

export function presentAudit(record: AuditRecord) {
  return {
    id: record.id,
    actorUserId: record.actorUserId,
    action: record.action,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
  };
}
