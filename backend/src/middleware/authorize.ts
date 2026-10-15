import type { NextFunction, Request, Response } from "express";

import { AppError } from "../lib/errors.js";

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required"));
      return;
    }
    if (!req.auth.permissions.includes(permission)) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
      return;
    }
    next();
  };
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required"));
    return;
  }
  if (req.auth.roleKey !== "super_admin") {
    next(new AppError(403, "FORBIDDEN", "Only a Super Admin can perform this action"));
    return;
  }
  next();
}
