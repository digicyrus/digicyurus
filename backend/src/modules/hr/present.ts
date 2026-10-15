import { paiseToRupees } from "../crm/constants.js";
import type { AttendanceRecord } from "./attendance.store.js";
import type { EmployeeRecord } from "./employees.store.js";

export function presentEmployee(record: EmployeeRecord) {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    jobTitle: record.jobTitle,
    department: record.department,
    email: record.email,
    salary: record.salaryPaise === null ? null : paiseToRupees(record.salaryPaise),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentAttendance(record: AttendanceRecord) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    date: record.workDate,
    note: record.note,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
