import { z } from "zod";

import { LEAD_PRIORITIES, LEAD_SORTS, LEAD_STAGES } from "./constants.js";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return date.getUTCFullYear() === year && date.getUTCMonth() === (month ?? 0) - 1 && date.getUTCDate() === day;
}, "Enter a valid date");

const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const leadIdParams = z.object({
  id: z.uuid("Enter a valid id"),
});

export const leadListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  source: z.string().trim().min(1).max(120).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  sort: z.enum(LEAD_SORTS).default("company"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

const leadFields = {
  code: requiredText(40),
  company: requiredText(200),
  person: requiredText(200),
  value: z.number().int().min(0).max(1_000_000_000),
  source: requiredText(120),
  priority: z.enum(LEAD_PRIORITIES),
  closing: dateOnly,
  probability: z.number().int().min(0).max(100),
};

export const createLeadBody = z.object(leadFields);

export const updateLeadBody = z.object({
  code: leadFields.code.optional(),
  company: leadFields.company.optional(),
  person: leadFields.person.optional(),
  value: leadFields.value.optional(),
  source: leadFields.source.optional(),
  priority: leadFields.priority.optional(),
  closing: leadFields.closing.optional(),
  probability: leadFields.probability.optional(),
});

export const moveLeadStageBody = z.object({
  stage: z.enum(LEAD_STAGES),
});

export type LeadListQuery = z.infer<typeof leadListQuery>;
export type CreateLeadBody = z.infer<typeof createLeadBody>;
export type UpdateLeadBody = z.infer<typeof updateLeadBody>;
