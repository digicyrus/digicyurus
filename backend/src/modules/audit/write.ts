import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "../../db/schema/index.js";
import { auditLogs } from "../../db/schema/index.js";
import { redact } from "./redact.js";
import type { NewAuditEvent } from "./types.js";

type Executor = PostgresJsDatabase<typeof schema> | Parameters<Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]>[0];

export async function insertAudit(tx: Executor, event: NewAuditEvent): Promise<void> {
  await tx.insert(auditLogs).values({
    organizationId: event.organizationId,
    actorUserId: event.actorUserId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    metadata: redact(event.metadata),
  });
}

export function auditEvent(input: {
  organizationId: string;
  draft: { actorUserId: string | null; action: string; resourceType: string; metadata?: Record<string, unknown> };
  resourceId: string | null;
  metadata?: Record<string, unknown>;
}): NewAuditEvent {
  return {
    organizationId: input.organizationId,
    actorUserId: input.draft.actorUserId,
    action: input.draft.action,
    resourceType: input.draft.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata ?? input.draft.metadata ?? {},
  };
}
