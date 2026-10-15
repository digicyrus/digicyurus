import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validateBody, validateParams, validateQuery, readParams, readQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { ClientStore } from "./clients.store.js";
import { createFollowUpBody, followUpIdParams, followUpListQuery, updateFollowUpBody, type CreateFollowUpBody, type FollowUpListQuery, type UpdateFollowUpBody } from "./follow-ups.schema.js";
import type { FollowUpStore } from "./follow-ups.store.js";
import type { LeadStore } from "./leads.store.js";
import { presentFollowUp } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function assertSubject(dependencies: { clients: ClientStore; leads: LeadStore; followUps: FollowUpStore }, orgId: string, clientId: string | null | undefined, leadId: string | null | undefined, ownerEmployeeId?: string): Promise<void> {
  if (clientId) {
    const client = await dependencies.clients.find(orgId, clientId);
    if (!client) throw new AppError(404, "NOT_FOUND", "Client not found");
  }
  if (leadId) {
    const lead = await dependencies.leads.find(orgId, leadId);
    if (!lead) throw new AppError(404, "NOT_FOUND", "Lead not found");
  }
  if (ownerEmployeeId) {
    const employee = await dependencies.followUps.findEmployee(orgId, ownerEmployeeId);
    if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");
  }
}

export function createFollowUpRouter(dependencies: { authStore: AuthStore; clients: ClientStore; leads: LeadStore; followUps: FollowUpStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/follow-ups", session, requirePermission("follow_ups:view"), validateQuery(followUpListQuery), async (req, res, next) => {
    try {
      const query = readQuery<FollowUpListQuery>(res);
      const result = await dependencies.followUps.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentFollowUp),
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

  router.get("/api/follow-ups/:id", session, requirePermission("follow_ups:view"), validateParams(followUpIdParams), async (req, res, next) => {
    try {
      const followUp = await dependencies.followUps.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!followUp) {
        next(new AppError(404, "NOT_FOUND", "Follow-up not found"));
        return;
      }
      res.status(200).json({ data: presentFollowUp(followUp), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/follow-ups", session, requirePermission("follow_ups:create"), validateBody(createFollowUpBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as CreateFollowUpBody;
      const clientId = body.clientId ?? null;
      const leadId = body.leadId ?? null;
      await assertSubject(dependencies, orgId, clientId, leadId, body.ownerEmployeeId);
      const created = await dependencies.followUps.insert({
        organizationId: orgId,
        clientId,
        leadId,
        ownerEmployeeId: body.ownerEmployeeId,
        dueAt: new Date(body.dueAt),
        status: body.status,
      });
      res.status(201).json({ data: presentFollowUp(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/follow-ups/:id", session, requirePermission("follow_ups:update"), validateParams(followUpIdParams), validateBody(updateFollowUpBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const current = await dependencies.followUps.find(orgId, readParams<{ id: string }>(res).id);
      if (!current) {
        next(new AppError(404, "NOT_FOUND", "Follow-up not found"));
        return;
      }
      const body = req.body as UpdateFollowUpBody;
      const clientId = body.clientId === undefined ? current.clientId : body.clientId;
      const leadId = body.leadId === undefined ? current.leadId : body.leadId;
      if (!clientId && !leadId) {
        next(new AppError(400, "VALIDATION_ERROR", "Request validation failed", { clientId: "Choose a client or a lead" }));
        return;
      }
      await assertSubject(dependencies, orgId, clientId, leadId, body.ownerEmployeeId);
      const updated = await dependencies.followUps.update(orgId, current.id, body);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Follow-up not found"));
        return;
      }
      res.status(200).json({ data: presentFollowUp(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
