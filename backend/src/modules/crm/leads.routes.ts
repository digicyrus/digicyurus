import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validateBody, validateParams, validateQuery, readParams, readQuery } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { LeadStore } from "./leads.store.js";
import { createLeadBody, leadIdParams, leadListQuery, moveLeadStageBody, updateLeadBody, type CreateLeadBody, type LeadListQuery, type UpdateLeadBody } from "./leads.schema.js";
import { presentLead } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createLeadRouter(dependencies: { authStore: AuthStore; leads: LeadStore; audit?: AuditLogStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/leads", session, requirePermission("leads:view"), validateQuery(leadListQuery), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const query = readQuery<LeadListQuery>(res);
      const result = await dependencies.leads.list(orgId, query);
      res.status(200).json({
        data: {
          items: result.items.map(presentLead),
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

  router.get("/api/leads/:id", session, requirePermission("leads:view"), validateParams(leadIdParams), async (req, res, next) => {
    try {
      const lead = await dependencies.leads.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!lead) {
        next(new AppError(404, "NOT_FOUND", "Lead not found"));
        return;
      }
      res.status(200).json({ data: presentLead(lead), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/leads", session, requirePermission("leads:create"), validateBody(createLeadBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as CreateLeadBody;
      const existing = await dependencies.leads.findByCode(orgId, body.code);
      if (existing) {
        next(new AppError(409, "CONFLICT", "This code is already in use", { code: "Already in use" }));
        return;
      }
      const created = await dependencies.leads.insert({
        organizationId: orgId,
        code: body.code,
        company: body.company,
        person: body.person,
        value: body.value,
        source: body.source,
        priority: body.priority,
        expectedClose: body.closing,
        probability: body.probability,
      });
      res.status(201).json({ data: presentLead(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/leads/:id", session, requirePermission("leads:update"), validateParams(leadIdParams), validateBody(updateLeadBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as UpdateLeadBody;
      const id = readParams<{ id: string }>(res).id;
      if (body.code) {
        const existing = await dependencies.leads.findByCode(orgId, body.code);
        if (existing && existing.id !== id) {
          next(new AppError(409, "CONFLICT", "This code is already in use", { code: "Already in use" }));
          return;
        }
      }
      const updated = await dependencies.leads.update(orgId, id, body);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Lead not found"));
        return;
      }
      res.status(200).json({ data: presentLead(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/leads/:id/stage", session, requirePermission("leads:move_stage"), validateParams(leadIdParams), validateBody(moveLeadStageBody), async (req, res, next) => {
    try {
      const body = req.body as { stage: "New" | "Contacted" | "Qualified" | "Meeting Scheduled" | "Proposal Sent" | "Negotiation" | "Won" | "Lost" };
      const orgId = organizationId(req.auth?.organizationId);
      const updated = await dependencies.leads.moveStage(orgId, readParams<{ id: string }>(res).id, body.stage, dependencies.audit ? {
        organizationId: orgId,
        draft: {
          actorUserId: req.auth?.id ?? null,
          action: "lead.stage",
          resourceType: "lead",
        },
        persist: (event) => dependencies.audit!.append(event).then(() => undefined),
      } : null);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Lead not found"));
        return;
      }
      res.status(200).json({ data: presentLead(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
