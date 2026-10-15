import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import { presentServiceRate } from "./present.js";
import { createServiceRateBody, serviceRateIdParams, serviceRateListQuery, updateServiceRateBody, type CreateServiceRateBody, type ServiceRateListQuery, type UpdateServiceRateBody } from "./service-rates.schema.js";
import type { ServiceRateStore } from "./service-rates.store.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function rejectDuplicateName(store: ServiceRateStore, orgId: string, name: string, exceptId?: string): Promise<void> {
  const existing = await store.findByName(orgId, name);
  if (existing && existing.id !== exceptId) {
    throw new AppError(409, "CONFLICT", "This name is already in use", { name: "Already in use" });
  }
}

export function createServiceRateRouter(dependencies: { authStore: AuthStore; serviceRates: ServiceRateStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/service-rates", session, requirePermission("service_rates:view"), validateQuery(serviceRateListQuery), async (req, res, next) => {
    try {
      const query = readQuery<ServiceRateListQuery>(res);
      const result = await dependencies.serviceRates.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentServiceRate),
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

  router.get("/api/service-rates/:id", session, requirePermission("service_rates:view"), validateParams(serviceRateIdParams), async (req, res, next) => {
    try {
      const rate = await dependencies.serviceRates.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!rate) {
        next(new AppError(404, "NOT_FOUND", "Service rate not found"));
        return;
      }
      res.status(200).json({ data: presentServiceRate(rate), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/service-rates", session, requirePermission("service_rates:update"), validateBody(createServiceRateBody), async (req, res, next) => {
    try {
      const body = req.body as CreateServiceRateBody;
      const orgId = organizationId(req.auth?.organizationId);
      await rejectDuplicateName(dependencies.serviceRates, orgId, body.name);
      const created = await dependencies.serviceRates.insert({
        organizationId: orgId,
        name: body.name,
        description: body.description,
        unit: body.unit,
        rateRupees: body.rate,
        active: body.active,
      });
      res.status(201).json({ data: presentServiceRate(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/service-rates/:id", session, requirePermission("service_rates:update"), validateParams(serviceRateIdParams), validateBody(updateServiceRateBody), async (req, res, next) => {
    try {
      const body = req.body as UpdateServiceRateBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      if (body.name !== undefined) await rejectDuplicateName(dependencies.serviceRates, orgId, body.name, id);
      const updated = await dependencies.serviceRates.update(orgId, id, body);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Service rate not found"));
        return;
      }
      res.status(200).json({ data: presentServiceRate(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
