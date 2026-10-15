import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import { createEmployeeBody, employeeIdParams, employeeListQuery, updateEmployeeBody, type CreateEmployeeBody, type EmployeeListQuery, type UpdateEmployeeBody } from "./employees.schema.js";
import type { EmployeeStore } from "./employees.store.js";
import { presentEmployee } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

function normalizeEmail(email: string | null | undefined): string | null | undefined {
  if (email === undefined) return undefined;
  if (email === null) return null;
  return email.toLowerCase();
}

async function rejectDuplicates(store: EmployeeStore, orgId: string, input: { code?: string; email?: string | null }, currentId?: string): Promise<void> {
  if (input.code) {
    const existing = await store.findByCode(orgId, input.code);
    if (existing && existing.id !== currentId) throw new AppError(409, "CONFLICT", "This code is already in use", { code: "Already in use" });
  }
  if (input.email) {
    const existing = await store.findByEmail(orgId, input.email);
    if (existing && existing.id !== currentId) throw new AppError(409, "CONFLICT", "This email is already in use", { email: "Already in use" });
  }
}

export function createEmployeeRouter(dependencies: { authStore: AuthStore; employees: EmployeeStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/employees", session, requirePermission("employees:view"), validateQuery(employeeListQuery), async (req, res, next) => {
    try {
      const query = readQuery<EmployeeListQuery>(res);
      const result = await dependencies.employees.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentEmployee),
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

  router.get("/api/employees/:id", session, requirePermission("employees:view"), validateParams(employeeIdParams), async (req, res, next) => {
    try {
      const employee = await dependencies.employees.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!employee) {
        next(new AppError(404, "NOT_FOUND", "Employee not found"));
        return;
      }
      res.status(200).json({ data: presentEmployee(employee), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/employees", session, requirePermission("employees:create"), validateBody(createEmployeeBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as CreateEmployeeBody;
      const email = normalizeEmail(body.email) ?? null;
      await rejectDuplicates(dependencies.employees, orgId, { code: body.code, email });
      const created = await dependencies.employees.insert({
        organizationId: orgId,
        code: body.code,
        name: body.name,
        jobTitle: body.jobTitle,
        department: body.department,
        email,
        salaryRupees: body.salary,
      });
      res.status(201).json({ data: presentEmployee(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/employees/:id", session, requirePermission("employees:update"), validateParams(employeeIdParams), validateBody(updateEmployeeBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const body = req.body as UpdateEmployeeBody;
      const email = normalizeEmail(body.email);
      await rejectDuplicates(dependencies.employees, orgId, { code: body.code, email }, id);
      const updated = await dependencies.employees.update(orgId, id, { ...body, email });
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Employee not found"));
        return;
      }
      res.status(200).json({ data: presentEmployee(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
