import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readQuery, validateBody, validateQuery } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import { salesAudit } from "./audit.js";
import { forecastQuery, replaceProbabilitiesBody, type ForecastQuery, type ReplaceProbabilitiesBody } from "./forecast.schema.js";
import type { ForecastStore } from "./forecast.store.js";
import { buildForecast } from "./metrics.js";
import type { OpportunityStore } from "./opportunities.store.js";
import { presentForecast, presentProbabilities } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createForecastRouter(dependencies: {
  authStore: AuthStore;
  opportunities: OpportunityStore;
  forecast: ForecastStore;
  audit?: AuditLogStore;
}): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/sales/forecast", session, requirePermission("forecast:view"), validateQuery(forecastQuery), async (req, res, next) => {
    try {
      const query = readQuery<ForecastQuery>(res);
      const orgId = organizationId(req.auth?.organizationId);
      const [sources, probabilities] = await Promise.all([
        dependencies.opportunities.forecastSources(orgId),
        dependencies.forecast.listProbabilities(orgId),
      ]);
      const metrics = buildForecast(sources, probabilities, query);
      res.status(200).json({ data: presentForecast(metrics, query), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/sales/stage-probabilities", session, requirePermission("pipeline:view"), async (req, res, next) => {
    try {
      const stages = await dependencies.forecast.listProbabilities(organizationId(req.auth?.organizationId));
      res.status(200).json({ data: presentProbabilities(stages), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/sales/stage-probabilities", session, requirePermission("pipeline:update"), validateBody(replaceProbabilitiesBody), async (req, res, next) => {
    try {
      const body = req.body as ReplaceProbabilitiesBody;
      const seen = new Set<string>();
      for (const stage of body.stages) {
        if (seen.has(stage.stage)) {
          throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { stage: "Stage is listed more than once" });
        }
        seen.add(stage.stage);
      }
      const orgId = organizationId(req.auth?.organizationId);
      const saved = await dependencies.forecast.replaceProbabilities(orgId, body.stages, salesAudit(
        dependencies.audit,
        orgId,
        req.auth?.id ?? null,
        "forecast.probabilities",
        "stage_probability",
        { stages: body.stages },
      ));
      res.status(200).json({ data: presentProbabilities(saved), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
