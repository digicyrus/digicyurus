import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import { createPlannerBody, plannerIdParams, plannerListQuery, updatePlannerBody, type CreatePlannerBody, type PlannerListQuery, type UpdatePlannerBody } from "./planner.schema.js";
import type { PlannerStore } from "./planner.store.js";
import { presentPlannerEntry } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

function userId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createPlannerRouter(dependencies: { authStore: AuthStore; planner: PlannerStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/planner", session, requirePermission("planner:view"), validateQuery(plannerListQuery), async (req, res, next) => {
    try {
      const query = readQuery<PlannerListQuery>(res);
      const items = await dependencies.planner.list(organizationId(req.auth?.organizationId), userId(req.auth?.id), query);
      res.status(200).json({
        data: {
          items: items.map(presentPlannerEntry),
          from: query.from,
          to: query.to,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/planner", session, requirePermission("planner:update"), validateBody(createPlannerBody), async (req, res, next) => {
    try {
      const body = req.body as CreatePlannerBody;
      const created = await dependencies.planner.insert({
        organizationId: organizationId(req.auth?.organizationId),
        userId: userId(req.auth?.id),
        title: body.title,
        entryDate: body.entryDate,
        timeOfDay: body.time ?? null,
        done: body.done,
        tag: body.tag ?? null,
      });
      res.status(201).json({ data: presentPlannerEntry(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/planner/:id", session, requirePermission("planner:update"), validateParams(plannerIdParams), validateBody(updatePlannerBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const ownerId = userId(req.auth?.id);
      const updated = await dependencies.planner.update(orgId, ownerId, readParams<{ id: string }>(res).id, req.body as UpdatePlannerBody);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Planner entry not found"));
        return;
      }
      res.status(200).json({ data: presentPlannerEntry(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
