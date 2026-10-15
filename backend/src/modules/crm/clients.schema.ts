import { z } from "zod";

import { CLIENT_SORTS, CLIENT_STATUSES } from "./constants.js";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return date.getUTCFullYear() === year && date.getUTCMonth() === (month ?? 0) - 1 && date.getUTCDate() === day;
}, "Enter a valid date");

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalEmail = z.email("Enter a valid email").optional();
const optionalPhone = z.string().trim().min(1).max(32).optional();

export const clientIdParams = z.object({
  id: z.uuid("Enter a valid id"),
});

export const clientListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  industry: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(CLIENT_SORTS).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export const createClientBody = z.object({
  code: requiredText(40),
  name: requiredText(200),
  contactName: requiredText(200),
  industry: requiredText(120),
  status: z.enum(CLIENT_STATUSES),
  rating: z.number().int().min(1).max(5),
  customerSince: dateOnly,
  email: optionalEmail,
  phone: optionalPhone,
});

export const updateClientBody = z.object({
  code: requiredText(40).optional(),
  name: requiredText(200).optional(),
  contactName: requiredText(200).optional(),
  industry: requiredText(120).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  customerSince: dateOnly.optional(),
  email: z.union([z.email("Enter a valid email"), z.null()]).optional(),
  phone: z.union([z.string().trim().min(1).max(32), z.null()]).optional(),
});

export type ClientListQuery = z.infer<typeof clientListQuery>;
export type CreateClientBody = z.infer<typeof createClientBody>;
export type UpdateClientBody = z.infer<typeof updateClientBody>;
