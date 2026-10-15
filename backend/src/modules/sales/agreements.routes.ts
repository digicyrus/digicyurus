import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { ClientStore } from "../crm/clients.store.js";
import { definedMetadata, salesAudit } from "./audit.js";
import {
  agreementIdParams,
  agreementListQuery,
  changeAgreementStatusBody,
  createAgreementBody,
  updateAgreementBody,
  type AgreementListQuery,
  type ChangeAgreementStatusBody,
  type CreateAgreementBody,
  type UpdateAgreementBody,
} from "./agreements.schema.js";
import type { AgreementStore } from "./agreements.store.js";
import type { OpportunityStore } from "./opportunities.store.js";
import { presentAgreement, presentAgreementDetail } from "./present.js";
import type { ProposalStore } from "./proposals.store.js";
import { assertAgreementLinks } from "./relations.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function rejectDuplicateNumber(store: AgreementStore, orgId: string, number: string, exceptId?: string): Promise<void> {
  const existing = await store.findByNumber(orgId, number);
  if (existing && existing.id !== exceptId) {
    throw new AppError(409, "CONFLICT", "This agreement number is already in use", { number: "Already in use" });
  }
}

export function createAgreementRouter(dependencies: {
  authStore: AuthStore;
  clients: ClientStore;
  opportunities: OpportunityStore;
  proposals: ProposalStore;
  agreements: AgreementStore;
  audit?: AuditLogStore;
}): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/sales/agreements", session, requirePermission("agreements:view"), validateQuery(agreementListQuery), async (req, res, next) => {
    try {
      const query = readQuery<AgreementListQuery>(res);
      const result = await dependencies.agreements.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentAgreement),
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

  router.get("/api/sales/agreements/:id", session, requirePermission("agreements:view"), validateParams(agreementIdParams), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const agreement = await dependencies.agreements.find(orgId, id);
      if (!agreement) {
        next(new AppError(404, "NOT_FOUND", "Agreement not found"));
        return;
      }
      const history = await dependencies.agreements.history(orgId, id);
      res.status(200).json({ data: presentAgreementDetail(agreement, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/sales/agreements", session, requirePermission("agreements:create"), validateBody(createAgreementBody), async (req, res, next) => {
    try {
      const body = req.body as CreateAgreementBody;
      const orgId = organizationId(req.auth?.organizationId);
      const opportunityId = body.opportunityId ?? null;
      const proposalId = body.proposalId ?? null;
      await assertAgreementLinks(dependencies, orgId, { clientId: body.clientId, opportunityId, proposalId });
      await rejectDuplicateNumber(dependencies.agreements, orgId, body.number);
      const created = await dependencies.agreements.insert({
        organizationId: orgId,
        number: body.number,
        title: body.title,
        description: body.description,
        clientId: body.clientId,
        opportunityId,
        proposalId,
        startDate: body.startDate,
        endDate: body.endDate,
        valueRupees: body.value,
      }, salesAudit(dependencies.audit, orgId, req.auth?.id ?? null, "agreement.create", "agreement", {
        number: body.number,
        clientId: body.clientId,
        value: body.value,
      }));
      const history = await dependencies.agreements.history(orgId, created.id);
      res.status(201).json({ data: presentAgreementDetail(created, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/sales/agreements/:id", session, requirePermission("agreements:update"), validateParams(agreementIdParams), validateBody(updateAgreementBody), async (req, res, next) => {
    try {
      const body = req.body as UpdateAgreementBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const current = await dependencies.agreements.find(orgId, id);
      if (!current) {
        next(new AppError(404, "NOT_FOUND", "Agreement not found"));
        return;
      }
      const clientId = body.clientId ?? current.clientId;
      const opportunityId = body.opportunityId === undefined ? current.opportunityId : body.opportunityId;
      const proposalId = body.proposalId === undefined ? current.proposalId : body.proposalId;
      await assertAgreementLinks(dependencies, orgId, { clientId, opportunityId, proposalId });
      if (body.number) await rejectDuplicateNumber(dependencies.agreements, orgId, body.number, id);
      const updated = await dependencies.agreements.update(orgId, id, body, salesAudit(dependencies.audit, orgId, req.auth?.id ?? null, "agreement.update", "agreement", definedMetadata({
        number: body.number,
        title: body.title,
        value: body.value,
        startDate: body.startDate,
        endDate: body.endDate,
      })));
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Agreement not found"));
        return;
      }
      const history = await dependencies.agreements.history(orgId, id);
      res.status(200).json({ data: presentAgreementDetail(updated, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/sales/agreements/:id/status", session, requirePermission("agreements:change_status"), validateParams(agreementIdParams), validateBody(changeAgreementStatusBody), async (req, res, next) => {
    try {
      const body = req.body as ChangeAgreementStatusBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const updated = await dependencies.agreements.changeStatus(orgId, id, body.status, salesAudit(
        dependencies.audit,
        orgId,
        req.auth?.id ?? null,
        "agreement.status",
        "agreement",
        { status: body.status },
      ));
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Agreement not found"));
        return;
      }
      const history = await dependencies.agreements.history(orgId, id);
      res.status(200).json({ data: presentAgreementDetail(updated, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
