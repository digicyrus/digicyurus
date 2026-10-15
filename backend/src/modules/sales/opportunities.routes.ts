import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { ClientStore } from "../crm/clients.store.js";
import type { LeadStore } from "../crm/leads.store.js";
import { todayUtc } from "../finance/constants.js";
import type { EmployeeStore } from "../hr/employees.store.js";
import { definedMetadata, salesAudit } from "./audit.js";
import {
  changeOpportunityStageBody,
  createOpportunityBody,
  opportunityIdParams,
  opportunityListQuery,
  updateOpportunityBody,
  type ChangeOpportunityStageBody,
  type CreateOpportunityBody,
  type OpportunityListQuery,
  type UpdateOpportunityBody,
} from "./opportunities.schema.js";
import type { OpportunityStore } from "./opportunities.store.js";
import { presentOpportunity, presentOpportunityDetail, presentPipelineSummary } from "./present.js";
import { assertOpportunityLinks } from "./relations.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function rejectDuplicateReference(store: OpportunityStore, orgId: string, reference: string, exceptId?: string): Promise<void> {
  const existing = await store.findByReference(orgId, reference);
  if (existing && existing.id !== exceptId) {
    throw new AppError(409, "CONFLICT", "This reference is already in use", { reference: "Already in use" });
  }
}

export function createOpportunityRouter(dependencies: {
  authStore: AuthStore;
  clients: ClientStore;
  leads: LeadStore;
  employees: EmployeeStore;
  opportunities: OpportunityStore;
  audit?: AuditLogStore;
}): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/sales/opportunities", session, requirePermission("pipeline:view"), validateQuery(opportunityListQuery), async (req, res, next) => {
    try {
      const query = readQuery<OpportunityListQuery>(res);
      const result = await dependencies.opportunities.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentOpportunity),
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

  router.get("/api/sales/opportunities/summary", session, requirePermission("pipeline:view"), async (req, res, next) => {
    try {
      const stages = await dependencies.opportunities.summary(organizationId(req.auth?.organizationId));
      res.status(200).json({ data: presentPipelineSummary(stages), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/sales/opportunities/:id", session, requirePermission("pipeline:view"), validateParams(opportunityIdParams), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const opportunity = await dependencies.opportunities.find(orgId, id);
      if (!opportunity) {
        next(new AppError(404, "NOT_FOUND", "Opportunity not found"));
        return;
      }
      const history = await dependencies.opportunities.history(orgId, id);
      res.status(200).json({ data: presentOpportunityDetail(opportunity, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/sales/opportunities", session, requirePermission("pipeline:create"), validateBody(createOpportunityBody), async (req, res, next) => {
    try {
      const body = req.body as CreateOpportunityBody;
      const orgId = organizationId(req.auth?.organizationId);
      const clientId = body.clientId ?? null;
      const leadId = body.leadId ?? null;
      const ownerEmployeeId = body.ownerEmployeeId ?? null;
      await assertOpportunityLinks(dependencies, orgId, { clientId, leadId, ownerEmployeeId });
      await rejectDuplicateReference(dependencies.opportunities, orgId, body.reference);
      const created = await dependencies.opportunities.insert({
        organizationId: orgId,
        reference: body.reference,
        title: body.title,
        clientId,
        leadId,
        ownerEmployeeId,
        valueRupees: body.value,
        expectedClose: body.expectedClose,
        source: body.source,
        priority: body.priority,
        notes: body.notes,
        stage: body.stage,
        lostReason: body.lostReason ?? null,
        closedOn: body.closedOn ?? null,
        today: todayUtc(),
      }, salesAudit(dependencies.audit, orgId, req.auth?.id ?? null, "opportunity.create", "opportunity", {
        reference: body.reference,
        stage: body.stage,
        value: body.value,
      }));
      const history = await dependencies.opportunities.history(orgId, created.id);
      res.status(201).json({ data: presentOpportunityDetail(created, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/sales/opportunities/:id", session, requirePermission("pipeline:update"), validateParams(opportunityIdParams), validateBody(updateOpportunityBody), async (req, res, next) => {
    try {
      const body = req.body as UpdateOpportunityBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const current = await dependencies.opportunities.find(orgId, id);
      if (!current) {
        next(new AppError(404, "NOT_FOUND", "Opportunity not found"));
        return;
      }
      const clientId = body.clientId === undefined ? current.clientId : body.clientId;
      const leadId = body.leadId === undefined ? current.leadId : body.leadId;
      const ownerEmployeeId = body.ownerEmployeeId === undefined ? current.ownerEmployeeId : body.ownerEmployeeId;
      await assertOpportunityLinks(dependencies, orgId, { clientId, leadId, ownerEmployeeId });
      if (body.reference) await rejectDuplicateReference(dependencies.opportunities, orgId, body.reference, id);
      const updated = await dependencies.opportunities.update(orgId, id, body, salesAudit(dependencies.audit, orgId, req.auth?.id ?? null, "opportunity.update", "opportunity", definedMetadata({
        reference: body.reference,
        title: body.title,
        value: body.value,
        expectedClose: body.expectedClose,
        priority: body.priority,
      })));
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Opportunity not found"));
        return;
      }
      const history = await dependencies.opportunities.history(orgId, id);
      res.status(200).json({ data: presentOpportunityDetail(updated, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/sales/opportunities/:id/stage", session, requirePermission("pipeline:move_stage"), validateParams(opportunityIdParams), validateBody(changeOpportunityStageBody), async (req, res, next) => {
    try {
      const body = req.body as ChangeOpportunityStageBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const updated = await dependencies.opportunities.changeStage(orgId, id, {
        stage: body.stage,
        lostReason: body.lostReason ?? null,
        closedOn: body.closedOn ?? null,
        today: todayUtc(),
      }, salesAudit(dependencies.audit, orgId, req.auth?.id ?? null, "opportunity.stage", "opportunity", {}));
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Opportunity not found"));
        return;
      }
      const history = await dependencies.opportunities.history(orgId, id);
      res.status(200).json({ data: presentOpportunityDetail(updated, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
