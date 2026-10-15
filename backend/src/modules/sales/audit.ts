import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuditRequest } from "../audit/types.js";

export function definedMetadata(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function salesAudit(
  audit: AuditLogStore | undefined,
  organizationId: string,
  actorUserId: string | null,
  action: string,
  resourceType: string,
  metadata: Record<string, unknown>,
): AuditRequest | null {
  if (!audit) return null;
  return {
    organizationId,
    draft: { actorUserId, action, resourceType, metadata },
    persist: (event) => audit.append(event).then(() => undefined),
  };
}
