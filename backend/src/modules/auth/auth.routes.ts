import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import type { LoginRateLimiter } from "../../middleware/login-rate-limit.js";
import { validateBody } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "./auth.store.js";
import { loginBodySchema, type LoginBody } from "./auth.schema.js";
import { clearSessionCookie, readSessionCookie, sessionCookie } from "./cookies.js";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./passwords.js";
import { createSessionToken, hashSessionToken, sessionExpiresAt } from "./sessions.js";

export type PasswordVerifier = {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
  dummyHash(): Promise<string>;
};

export const argon2Verifier: PasswordVerifier = {
  hash: hashPassword,
  verify: verifyPassword,
  dummyHash: dummyPasswordHash,
};

export type AuthDependencies = {
  store: AuthStore;
  verifier: PasswordVerifier;
  secureCookies: boolean;
  rateLimiter: LoginRateLimiter;
  audit?: AuditLogStore;
};

const invalidCredentials = () => new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

export function createAuthRouter(dependencies: AuthDependencies): Router {
  const router = Router();
  const requireSession = authenticate(dependencies.store);

  router.post("/api/auth/login", validateBody(loginBodySchema), async (req, res, next) => {
    try {
      const body = req.body as LoginBody;
      const email = body.email.toLowerCase();
      if (!dependencies.rateLimiter.allow(email, req.ip || "unknown")) {
        next(new AppError(429, "RATE_LIMITED", "Too many attempts"));
        return;
      }
      const user = await dependencies.store.findUserByEmail(email);
      const passwordHash = user?.passwordHash ?? (await dependencies.verifier.dummyHash());
      const matches = await dependencies.verifier.verify(passwordHash, body.password);
      if (!user || user.status !== "active" || !matches) {
        next(invalidCredentials());
        return;
      }
      const token = createSessionToken();
      await dependencies.store.insertSession({
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: sessionExpiresAt(),
      }, dependencies.audit ? {
        organizationId: user.organizationId,
        draft: {
          actorUserId: user.id,
          action: "login",
          resourceType: "user",
          metadata: { email: user.email },
        },
        persist: (event) => dependencies.audit!.append(event).then(() => undefined),
      } : null);
      res.setHeader("Set-Cookie", sessionCookie(token, dependencies.secureCookies));
      res.status(200).json({
        data: { id: user.id, name: user.name, email: user.email, role: user.roleName },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/logout", async (req, res, next) => {
    try {
      const token = readSessionCookie(req.header("cookie"));
      if (token) {
        await dependencies.store.revokeSession(hashSessionToken(token), dependencies.audit ? {
          persist: (event) => dependencies.audit!.append(event).then(() => undefined),
        } : null);
      }
      res.setHeader("Set-Cookie", clearSessionCookie(dependencies.secureCookies));
      res.status(200).json({ data: { status: "logged_out" }, error: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/auth/me", requireSession, (req, res, next) => {
    if (!req.auth) {
      next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required"));
      return;
    }
    res.status(200).json({
      data: {
        id: req.auth.id,
        name: req.auth.name,
        email: req.auth.email,
        role: req.auth.role,
        permissions: req.auth.permissions,
      },
      error: null,
    });
  });

  return router;
}
