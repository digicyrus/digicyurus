import { z } from "zod";

import { PRIORITIES, PROJECT_SORTS, PROJECT_STATUSES } from "./constants.js";
import { dateOnly, idParams, requiredText } from "./fields.js";

export const projectIdParams = idParams;

export const projectListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  clientId: z.uuid("Enter a valid id").optional(),
  sort: z.enum(PROJECT_SORTS).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

const projectFields = {
  code: requiredText(40),
  name: requiredText(200),
  description: z.string().trim().max(4000).default(""),
  clientId: z.uuid("Enter a valid id"),
  managerEmployeeId: z.uuid("Enter a valid id").nullish(),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(PRIORITIES).default("Medium"),
  startDate: dateOnly,
  dueDate: dateOnly,
};

export const createProjectBody = z.object(projectFields).refine((value) => value.dueDate >= value.startDate, {
  path: ["dueDate"],
  message: "Due date must be on or after the start date",
});

export const updateProjectBody = z.object({
  code: projectFields.code.optional(),
  name: projectFields.name.optional(),
  description: z.string().trim().max(4000).optional(),
  clientId: projectFields.clientId.optional(),
  managerEmployeeId: z.uuid("Enter a valid id").nullable().optional(),
  status: projectFields.status.optional(),
  priority: z.enum(PRIORITIES).optional(),
  startDate: dateOnly.optional(),
  dueDate: dateOnly.optional(),
});

export type ProjectListQuery = z.infer<typeof projectListQuery>;
export type CreateProjectBody = z.infer<typeof createProjectBody>;
export type UpdateProjectBody = z.infer<typeof updateProjectBody>;
