import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import type { AuthStore } from "../auth/auth.store.js";
import { presentSummary } from "./present.js";
import type { FinanceSummaryStore } from "./summary.store.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createFinanceSummaryRouter(dependencies: { authStore: AuthStore; summary: FinanceSummaryStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/finance/summary", session, requirePermission("finance:view"), async (req, res, next) => {
    try {
      const summary = await dependencies.summary.summary(organizationId(req.auth?.organizationId));
      res.status(200).json({ data: presentSummary(summary), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
