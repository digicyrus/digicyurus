export type AuditDraft = {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  metadata?: Record<string, unknown>;
};

export type NewAuditEvent = {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
};

export type AuditRequest = {
  organizationId: string;
  draft: AuditDraft;
  persist?: (event: NewAuditEvent) => Promise<void>;
};

export type AuditRecord = {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type AuditListQuery = {
  page: number;
  pageSize: number;
  resourceType?: string;
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
};
