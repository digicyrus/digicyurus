import { Router } from "express";

import { AppError } from "../../lib/errors.js";

export function healthRouter(checkDatabase?: () => Promise<void>): Router {
  const router = Router();

  router.get("/api/health", (_req, res) => {
    res.status(200).json({ data: { status: "ok" }, error: null });
  });

  router.get("/api/ready", async (_req, res, next) => {
    if (!checkDatabase) {
      next(new AppError(503, "SERVICE_UNAVAILABLE", "Database is unavailable"));
      return;
    }

    try {
      await checkDatabase();
      res.status(200).json({ data: { status: "ready" }, error: null });
    } catch {
      next(new AppError(503, "SERVICE_UNAVAILABLE", "Database is unavailable"));
    }
  });

  return router;
}
