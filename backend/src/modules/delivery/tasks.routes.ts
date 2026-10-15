import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { ProjectStore } from "./projects.store.js";
import { presentTask } from "./present.js";
import { createTaskBody, taskIdParams, taskListQuery, updateTaskBody, type CreateTaskBody, type TaskListQuery, type UpdateTaskBody } from "./tasks.schema.js";
import type { TaskStore } from "./tasks.store.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function assertProject(projects: ProjectStore, orgId: string, projectId: string | undefined): Promise<void> {
  if (!projectId) return;
  const project = await projects.find(orgId, projectId);
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
}

async function assertAssignees(tasks: TaskStore, orgId: string, employeeId: string | null | undefined, userId: string | null | undefined): Promise<void> {
  if (employeeId) {
    const employee = await tasks.findEmployee(orgId, employeeId);
    if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");
  }
  if (userId) {
    const user = await tasks.findUser(orgId, userId);
    if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
  }
}

export function createTaskRouter(dependencies: { authStore: AuthStore; projects: ProjectStore; tasks: TaskStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/tasks", session, requirePermission("tasks:view"), validateQuery(taskListQuery), async (req, res, next) => {
    try {
      const query = readQuery<TaskListQuery>(res);
      const result = await dependencies.tasks.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentTask),
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

  router.get("/api/tasks/:id", session, requirePermission("tasks:view"), validateParams(taskIdParams), async (req, res, next) => {
    try {
      const task = await dependencies.tasks.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!task) {
        next(new AppError(404, "NOT_FOUND", "Task not found"));
        return;
      }
      res.status(200).json({ data: presentTask(task), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/tasks", session, requirePermission("tasks:create"), validateBody(createTaskBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as CreateTaskBody;
      await assertProject(dependencies.projects, orgId, body.projectId);
      await assertAssignees(dependencies.tasks, orgId, body.assigneeEmployeeId, body.assigneeUserId);
      const created = await dependencies.tasks.insert({
        organizationId: orgId,
        projectId: body.projectId,
        assigneeEmployeeId: body.assigneeEmployeeId ?? null,
        assigneeUserId: body.assigneeUserId ?? null,
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate ?? null,
      });
      res.status(201).json({ data: presentTask(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/tasks/:id", session, requirePermission("tasks:update"), validateParams(taskIdParams), validateBody(updateTaskBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const current = await dependencies.tasks.find(orgId, id);
      if (!current) {
        next(new AppError(404, "NOT_FOUND", "Task not found"));
        return;
      }
      const body = req.body as UpdateTaskBody;
      await assertProject(dependencies.projects, orgId, body.projectId);
      await assertAssignees(dependencies.tasks, orgId, body.assigneeEmployeeId, body.assigneeUserId);
      const updated = await dependencies.tasks.update(orgId, id, body);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Task not found"));
        return;
      }
      res.status(200).json({ data: presentTask(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
