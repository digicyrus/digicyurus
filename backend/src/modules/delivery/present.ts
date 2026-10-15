import type { PlannerRecord } from "./planner.store.js";
import type { ProjectRecord } from "./projects.store.js";
import type { TaskRecord } from "./tasks.store.js";

export function presentProject(record: ProjectRecord) {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    clientId: record.clientId,
    managerEmployeeId: record.managerEmployeeId,
    status: record.status,
    priority: record.priority,
    startDate: record.startDate,
    dueDate: record.dueDate,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentTask(record: TaskRecord) {
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    description: record.description,
    status: record.status,
    priority: record.priority,
    dueDate: record.dueDate,
    assigneeEmployeeId: record.assigneeEmployeeId,
    assigneeUserId: record.assigneeUserId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentPlannerEntry(record: PlannerRecord) {
  return {
    id: record.id,
    title: record.title,
    entryDate: record.entryDate,
    time: record.timeOfDay,
    done: record.done,
    tag: record.tag,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
