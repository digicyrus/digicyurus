import { z } from "zod";

import { clockTime, dateOnly, idParams, requiredText } from "./fields.js";

export const plannerIdParams = idParams;

export const plannerListQuery = z
  .object({
    from: dateOnly,
    to: dateOnly,
  })
  .refine((value) => value.from <= value.to, {
    path: ["to"],
    message: "End date must be on or after the start date",
  });

const plannerFields = {
  title: requiredText(200),
  entryDate: dateOnly,
  time: clockTime.nullish(),
  done: z.boolean().default(false),
  tag: z.string().trim().min(1).max(80).nullish(),
};

export const createPlannerBody = z.object(plannerFields);

export const updatePlannerBody = z.object({
  title: plannerFields.title.optional(),
  entryDate: dateOnly.optional(),
  time: clockTime.nullable().optional(),
  done: z.boolean().optional(),
  tag: z.string().trim().min(1).max(80).nullable().optional(),
});

export type PlannerListQuery = z.infer<typeof plannerListQuery>;
export type CreatePlannerBody = z.infer<typeof createPlannerBody>;
export type UpdatePlannerBody = z.infer<typeof updatePlannerBody>;
