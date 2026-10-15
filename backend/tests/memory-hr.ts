import { randomUUID } from "node:crypto";

import { rupeesToPaise } from "../src/modules/crm/constants.js";
import type { AttendanceListQuery, UpdateAttendanceBody } from "../src/modules/hr/attendance.schema.js";
import type { AttendanceRecord, AttendanceStore, NewAttendance } from "../src/modules/hr/attendance.store.js";
import type { EmployeeListQuery, UpdateEmployeeBody } from "../src/modules/hr/employees.schema.js";
import type { EmployeeRecord, EmployeeStore, NewEmployee } from "../src/modules/hr/employees.store.js";

function paginate<T>(items: T[], page: number, pageSize: number) {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
}

function compare(left: string | number, right: string | number, direction: "asc" | "desc"): number {
  const result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  return direction === "desc" ? -result : result;
}

function includes(search: string | undefined, values: Array<string | null>): boolean {
  if (!search) return true;
  return values.filter((value) => value !== null).join("\n").toLowerCase().includes(search.toLowerCase());
}

export function createMemoryEmployeeStore(): EmployeeStore & { records: EmployeeRecord[] } {
  const records: EmployeeRecord[] = [];
  return {
    records,
    async list(organizationId, query: EmployeeListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.department ? record.department.toLowerCase() === query.department.toLowerCase() : true))
        .filter((record) => includes(query.search, [record.name, record.code, record.jobTitle, record.department, record.email]))
        .sort((left, right) => {
          const value = {
            name: [left.name, right.name],
            code: [left.code, right.code],
            jobTitle: [left.jobTitle, right.jobTitle],
            department: [left.department, right.department],
          }[query.sort];
          const primary = compare(value[0], value[1], query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findByCode(organizationId, code) {
      return records.find((record) => record.organizationId === organizationId && record.code === code) ?? null;
    },
    async findByEmail(organizationId, email) {
      return records.find((record) => record.organizationId === organizationId && record.email?.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async insert(input: NewEmployee) {
      const now = new Date();
      const record: EmployeeRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        code: input.code,
        name: input.name,
        jobTitle: input.jobTitle,
        department: input.department,
        email: input.email,
        salaryPaise: rupeesToPaise(input.salaryRupees),
        createdAt: now,
        updatedAt: now,
      };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch: UpdateEmployeeBody) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.code !== undefined) record.code = patch.code;
      if (patch.name !== undefined) record.name = patch.name;
      if (patch.jobTitle !== undefined) record.jobTitle = patch.jobTitle;
      if (patch.department !== undefined) record.department = patch.department;
      if (patch.email !== undefined) record.email = patch.email;
      if (patch.salary !== undefined) record.salaryPaise = rupeesToPaise(patch.salary);
      record.updatedAt = new Date();
      return record;
    },
  };
}

export function createMemoryAttendanceStore(): AttendanceStore & { records: AttendanceRecord[] } {
  const records: AttendanceRecord[] = [];
  return {
    records,
    async list(organizationId, query: AttendanceListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.employeeId ? record.employeeId === query.employeeId : true))
        .filter((record) => (query.from ? record.workDate >= query.from : true))
        .filter((record) => (query.to ? record.workDate <= query.to : true))
        .sort((left, right) => {
          const value = query.sort === "employee" ? [left.employeeId, right.employeeId] : [left.workDate, right.workDate];
          const primary = compare(value[0], value[1], query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findByEmployeeDate(organizationId, employeeId, workDate) {
      return records.find((record) => record.organizationId === organizationId && record.employeeId === employeeId && record.workDate === workDate) ?? null;
    },
    async insert(input: NewAttendance) {
      const now = new Date();
      const record: AttendanceRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch: UpdateAttendanceBody) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.employeeId !== undefined) record.employeeId = patch.employeeId;
      if (patch.date !== undefined) record.workDate = patch.date;
      if (patch.note !== undefined) record.note = patch.note;
      record.updatedAt = new Date();
      return record;
    },
  };
}
