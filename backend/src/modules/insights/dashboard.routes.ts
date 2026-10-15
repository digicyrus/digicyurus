import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { InsightStore } from "./insight.store.js";
import { loadInsight } from "./sections.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createDashboardRouter(dependencies: { authStore: AuthStore; insights: InsightStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/dashboard/summary", session, requirePermission("dashboard:view"), async (req, res, next) => {
    try {
      const data = await loadInsight(dependencies.insights, organizationId(req.auth?.organizationId), {}, req.auth?.permissions ?? [], false);
      res.status(200).json({ data, error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
