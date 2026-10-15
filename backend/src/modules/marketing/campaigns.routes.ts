import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import { campaignIdParams, campaignListQuery, createCampaignBody, updateCampaignBody, type CampaignListQuery, type CreateCampaignBody, type UpdateCampaignBody } from "./campaigns.schema.js";
import type { CampaignStore } from "./campaigns.store.js";
import { presentCampaign } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function rejectDuplicateName(store: CampaignStore, orgId: string, name: string, exceptId?: string): Promise<void> {
  const existing = await store.findByName(orgId, name);
  if (existing && existing.id !== exceptId) {
    throw new AppError(409, "CONFLICT", "This name is already in use", { name: "Already in use" });
  }
}

export function createCampaignRouter(dependencies: { authStore: AuthStore; campaigns: CampaignStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);
  const view = requirePermission("campaigns:view");

  router.get("/api/campaigns", session, view, validateQuery(campaignListQuery), async (req, res, next) => {
    try {
      const query = readQuery<CampaignListQuery>(res);
      const result = await dependencies.campaigns.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentCampaign),
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

  router.get("/api/campaigns/:id", session, view, validateParams(campaignIdParams), async (req, res, next) => {
    try {
      const campaign = await dependencies.campaigns.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!campaign) {
        next(new AppError(404, "NOT_FOUND", "Campaign not found"));
        return;
      }
      res.status(200).json({ data: presentCampaign(campaign), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/campaigns", session, view, validateBody(createCampaignBody), async (req, res, next) => {
    try {
      const body = req.body as CreateCampaignBody;
      const orgId = organizationId(req.auth?.organizationId);
      await rejectDuplicateName(dependencies.campaigns, orgId, body.name);
      const created = await dependencies.campaigns.insert({
        organizationId: orgId,
        name: body.name,
        channel: body.channel,
        spendRupees: body.spend,
        leads: body.leads,
        roi: body.roi,
        status: body.status,
      });
      res.status(201).json({ data: presentCampaign(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/campaigns/:id", session, view, validateParams(campaignIdParams), validateBody(updateCampaignBody), async (req, res, next) => {
    try {
      const body = req.body as UpdateCampaignBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      if (body.name !== undefined) await rejectDuplicateName(dependencies.campaigns, orgId, body.name, id);
      const updated = await dependencies.campaigns.update(orgId, id, body);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Campaign not found"));
        return;
      }
      res.status(200).json({ data: presentCampaign(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
