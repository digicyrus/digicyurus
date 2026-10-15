import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { employees } from "../../db/schema/index.js";
import { rupeesToPaise } from "../crm/constants.js";
import { rethrowConstraint } from "./conflicts.js";
import { containsPattern } from "./constants.js";
import type { EmployeeListQuery, UpdateEmployeeBody } from "./employees.schema.js";

export type EmployeeRecord = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  jobTitle: string;
  department: string;
  email: string | null;
  salaryPaise: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewEmployee = {
  organizationId: string;
  code: string;
  name: string;
  jobTitle: string;
  department: string;
  email: string | null;
  salaryRupees: number;
};

export type EmployeeStore = {
  list(organizationId: string, query: EmployeeListQuery): Promise<{ items: EmployeeRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<EmployeeRecord | null>;
  findByCode(organizationId: string, code: string): Promise<EmployeeRecord | null>;
  findByEmail(organizationId: string, email: string): Promise<EmployeeRecord | null>;
  insert(input: NewEmployee): Promise<EmployeeRecord>;
  update(organizationId: string, id: string, patch: UpdateEmployeeBody): Promise<EmployeeRecord | null>;
};

function asEmployee(row: typeof employees.$inferSelect): EmployeeRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    jobTitle: row.jobTitle,
    department: row.department,
    email: row.email,
    salaryPaise: row.salaryPaise,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function employeeWhere(organizationId: string, query: EmployeeListQuery): SQL | undefined {
  const filters: SQL[] = [eq(employees.organizationId, organizationId)];
  if (query.department) filters.push(sql`lower(${employees.department}) = ${query.department.toLowerCase()}`);
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${employees.name} ilike ${pattern} escape '\\'
      or ${employees.code} ilike ${pattern} escape '\\'
      or ${employees.jobTitle} ilike ${pattern} escape '\\'
      or ${employees.department} ilike ${pattern} escape '\\'
      or ${employees.email} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function employeeOrder(query: EmployeeListQuery) {
  const column = {
    name: employees.name,
    code: employees.code,
    jobTitle: employees.jobTitle,
    department: employees.department,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(employees.id) : asc(employees.id);
  return [primary, tie];
}

export function createDrizzleEmployeeStore(database: Database): EmployeeStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = employeeWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(employees).where(where);
      const rows = await db
        .select()
        .from(employees)
        .where(where)
        .orderBy(...employeeOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asEmployee), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(employees).where(and(eq(employees.organizationId, organizationId), eq(employees.id, id))).limit(1);
      return row ? asEmployee(row) : null;
    },
    async findByCode(organizationId, code) {
      const [row] = await db.select().from(employees).where(and(eq(employees.organizationId, organizationId), eq(employees.code, code))).limit(1);
      return row ? asEmployee(row) : null;
    },
    async findByEmail(organizationId, email) {
      const [row] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.organizationId, organizationId), sql`lower(${employees.email}) = ${email.toLowerCase()}`))
        .limit(1);
      return row ? asEmployee(row) : null;
    },
    async insert(input) {
      try {
        const [row] = await db.insert(employees).values({
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          jobTitle: input.jobTitle,
          department: input.department,
          email: input.email,
          salaryPaise: rupeesToPaise(input.salaryRupees),
        }).returning();
        if (!row) throw new Error("Insert did not return a row");
        return asEmployee(row);
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch) {
      try {
        const [row] = await db.update(employees).set({
          ...(patch.code !== undefined ? { code: patch.code } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.jobTitle !== undefined ? { jobTitle: patch.jobTitle } : {}),
          ...(patch.department !== undefined ? { department: patch.department } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(patch.salary !== undefined ? { salaryPaise: rupeesToPaise(patch.salary) } : {}),
          updatedAt: new Date(),
        }).where(and(eq(employees.organizationId, organizationId), eq(employees.id, id))).returning();
        return row ? asEmployee(row) : null;
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
