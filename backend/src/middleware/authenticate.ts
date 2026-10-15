import type { NextFunction, Request, Response } from "express";

import { AppError } from "../lib/errors.js";
import type { AuthStore, AuthUser } from "../modules/auth/auth.store.js";
import { readSessionCookie } from "../modules/auth/cookies.js";
import { hashSessionToken } from "../modules/auth/sessions.js";

export type RequestAuth = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: string;
  roleKey: string;
  permissions: string[];
};

declare module "express-serve-static-core" {
  interface Request {
    auth?: RequestAuth;
  }
}

export function toRequestAuth(user: AuthUser): RequestAuth {
  return {
    id: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.roleName,
    roleKey: user.roleKey,
    permissions: user.permissions,
  };
}

export function sessionIsActive(session: { expiresAt: Date; revokedAt: Date | null; user: AuthUser }, now = Date.now()): boolean {
  return session.revokedAt === null && session.expiresAt.getTime() > now && session.user.status === "active";
}

export function authenticate(store: AuthStore) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = readSessionCookie(req.header("cookie"));
      if (!token) {
        next();
        return;
      }
      const session = await store.findSessionByTokenHash(hashSessionToken(token));
      if (session && sessionIsActive(session)) req.auth = toRequestAuth(session.user);
      next();
    } catch (error) {
      next(error);
    }
  };
}
