import { z } from "zod";

import { EXPENSE_SORTS } from "./constants.js";
import { dateOnly, idParams, requiredText } from "./fields.js";

export const expenseIdParams = idParams;

export const expenseListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    category: z.string().trim().min(1).max(120).optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    sort: z.enum(EXPENSE_SORTS).default("date"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "End date must be on or after the start date",
  });

const expenseFields = {
  category: requiredText(120),
  vendor: z.string().trim().min(1).max(200).nullish(),
  description: z.string().trim().max(4000).default(""),
  amount: z.number().int().min(0).max(10_000_000),
  date: dateOnly,
};

export const createExpenseBody = z.object(expenseFields);

export const updateExpenseBody = z.object({
  category: expenseFields.category.optional(),
  vendor: z.string().trim().min(1).max(200).nullable().optional(),
  description: z.string().trim().max(4000).optional(),
  amount: expenseFields.amount.optional(),
  date: dateOnly.optional(),
});

export type ExpenseListQuery = z.infer<typeof expenseListQuery>;
export type CreateExpenseBody = z.infer<typeof createExpenseBody>;
export type UpdateExpenseBody = z.infer<typeof updateExpenseBody>;
