import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { ClientStore } from "../crm/clients.store.js";
import { presentReferral } from "./present.js";
import { createReferralBody, referralIdParams, referralListQuery, updateReferralBody, type CreateReferralBody, type ReferralListQuery, type UpdateReferralBody } from "./referrals.schema.js";
import type { ReferralStore } from "./referrals.store.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function assertClient(clients: ClientStore, orgId: string, clientId: string): Promise<void> {
  const client = await clients.find(orgId, clientId);
  if (!client) throw new AppError(404, "NOT_FOUND", "Client not found");
}

async function rejectDuplicateCode(store: ReferralStore, orgId: string, code: string, exceptId?: string): Promise<void> {
  const existing = await store.findByCode(orgId, code);
  if (existing && existing.id !== exceptId) {
    throw new AppError(409, "CONFLICT", "This code is already in use", { code: "Already in use" });
  }
}

export function createReferralRouter(dependencies: { authStore: AuthStore; clients: ClientStore; referrals: ReferralStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/referrals", session, requirePermission("referrals:view"), validateQuery(referralListQuery), async (req, res, next) => {
    try {
      const query = readQuery<ReferralListQuery>(res);
      const result = await dependencies.referrals.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentReferral),
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

  router.get("/api/referrals/:id", session, requirePermission("referrals:view"), validateParams(referralIdParams), async (req, res, next) => {
    try {
      const referral = await dependencies.referrals.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!referral) {
        next(new AppError(404, "NOT_FOUND", "Referral not found"));
        return;
      }
      res.status(200).json({ data: presentReferral(referral), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/referrals", session, requirePermission("referrals:create"), validateBody(createReferralBody), async (req, res, next) => {
    try {
      const body = req.body as CreateReferralBody;
      const orgId = organizationId(req.auth?.organizationId);
      if (body.clientId) await assertClient(dependencies.clients, orgId, body.clientId);
      await rejectDuplicateCode(dependencies.referrals, orgId, body.code);
      const created = await dependencies.referrals.insert({
        organizationId: orgId,
        code: body.code,
        partner: body.partner,
        clientId: body.clientId ?? null,
        deals: body.deals,
        revenueRupees: body.revenue,
        commissionRupees: body.commission,
        status: body.status,
      });
      res.status(201).json({ data: presentReferral(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/referrals/:id", session, requirePermission("referrals:update"), validateParams(referralIdParams), validateBody(updateReferralBody), async (req, res, next) => {
    try {
      const body = req.body as UpdateReferralBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      if (body.clientId) await assertClient(dependencies.clients, orgId, body.clientId);
      if (body.code !== undefined) await rejectDuplicateCode(dependencies.referrals, orgId, body.code, id);
      const updated = await dependencies.referrals.update(orgId, id, body);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Referral not found"));
        return;
      }
      res.status(200).json({ data: presentReferral(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
