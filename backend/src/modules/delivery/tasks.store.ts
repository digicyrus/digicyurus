import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { employees, tasks, users } from "../../db/schema/index.js";
import { containsPattern, isPriority, isTaskStatus, type Priority, type TaskStatus } from "./constants.js";
import type { TaskListQuery, UpdateTaskBody } from "./tasks.schema.js";

export type TaskRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  assigneeEmployeeId: string | null;
  assigneeUserId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewTask = Omit<TaskRecord, "id" | "createdAt" | "updatedAt">;

export type TaskStore = {
  list(organizationId: string, query: TaskListQuery): Promise<{ items: TaskRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<TaskRecord | null>;
  findEmployee(organizationId: string, id: string): Promise<{ id: string } | null>;
  findUser(organizationId: string, id: string): Promise<{ id: string } | null>;
  insert(input: NewTask): Promise<TaskRecord>;
  update(organizationId: string, id: string, patch: UpdateTaskBody): Promise<TaskRecord | null>;
};

function asTask(row: typeof tasks.$inferSelect): TaskRecord {
  if (!isTaskStatus(row.status)) throw new Error("Stored task status is invalid");
  if (!isPriority(row.priority)) throw new Error("Stored task priority is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    assigneeEmployeeId: row.assigneeEmployeeId,
    assigneeUserId: row.assigneeUserId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function taskWhere(organizationId: string, query: TaskListQuery): SQL | undefined {
  const filters: SQL[] = [eq(tasks.organizationId, organizationId)];
  if (query.projectId) filters.push(eq(tasks.projectId, query.projectId));
  if (query.assigneeEmployeeId) filters.push(eq(tasks.assigneeEmployeeId, query.assigneeEmployeeId));
  if (query.assigneeUserId) filters.push(eq(tasks.assigneeUserId, query.assigneeUserId));
  if (query.status) filters.push(eq(tasks.status, query.status));
  if (query.priority) filters.push(eq(tasks.priority, query.priority));
  if (query.dueFrom) filters.push(gte(tasks.dueDate, query.dueFrom));
  if (query.dueTo) filters.push(lte(tasks.dueDate, query.dueTo));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${tasks.title} ilike ${pattern} escape '\\'
      or ${tasks.description} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function taskOrder(query: TaskListQuery) {
  const column = {
    title: tasks.title,
    status: tasks.status,
    priority: tasks.priority,
    dueDate: tasks.dueDate,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(tasks.id) : asc(tasks.id);
  return [primary, tie];
}

export function createDrizzleTaskStore(database: Database): TaskStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = taskWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(tasks).where(where);
      const rows = await db
        .select()
        .from(tasks)
        .where(where)
        .orderBy(...taskOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asTask), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.organizationId, organizationId), eq(tasks.id, id)))
        .limit(1);
      return row ? asTask(row) : null;
    },
    async findEmployee(organizationId, id) {
      const [row] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.organizationId, organizationId), eq(employees.id, id)))
        .limit(1);
      return row ?? null;
    },
    async findUser(organizationId, id) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.organizationId, organizationId), eq(users.id, id)))
        .limit(1);
      return row ?? null;
    },
    async insert(input) {
      const [row] = await db.insert(tasks).values(input).returning();
      if (!row) throw new Error("Insert did not return a row");
      return asTask(row);
    },
    async update(organizationId, id, patch) {
      const [row] = await db
        .update(tasks)
        .set({
          ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
          ...(patch.assigneeEmployeeId !== undefined ? { assigneeEmployeeId: patch.assigneeEmployeeId } : {}),
          ...(patch.assigneeUserId !== undefined ? { assigneeUserId: patch.assigneeUserId } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.organizationId, organizationId), eq(tasks.id, id)))
        .returning();
      return row ? asTask(row) : null;
    },
  };
}
