import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import { settingsAudit } from "./audit.js";
import { updateNotificationBody, type UpdateNotificationBody } from "./notifications.schema.js";
import type { NotificationStore } from "./notifications.store.js";
import { presentNotificationPreferences } from "./present.js";

function actor(req: { auth?: { id: string; organizationId: string } }): { organizationId: string; userId: string } {
  if (!req.auth?.organizationId || !req.auth.id) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  return { organizationId: req.auth.organizationId, userId: req.auth.id };
}

export function createNotificationRouter(dependencies: {
  authStore: AuthStore;
  notifications: NotificationStore;
  audit?: AuditLogStore;
}): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/settings/notifications", session, async (req, res, next) => {
    try {
      const current = actor(req);
      const preferences = await dependencies.notifications.get(current.organizationId, current.userId);
      if (!preferences) {
        next(new AppError(404, "NOT_FOUND", "Notification preferences not found"));
        return;
      }
      res.status(200).json({ data: presentNotificationPreferences(preferences), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/settings/notifications", session, validateBody(updateNotificationBody), async (req, res, next) => {
    try {
      const current = actor(req);
      const body = req.body as UpdateNotificationBody;
      const updated = await dependencies.notifications.update(
        current.organizationId,
        current.userId,
        body,
        settingsAudit(dependencies.audit, current.organizationId, current.userId, "notification.preferences", "user", {
          categories: body.categories ?? {},
          delivery: "unavailable",
        }),
      );
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Notification preferences not found"));
        return;
      }
      res.status(200).json({ data: presentNotificationPreferences(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
