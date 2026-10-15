import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import { contentIdParams, contentListQuery, createContentBody, updateContentBody, type ContentListQuery, type CreateContentBody, type UpdateContentBody } from "./content.schema.js";
import type { ContentStore } from "./content.store.js";
import { presentContent } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createContentRouter(dependencies: { authStore: AuthStore; content: ContentStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);
  const view = requirePermission("content:view");

  router.get("/api/content", session, view, validateQuery(contentListQuery), async (req, res, next) => {
    try {
      const query = readQuery<ContentListQuery>(res);
      const result = await dependencies.content.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentContent),
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

  router.get("/api/content/:id", session, view, validateParams(contentIdParams), async (req, res, next) => {
    try {
      const item = await dependencies.content.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!item) {
        next(new AppError(404, "NOT_FOUND", "Content not found"));
        return;
      }
      res.status(200).json({ data: presentContent(item), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/content", session, view, validateBody(createContentBody), async (req, res, next) => {
    try {
      const body = req.body as CreateContentBody;
      const created = await dependencies.content.insert({
        organizationId: organizationId(req.auth?.organizationId),
        title: body.title,
        channel: body.channel,
        publishDate: body.date,
        status: body.status,
      });
      res.status(201).json({ data: presentContent(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/content/:id", session, view, validateParams(contentIdParams), validateBody(updateContentBody), async (req, res, next) => {
    try {
      const updated = await dependencies.content.update(
        organizationId(req.auth?.organizationId),
        readParams<{ id: string }>(res).id,
        req.body as UpdateContentBody,
      );
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Content not found"));
        return;
      }
      res.status(200).json({ data: presentContent(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
