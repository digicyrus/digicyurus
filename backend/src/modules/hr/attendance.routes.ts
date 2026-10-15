import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import { createAttendanceBody, attendanceIdParams, attendanceListQuery, updateAttendanceBody, type AttendanceListQuery, type CreateAttendanceBody, type UpdateAttendanceBody } from "./attendance.schema.js";
import type { AttendanceStore } from "./attendance.store.js";
import type { EmployeeStore } from "./employees.store.js";
import { presentAttendance } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function assertEmployee(employees: EmployeeStore, orgId: string, employeeId: string): Promise<void> {
  const employee = await employees.find(orgId, employeeId);
  if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");
}

async function rejectDuplicate(attendance: AttendanceStore, orgId: string, employeeId: string, date: string, currentId?: string): Promise<void> {
  const existing = await attendance.findByEmployeeDate(orgId, employeeId, date);
  if (existing && existing.id !== currentId) {
    throw new AppError(409, "CONFLICT", "Attendance for this employee and date already exists", { date: "Already recorded" });
  }
}

export function createAttendanceRouter(dependencies: { authStore: AuthStore; employees: EmployeeStore; attendance: AttendanceStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);
  const view = [session, requirePermission("attendance:view")] as const;

  router.get("/api/attendance", ...view, validateQuery(attendanceListQuery), async (req, res, next) => {
    try {
      const query = readQuery<AttendanceListQuery>(res);
      const result = await dependencies.attendance.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentAttendance),
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

  router.get("/api/attendance/:id", ...view, validateParams(attendanceIdParams), async (req, res, next) => {
    try {
      const record = await dependencies.attendance.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!record) {
        next(new AppError(404, "NOT_FOUND", "Attendance record not found"));
        return;
      }
      res.status(200).json({ data: presentAttendance(record), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/attendance", ...view, validateBody(createAttendanceBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as CreateAttendanceBody;
      await assertEmployee(dependencies.employees, orgId, body.employeeId);
      await rejectDuplicate(dependencies.attendance, orgId, body.employeeId, body.date);
      const created = await dependencies.attendance.insert({
        organizationId: orgId,
        employeeId: body.employeeId,
        workDate: body.date,
        note: body.note ?? null,
      });
      res.status(201).json({ data: presentAttendance(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/attendance/:id", ...view, validateParams(attendanceIdParams), validateBody(updateAttendanceBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const current = await dependencies.attendance.find(orgId, id);
      if (!current) {
        next(new AppError(404, "NOT_FOUND", "Attendance record not found"));
        return;
      }
      const body = req.body as UpdateAttendanceBody;
      const employeeId = body.employeeId ?? current.employeeId;
      const date = body.date ?? current.workDate;
      if (body.employeeId) await assertEmployee(dependencies.employees, orgId, body.employeeId);
      await rejectDuplicate(dependencies.attendance, orgId, employeeId, date, id);
      const updated = await dependencies.attendance.update(orgId, id, body);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Attendance record not found"));
        return;
      }
      res.status(200).json({ data: presentAttendance(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
