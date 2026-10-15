import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { attendance } from "../../db/schema/index.js";
import { rethrowConstraint } from "./conflicts.js";
import type { AttendanceListQuery, UpdateAttendanceBody } from "./attendance.schema.js";

export type AttendanceRecord = {
  id: string;
  organizationId: string;
  employeeId: string;
  workDate: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewAttendance = {
  organizationId: string;
  employeeId: string;
  workDate: string;
  note: string | null;
};

export type AttendanceStore = {
  list(organizationId: string, query: AttendanceListQuery): Promise<{ items: AttendanceRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<AttendanceRecord | null>;
  findByEmployeeDate(organizationId: string, employeeId: string, workDate: string): Promise<AttendanceRecord | null>;
  insert(input: NewAttendance): Promise<AttendanceRecord>;
  update(organizationId: string, id: string, patch: UpdateAttendanceBody): Promise<AttendanceRecord | null>;
};

function asAttendance(row: typeof attendance.$inferSelect): AttendanceRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    employeeId: row.employeeId,
    workDate: row.workDate,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function attendanceWhere(organizationId: string, query: AttendanceListQuery): SQL | undefined {
  const filters: SQL[] = [eq(attendance.organizationId, organizationId)];
  if (query.employeeId) filters.push(eq(attendance.employeeId, query.employeeId));
  if (query.from) filters.push(gte(attendance.workDate, query.from));
  if (query.to) filters.push(lte(attendance.workDate, query.to));
  return and(...filters);
}

function attendanceOrder(query: AttendanceListQuery) {
  const column = query.sort === "employee" ? attendance.employeeId : attendance.workDate;
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(attendance.id) : asc(attendance.id);
  return [primary, tie];
}

export function createDrizzleAttendanceStore(database: Database): AttendanceStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = attendanceWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(attendance).where(where);
      const rows = await db
        .select()
        .from(attendance)
        .where(where)
        .orderBy(...attendanceOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asAttendance), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(attendance).where(and(eq(attendance.organizationId, organizationId), eq(attendance.id, id))).limit(1);
      return row ? asAttendance(row) : null;
    },
    async findByEmployeeDate(organizationId, employeeId, workDate) {
      const [row] = await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.organizationId, organizationId), eq(attendance.employeeId, employeeId), eq(attendance.workDate, workDate)))
        .limit(1);
      return row ? asAttendance(row) : null;
    },
    async insert(input) {
      try {
        const [row] = await db.insert(attendance).values(input).returning();
        if (!row) throw new Error("Insert did not return a row");
        return asAttendance(row);
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch) {
      try {
        const [row] = await db.update(attendance).set({
          ...(patch.employeeId !== undefined ? { employeeId: patch.employeeId } : {}),
          ...(patch.date !== undefined ? { workDate: patch.date } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          updatedAt: new Date(),
        }).where(and(eq(attendance.organizationId, organizationId), eq(attendance.id, id))).returning();
        return row ? asAttendance(row) : null;
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
