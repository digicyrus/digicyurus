import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { ClientStore } from "../crm/clients.store.js";
import { createProjectBody, projectIdParams, projectListQuery, updateProjectBody, type CreateProjectBody, type ProjectListQuery, type UpdateProjectBody } from "./projects.schema.js";
import type { ProjectStore } from "./projects.store.js";
import { presentProject } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function assertClient(clients: ClientStore, orgId: string, clientId: string): Promise<void> {
  const client = await clients.find(orgId, clientId);
  if (!client) throw new AppError(404, "NOT_FOUND", "Client not found");
}

async function assertManager(projects: ProjectStore, orgId: string, managerEmployeeId: string | null | undefined): Promise<void> {
  if (!managerEmployeeId) return;
  const employee = await projects.findEmployee(orgId, managerEmployeeId);
  if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");
}

export function createProjectRouter(dependencies: { authStore: AuthStore; clients: ClientStore; projects: ProjectStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/projects", session, requirePermission("projects:view"), validateQuery(projectListQuery), async (req, res, next) => {
    try {
      const query = readQuery<ProjectListQuery>(res);
      const result = await dependencies.projects.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentProject),
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

  router.get("/api/projects/:id", session, requirePermission("projects:view"), validateParams(projectIdParams), async (req, res, next) => {
    try {
      const project = await dependencies.projects.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!project) {
        next(new AppError(404, "NOT_FOUND", "Project not found"));
        return;
      }
      res.status(200).json({ data: presentProject(project), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/projects", session, requirePermission("projects:create"), validateBody(createProjectBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as CreateProjectBody;
      await assertClient(dependencies.clients, orgId, body.clientId);
      await assertManager(dependencies.projects, orgId, body.managerEmployeeId);
      const existing = await dependencies.projects.findByCode(orgId, body.code);
      if (existing) throw new AppError(409, "CONFLICT", "This code is already in use", { code: "Already in use" });
      const created = await dependencies.projects.insert({
        organizationId: orgId,
        clientId: body.clientId,
        managerEmployeeId: body.managerEmployeeId ?? null,
        code: body.code,
        name: body.name,
        description: body.description,
        status: body.status,
        priority: body.priority,
        startDate: body.startDate,
        dueDate: body.dueDate,
      });
      res.status(201).json({ data: presentProject(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/projects/:id", session, requirePermission("projects:update"), validateParams(projectIdParams), validateBody(updateProjectBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const current = await dependencies.projects.find(orgId, id);
      if (!current) {
        next(new AppError(404, "NOT_FOUND", "Project not found"));
        return;
      }
      const body = req.body as UpdateProjectBody;
      if (body.clientId) await assertClient(dependencies.clients, orgId, body.clientId);
      await assertManager(dependencies.projects, orgId, body.managerEmployeeId);
      if (body.code) {
        const existing = await dependencies.projects.findByCode(orgId, body.code);
        if (existing && existing.id !== id) throw new AppError(409, "CONFLICT", "This code is already in use", { code: "Already in use" });
      }
      const startDate = body.startDate ?? current.startDate;
      const dueDate = body.dueDate ?? current.dueDate;
      if (dueDate < startDate) {
        throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { dueDate: "Due date must be on or after the start date" });
      }
      const updated = await dependencies.projects.update(orgId, id, body);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Project not found"));
        return;
      }
      res.status(200).json({ data: presentProject(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
