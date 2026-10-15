import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import { auditIdParams, auditListQuery, type AuditListQuery } from "./audit.schema.js";
import type { AuditLogStore } from "./audit.store.js";
import { presentAudit } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createAuditRouter(dependencies: { authStore: AuthStore; audit: AuditLogStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);
  const view = requirePermission("audit_logs:view");

  router.get("/api/audit-logs", session, view, validateQuery(auditListQuery), async (req, res, next) => {
    try {
      const query = readQuery<AuditListQuery>(res);
      const result = await dependencies.audit.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentAudit),
          page: query.page,
          pageSize: query.pageSize,
          total: result.total,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/audit-logs/:id", session, view, validateParams(auditIdParams), async (req, res, next) => {
    try {
      const record = await dependencies.audit.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!record) {
        next(new AppError(404, "NOT_FOUND", "Audit log not found"));
        return;
      }
      res.status(200).json({ data: presentAudit(record), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
