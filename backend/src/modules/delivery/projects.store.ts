import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { employees, projects } from "../../db/schema/index.js";
import { rethrowConstraint } from "./conflicts.js";
import { containsPattern, isPriority, isProjectStatus, type Priority, type ProjectStatus } from "./constants.js";
import type { ProjectListQuery, UpdateProjectBody } from "./projects.schema.js";

export type ProjectRecord = {
  id: string;
  organizationId: string;
  clientId: string;
  managerEmployeeId: string | null;
  code: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  dueDate: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProject = Omit<ProjectRecord, "id" | "createdAt" | "updatedAt">;

export type ProjectStore = {
  list(organizationId: string, query: ProjectListQuery): Promise<{ items: ProjectRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<ProjectRecord | null>;
  findByCode(organizationId: string, code: string): Promise<ProjectRecord | null>;
  findEmployee(organizationId: string, id: string): Promise<{ id: string } | null>;
  insert(input: NewProject): Promise<ProjectRecord>;
  update(organizationId: string, id: string, patch: UpdateProjectBody): Promise<ProjectRecord | null>;
};

function asProject(row: typeof projects.$inferSelect): ProjectRecord {
  if (!isProjectStatus(row.status)) throw new Error("Stored project status is invalid");
  if (!isPriority(row.priority)) throw new Error("Stored project priority is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    managerEmployeeId: row.managerEmployeeId,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startDate: row.startDate,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function projectWhere(organizationId: string, query: ProjectListQuery): SQL | undefined {
  const filters: SQL[] = [eq(projects.organizationId, organizationId)];
  if (query.status) filters.push(eq(projects.status, query.status));
  if (query.priority) filters.push(eq(projects.priority, query.priority));
  if (query.clientId) filters.push(eq(projects.clientId, query.clientId));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${projects.name} ilike ${pattern} escape '\\'
      or ${projects.code} ilike ${pattern} escape '\\'
      or ${projects.description} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function projectOrder(query: ProjectListQuery) {
  const column = {
    name: projects.name,
    code: projects.code,
    status: projects.status,
    priority: projects.priority,
    startDate: projects.startDate,
    dueDate: projects.dueDate,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(projects.id) : asc(projects.id);
  return [primary, tie];
}

export function createDrizzleProjectStore(database: Database): ProjectStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = projectWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(projects).where(where);
      const rows = await db
        .select()
        .from(projects)
        .where(where)
        .orderBy(...projectOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asProject), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.id, id)))
        .limit(1);
      return row ? asProject(row) : null;
    },
    async findByCode(organizationId, code) {
      const [row] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, organizationId), eq(projects.code, code)))
        .limit(1);
      return row ? asProject(row) : null;
    },
    async findEmployee(organizationId, id) {
      const [row] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.organizationId, organizationId), eq(employees.id, id)))
        .limit(1);
      return row ?? null;
    },
    async insert(input) {
      try {
        const [row] = await db.insert(projects).values(input).returning();
        if (!row) throw new Error("Insert did not return a row");
        return asProject(row);
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch) {
      try {
        const [row] = await db
          .update(projects)
          .set({
            ...(patch.code !== undefined ? { code: patch.code } : {}),
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
            ...(patch.managerEmployeeId !== undefined ? { managerEmployeeId: patch.managerEmployeeId } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
            ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
            ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(projects.organizationId, organizationId), eq(projects.id, id)))
          .returning();
        return row ? asProject(row) : null;
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
