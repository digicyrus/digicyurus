import { randomUUID } from "node:crypto";

import type { PlannerListQuery, UpdatePlannerBody } from "../src/modules/delivery/planner.schema.js";
import type { NewPlannerEntry, PlannerRecord, PlannerStore } from "../src/modules/delivery/planner.store.js";
import type { ProjectListQuery, UpdateProjectBody } from "../src/modules/delivery/projects.schema.js";
import type { NewProject, ProjectRecord, ProjectStore } from "../src/modules/delivery/projects.store.js";
import type { TaskListQuery, UpdateTaskBody } from "../src/modules/delivery/tasks.schema.js";
import type { NewTask, TaskRecord, TaskStore } from "../src/modules/delivery/tasks.store.js";

function paginate<T>(items: T[], page: number, pageSize: number) {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
}

function compare(left: string | number, right: string | number, direction: "asc" | "desc"): number {
  const result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  return direction === "desc" ? -result : result;
}

function compareNullable(left: string | null, right: string | null, direction: "asc" | "desc"): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compare(left, right, direction);
}

function includes(search: string | undefined, values: string[]): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return values.join("\n").toLowerCase().includes(needle);
}

export function createMemoryProjectStore(): ProjectStore & { records: ProjectRecord[]; employees: { id: string; organizationId: string }[] } {
  const records: ProjectRecord[] = [];
  const employees: { id: string; organizationId: string }[] = [];
  return {
    records,
    employees,
    async list(organizationId, query: ProjectListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.status ? record.status === query.status : true))
        .filter((record) => (query.priority ? record.priority === query.priority : true))
        .filter((record) => (query.clientId ? record.clientId === query.clientId : true))
        .filter((record) => includes(query.search, [record.name, record.code, record.description]))
        .sort((left, right) => {
          const value = {
            name: [left.name, right.name],
            code: [left.code, right.code],
            status: [left.status, right.status],
            priority: [left.priority, right.priority],
            startDate: [left.startDate, right.startDate],
            dueDate: [left.dueDate, right.dueDate],
          }[query.sort] as [string, string];
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
    async findEmployee(organizationId, id) {
      return employees.find((employee) => employee.organizationId === organizationId && employee.id === id) ?? null;
    },
    async insert(input: NewProject) {
      const now = new Date();
      const record: ProjectRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch: UpdateProjectBody) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.code !== undefined) record.code = patch.code;
      if (patch.name !== undefined) record.name = patch.name;
      if (patch.description !== undefined) record.description = patch.description;
      if (patch.clientId !== undefined) record.clientId = patch.clientId;
      if (patch.managerEmployeeId !== undefined) record.managerEmployeeId = patch.managerEmployeeId;
      if (patch.status !== undefined) record.status = patch.status;
      if (patch.priority !== undefined) record.priority = patch.priority;
      if (patch.startDate !== undefined) record.startDate = patch.startDate;
      if (patch.dueDate !== undefined) record.dueDate = patch.dueDate;
      record.updatedAt = new Date();
      return record;
    },
  };
}

export function createMemoryTaskStore(): TaskStore & {
  records: TaskRecord[];
  employees: { id: string; organizationId: string }[];
  users: { id: string; organizationId: string }[];
} {
  const records: TaskRecord[] = [];
  const employees: { id: string; organizationId: string }[] = [];
  const users: { id: string; organizationId: string }[] = [];
  return {
    records,
    employees,
    users,
    async list(organizationId, query: TaskListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.projectId ? record.projectId === query.projectId : true))
        .filter((record) => (query.assigneeEmployeeId ? record.assigneeEmployeeId === query.assigneeEmployeeId : true))
        .filter((record) => (query.assigneeUserId ? record.assigneeUserId === query.assigneeUserId : true))
        .filter((record) => (query.status ? record.status === query.status : true))
        .filter((record) => (query.priority ? record.priority === query.priority : true))
        .filter((record) => (query.dueFrom ? record.dueDate !== null && record.dueDate >= query.dueFrom : true))
        .filter((record) => (query.dueTo ? record.dueDate !== null && record.dueDate <= query.dueTo : true))
        .filter((record) => includes(query.search, [record.title, record.description]))
        .sort((left, right) => {
          const primary = query.sort === "dueDate"
            ? compareNullable(left.dueDate, right.dueDate, query.direction)
            : compare(
              { title: left.title, status: left.status, priority: left.priority }[query.sort],
              { title: right.title, status: right.status, priority: right.priority }[query.sort],
              query.direction,
            );
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findEmployee(organizationId, id) {
      return employees.find((employee) => employee.organizationId === organizationId && employee.id === id) ?? null;
    },
    async findUser(organizationId, id) {
      return users.find((user) => user.organizationId === organizationId && user.id === id) ?? null;
    },
    async insert(input: NewTask) {
      const now = new Date();
      const record: TaskRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch: UpdateTaskBody) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.projectId !== undefined) record.projectId = patch.projectId;
      if (patch.title !== undefined) record.title = patch.title;
      if (patch.description !== undefined) record.description = patch.description;
      if (patch.status !== undefined) record.status = patch.status;
      if (patch.priority !== undefined) record.priority = patch.priority;
      if (patch.dueDate !== undefined) record.dueDate = patch.dueDate;
      if (patch.assigneeEmployeeId !== undefined) record.assigneeEmployeeId = patch.assigneeEmployeeId;
      if (patch.assigneeUserId !== undefined) record.assigneeUserId = patch.assigneeUserId;
      record.updatedAt = new Date();
      return record;
    },
  };
}

export function createMemoryPlannerStore(): PlannerStore & { records: PlannerRecord[] } {
  const records: PlannerRecord[] = [];
  return {
    records,
    async list(organizationId, userId, query: PlannerListQuery) {
      return records
        .filter((record) => record.organizationId === organizationId && record.userId === userId)
        .filter((record) => record.entryDate >= query.from && record.entryDate <= query.to)
        .sort((left, right) => {
          const byDate = compare(left.entryDate, right.entryDate, "asc");
          if (byDate !== 0) return byDate;
          const byTime = compareNullable(left.timeOfDay, right.timeOfDay, "asc");
          return byTime === 0 ? compare(left.id, right.id, "asc") : byTime;
        });
    },
    async find(organizationId, userId, id) {
      return records.find((record) => record.organizationId === organizationId && record.userId === userId && record.id === id) ?? null;
    },
    async insert(input: NewPlannerEntry) {
      const now = new Date();
      const record: PlannerRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      records.push(record);
      return record;
    },
    async update(organizationId, userId, id, patch: UpdatePlannerBody) {
      const record = records.find((item) => item.organizationId === organizationId && item.userId === userId && item.id === id);
      if (!record) return null;
      if (patch.title !== undefined) record.title = patch.title;
      if (patch.entryDate !== undefined) record.entryDate = patch.entryDate;
      if (patch.time !== undefined) record.timeOfDay = patch.time;
      if (patch.done !== undefined) record.done = patch.done;
      if (patch.tag !== undefined) record.tag = patch.tag;
      record.updatedAt = new Date();
      return record;
    },
  };
}
