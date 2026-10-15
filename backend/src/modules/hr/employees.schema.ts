import { z } from "zod";

import { EMPLOYEE_SORTS } from "./constants.js";
import { idParams, requiredText } from "./fields.js";

export const employeeIdParams = idParams;

const salary = z.number().int().min(0).max(10_000_000);
const email = z.email("Enter a valid email");

export const employeeListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  department: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(EMPLOYEE_SORTS).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export const createEmployeeBody = z.object({
  code: requiredText(40),
  name: requiredText(200),
  jobTitle: requiredText(120),
  department: requiredText(120),
  email: email.optional(),
  salary: salary,
});

export const updateEmployeeBody = z.object({
  code: requiredText(40).optional(),
  name: requiredText(200).optional(),
  jobTitle: requiredText(120).optional(),
  department: requiredText(120).optional(),
  email: z.union([email, z.null()]).optional(),
  salary: salary.optional(),
});

export type EmployeeListQuery = z.infer<typeof employeeListQuery>;
export type CreateEmployeeBody = z.infer<typeof createEmployeeBody>;
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBody>;
