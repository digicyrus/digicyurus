import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validateBody, validateParams, validateQuery, readParams, readQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import { clientIdParams, clientListQuery, createClientBody, updateClientBody, type ClientListQuery, type CreateClientBody, type UpdateClientBody } from "./clients.schema.js";
import type { ClientStore } from "./clients.store.js";
import { presentClient } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

function normalizeEmail(email: string | null | undefined): string | null | undefined {
  if (email === undefined) return undefined;
  if (email === null) return null;
  return email.toLowerCase();
}

async function rejectDuplicates(store: ClientStore, orgId: string, input: { code?: string; email?: string | null }, currentId?: string): Promise<void> {
  if (input.code) {
    const existing = await store.findByCode(orgId, input.code);
    if (existing && existing.id !== currentId) {
      throw new AppError(409, "CONFLICT", "This code is already in use", { code: "Already in use" });
    }
  }
  if (input.email) {
    const existing = await store.findByEmail(orgId, input.email);
    if (existing && existing.id !== currentId) {
      throw new AppError(409, "CONFLICT", "This email is already in use", { email: "Already in use" });
    }
  }
}

export function createClientRouter(dependencies: { authStore: AuthStore; clients: ClientStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/clients", session, requirePermission("clients:view"), validateQuery(clientListQuery), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const query = readQuery<ClientListQuery>(res);
      const result = await dependencies.clients.list(orgId, query);
      res.status(200).json({
        data: {
          items: result.items.map(presentClient),
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

  router.get("/api/clients/:id", session, requirePermission("clients:view"), validateParams(clientIdParams), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const client = await dependencies.clients.find(orgId, readParams<{ id: string }>(res).id);
      if (!client) {
        next(new AppError(404, "NOT_FOUND", "Client not found"));
        return;
      }
      res.status(200).json({ data: presentClient(client), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/clients", session, requirePermission("clients:create"), validateBody(createClientBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as CreateClientBody;
      const email = normalizeEmail(body.email) ?? null;
      await rejectDuplicates(dependencies.clients, orgId, { code: body.code, email });
      const created = await dependencies.clients.insert({
        organizationId: orgId,
        code: body.code,
        name: body.name,
        contactName: body.contactName,
        industry: body.industry,
        status: body.status,
        rating: body.rating,
        customerSince: body.customerSince,
        email,
        phone: body.phone ?? null,
      });
      res.status(201).json({ data: presentClient(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/clients/:id", session, requirePermission("clients:update"), validateParams(clientIdParams), validateBody(updateClientBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as UpdateClientBody;
      const email = normalizeEmail(body.email);
      const id = readParams<{ id: string }>(res).id;
      await rejectDuplicates(dependencies.clients, orgId, { code: body.code, email }, id);
      const updated = await dependencies.clients.update(orgId, id, { ...body, email });
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Client not found"));
        return;
      }
      res.status(200).json({ data: presentClient(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
