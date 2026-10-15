import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission, requireSuperAdmin } from "../../middleware/authorize.js";
import { readParams, validateBody, validateParams } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import { settingsAudit } from "./audit.js";
import { presentRole } from "./present.js";
import { replaceRolePermissionsBody, roleIdParams, type ReplaceRolePermissionsBody } from "./roles.schema.js";
import type { RoleStore } from "./roles.store.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createRoleSettingsRouter(dependencies: { authStore: AuthStore; roles: RoleStore; audit?: AuditLogStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/settings/roles", session, requirePermission("roles:view"), async (req, res, next) => {
    try {
      organizationId(req.auth?.organizationId);
      const roles = await dependencies.roles.list();
      res.status(200).json({ data: { roles: roles.map(presentRole) }, error: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/settings/roles/:id", session, requirePermission("roles:view"), validateParams(roleIdParams), async (req, res, next) => {
    try {
      organizationId(req.auth?.organizationId);
      const role = await dependencies.roles.find(readParams<{ id: string }>(res).id);
      if (!role) {
        next(new AppError(404, "NOT_FOUND", "Role not found"));
        return;
      }
      res.status(200).json({ data: presentRole(role), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/api/settings/roles/:id/permissions",
    session,
    requirePermission("roles:update"),
    requireSuperAdmin,
    validateParams(roleIdParams),
    validateBody(replaceRolePermissionsBody),
    async (req, res, next) => {
      try {
        const orgId = organizationId(req.auth?.organizationId);
        const body = req.body as ReplaceRolePermissionsBody;
        const updated = await dependencies.roles.replacePermissions(
          orgId,
          readParams<{ id: string }>(res).id,
          req.auth?.roleKey ?? "",
          body.permissions,
          settingsAudit(dependencies.audit, orgId, req.auth?.id ?? null, "role.permissions", "role", {}),
        );
        if (!updated) {
          next(new AppError(404, "NOT_FOUND", "Role not found"));
          return;
        }
        res.status(200).json({ data: presentRole(updated), error: null });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
