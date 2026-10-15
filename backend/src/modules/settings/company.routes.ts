import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission, requireSuperAdmin } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import { settingsAudit } from "./audit.js";
import { updateCompanyBody, type UpdateCompanyBody } from "./company.schema.js";
import type { CompanyStore } from "./company.store.js";
import { presentCompany } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createCompanyRouter(dependencies: { authStore: AuthStore; company: CompanyStore; audit?: AuditLogStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/settings/company", session, requirePermission("settings:view"), async (req, res, next) => {
    try {
      const company = await dependencies.company.find(organizationId(req.auth?.organizationId));
      if (!company) {
        next(new AppError(404, "NOT_FOUND", "Company profile not found"));
        return;
      }
      res.status(200).json({ data: presentCompany(company), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/settings/company", session, requirePermission("settings:update"), requireSuperAdmin, validateBody(updateCompanyBody), async (req, res, next) => {
    try {
      const body = req.body as UpdateCompanyBody;
      const orgId = organizationId(req.auth?.organizationId);
      const updated = await dependencies.company.update(orgId, body, settingsAudit(
        dependencies.audit,
        orgId,
        req.auth?.id ?? null,
        "company.update",
        "organization",
        { ...body },
      ));
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Company profile not found"));
        return;
      }
      res.status(200).json({ data: presentCompany(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
