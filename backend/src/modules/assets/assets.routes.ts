import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import { assetIdParams, assetListQuery, createAssetBody, updateAssetBody, type AssetListQuery, type CreateAssetBody, type UpdateAssetBody } from "./assets.schema.js";
import type { AssetStore } from "./assets.store.js";
import { presentAsset } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function rejectDuplicateName(store: AssetStore, orgId: string, name: string, exceptId?: string): Promise<void> {
  const existing = await store.findByName(orgId, name);
  if (existing && existing.id !== exceptId) {
    throw new AppError(409, "CONFLICT", "This name is already in use", { name: "Already in use" });
  }
}

export function createAssetRouter(dependencies: { authStore: AuthStore; assets: AssetStore; audit?: AuditLogStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/assets", session, requirePermission("assets:view"), validateQuery(assetListQuery), async (req, res, next) => {
    try {
      const query = readQuery<AssetListQuery>(res);
      const result = await dependencies.assets.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentAsset),
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

  router.get("/api/assets/:id", session, requirePermission("assets:view"), validateParams(assetIdParams), async (req, res, next) => {
    try {
      const asset = await dependencies.assets.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!asset) {
        next(new AppError(404, "NOT_FOUND", "Asset not found"));
        return;
      }
      res.status(200).json({ data: presentAsset(asset), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/assets", session, requirePermission("assets:create"), validateBody(createAssetBody), async (req, res, next) => {
    try {
      const body = req.body as CreateAssetBody;
      const orgId = organizationId(req.auth?.organizationId);
      await rejectDuplicateName(dependencies.assets, orgId, body.name);
      const created = await dependencies.assets.insert({
        organizationId: orgId,
        name: body.name,
        type: body.type,
        vendor: body.vendor,
        renewalOn: body.renewal,
        costRupees: body.cost,
        status: body.status,
      }, dependencies.audit ? {
        organizationId: orgId,
        draft: {
          actorUserId: req.auth?.id ?? null,
          action: "asset.create",
          resourceType: "asset",
          metadata: { name: body.name, type: body.type, status: body.status },
        },
        persist: (event) => dependencies.audit!.append(event).then(() => undefined),
      } : null);
      res.status(201).json({ data: presentAsset(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/assets/:id", session, requirePermission("assets:update"), validateParams(assetIdParams), validateBody(updateAssetBody), async (req, res, next) => {
    try {
      const body = req.body as UpdateAssetBody;
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      if (body.name !== undefined) await rejectDuplicateName(dependencies.assets, orgId, body.name, id);
      const updated = await dependencies.assets.update(orgId, id, body, dependencies.audit ? {
        organizationId: orgId,
        draft: {
          actorUserId: req.auth?.id ?? null,
          action: "asset.update",
          resourceType: "asset",
          metadata: body,
        },
        persist: (event) => dependencies.audit!.append(event).then(() => undefined),
      } : null);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Asset not found"));
        return;
      }
      res.status(200).json({ data: presentAsset(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
