import { z } from "zod";

import { PRIORITIES, TASK_SORTS, TASK_STATUSES } from "./constants.js";
import { dateOnly, idParams, requiredText } from "./fields.js";

export const taskIdParams = idParams;

export const taskListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    projectId: z.uuid("Enter a valid id").optional(),
    assigneeEmployeeId: z.uuid("Enter a valid id").optional(),
    assigneeUserId: z.uuid("Enter a valid id").optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueFrom: dateOnly.optional(),
    dueTo: dateOnly.optional(),
    sort: z.enum(TASK_SORTS).default("dueDate"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => !value.dueFrom || !value.dueTo || value.dueFrom <= value.dueTo, {
    path: ["dueTo"],
    message: "End date must be on or after the start date",
  });

const taskFields = {
  projectId: z.uuid("Enter a valid id"),
  title: requiredText(200),
  description: z.string().trim().max(4000).default(""),
  status: z.enum(TASK_STATUSES).default("Backlog"),
  priority: z.enum(PRIORITIES).default("Medium"),
  dueDate: dateOnly.nullish(),
  assigneeEmployeeId: z.uuid("Enter a valid id").nullish(),
  assigneeUserId: z.uuid("Enter a valid id").nullish(),
};

export const createTaskBody = z.object(taskFields);

export const updateTaskBody = z.object({
  projectId: taskFields.projectId.optional(),
  title: taskFields.title.optional(),
  description: z.string().trim().max(4000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: dateOnly.nullable().optional(),
  assigneeEmployeeId: z.uuid("Enter a valid id").nullable().optional(),
  assigneeUserId: z.uuid("Enter a valid id").nullable().optional(),
});

export type TaskListQuery = z.infer<typeof taskListQuery>;
export type CreateTaskBody = z.infer<typeof createTaskBody>;
export type UpdateTaskBody = z.infer<typeof updateTaskBody>;
