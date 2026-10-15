import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { ClientStore } from "../crm/clients.store.js";
import { definedMetadata, salesAudit } from "./audit.js";
import type { OpportunityStore } from "./opportunities.store.js";
import { presentProposal, presentProposalDetail } from "./present.js";
import {
  changeProposalStatusBody,
  createProposalBody,
  proposalIdParams,
  proposalListQuery,
  updateProposalBody,
  type ChangeProposalStatusBody,
  type CreateProposalBody,
  type ProposalListQuery,
  type UpdateProposalBody,
} from "./proposals.schema.js";
import type { ProposalStore } from "./proposals.store.js";
import { assertProposalLinks } from "./relations.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function rejectDuplicateNumber(store: ProposalStore, orgId: string, number: string, exceptId?: string): Promise<void> {
  const existing = await store.findByNumber(orgId, number);
  if (existing && existing.id !== exceptId) {
    throw new AppError(409, "CONFLICT", "This proposal number is already in use", { number: "Already in use" });
  }
}

export function createProposalRouter(dependencies: {
  authStore: AuthStore;
  clients: ClientStore;
  opportunities: OpportunityStore;
  proposals: ProposalStore;
  audit?: AuditLogStore;
}): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/sales/proposals", session, requirePermission("proposals:view"), validateQuery(proposalListQuery), async (req, res, next) => {
    try {
      const query = readQuery<ProposalListQuery>(res);
      const result = await dependencies.proposals.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentProposal),
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

  router.get("/api/sales/proposals/:id", session, requirePermission("proposals:view"), validateParams(proposalIdParams), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const proposal = await dependencies.proposals.find(orgId, id);
      if (!proposal) {
        next(new AppError(404, "NOT_FOUND", "Proposal not found"));
        return;
      }
      const history = await dependencies.proposals.history(orgId, id);
      res.status(200).json({ data: presentProposalDetail(proposal, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/sales/proposals", session, requirePermission("proposals:create"), validateBody(createProposalBody), async (req, res, next) => {
    try {
      const body = req.body as CreateProposalBody;
      const orgId = organizationId(req.auth?.organizationId);
      const opportunityId = body.opportunityId ?? null;
      await assertProposalLinks(dependencies, orgId, { clientId: body.clientId, opportunityId });
      await rejectDuplicateNumber(dependencies.proposals, orgId, body.number);
      const created = await dependencies.proposals.insert({
        organizationId: orgId,
        number: body.number,
        title: body.title,
        clientId: body.clientId,
        opportunityId,
        validityDate: body.validityDate,
        notes: body.notes,
        rateBps: body.rateBps,
        lines: body.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitPriceRupees: line.unitPrice,
          discountRupees: line.discount,
        })),
      }, salesAudit(dependencies.audit, orgId, req.auth?.id ?? null, "proposal.create", "proposal", {
        number: body.number,
        clientId: body.clientId,
        opportunityId,
      }));
      const history = await dependencies.proposals.history(orgId, created.id);
      res.status(201).json({ data: presentProposalDetail(created, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/sales/proposals/:id", session, requirePermission("proposals:update"), validateParams(proposalIdParams), validateBody(updateProposalBody), async (req, res, next) => {
    try {
      const body = req.body as UpdateProposalBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const current = await dependencies.proposals.find(orgId, id);
      if (!current) {
        next(new AppError(404, "NOT_FOUND", "Proposal not found"));
        return;
      }
      if (current.status !== "Draft") throw new AppError(409, "CONFLICT", "Only draft proposals can be edited");
      const clientId = body.clientId ?? current.clientId;
      const opportunityId = body.opportunityId === undefined ? current.opportunityId : body.opportunityId;
      await assertProposalLinks(dependencies, orgId, { clientId, opportunityId });
      if (body.number) await rejectDuplicateNumber(dependencies.proposals, orgId, body.number, id);
      const updated = await dependencies.proposals.update(orgId, id, body, salesAudit(dependencies.audit, orgId, req.auth?.id ?? null, "proposal.update", "proposal", definedMetadata({
        number: body.number,
        title: body.title,
        rateBps: body.rateBps,
      })));
      if (!updated) throw new AppError(409, "CONFLICT", "Only draft proposals can be edited");
      const history = await dependencies.proposals.history(orgId, id);
      res.status(200).json({ data: presentProposalDetail(updated, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/sales/proposals/:id/status", session, requirePermission("proposals:change_status"), validateParams(proposalIdParams), validateBody(changeProposalStatusBody), async (req, res, next) => {
    try {
      const body = req.body as ChangeProposalStatusBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const updated = await dependencies.proposals.changeStatus(orgId, id, body.status, salesAudit(
        dependencies.audit,
        orgId,
        req.auth?.id ?? null,
        "proposal.status",
        "proposal",
        { status: body.status },
      ));
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Proposal not found"));
        return;
      }
      const history = await dependencies.proposals.history(orgId, id);
      res.status(200).json({ data: presentProposalDetail(updated, history), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
