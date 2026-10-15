import { z } from "zod";

import { OPPORTUNITY_SORTS, OPPORTUNITY_STAGES, SALES_PRIORITIES } from "./constants.js";
import { dateOnly, idParams, moneyRupees, optionalId, requiredText } from "./fields.js";

export const opportunityIdParams = idParams;

export const opportunityListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    stage: z.enum(OPPORTUNITY_STAGES).optional(),
    priority: z.enum(SALES_PRIORITIES).optional(),
    source: requiredText(80).optional(),
    clientId: z.uuid("Enter a valid id").optional(),
    leadId: z.uuid("Enter a valid id").optional(),
    ownerEmployeeId: z.uuid("Enter a valid id").optional(),
    expectedFrom: dateOnly.optional(),
    expectedTo: dateOnly.optional(),
    sort: z.enum(OPPORTUNITY_SORTS).default("reference"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => !value.expectedFrom || !value.expectedTo || value.expectedFrom <= value.expectedTo, {
    path: ["expectedTo"],
    message: "End date must be on or after the start date",
  });

const opportunityFields = {
  reference: requiredText(40),
  title: requiredText(200),
  clientId: optionalId,
  leadId: optionalId,
  ownerEmployeeId: optionalId,
  value: moneyRupees,
  expectedClose: dateOnly,
  source: requiredText(80),
  priority: z.enum(SALES_PRIORITIES),
  notes: z.string().trim().max(2000).default(""),
  stage: z.enum(OPPORTUNITY_STAGES).default("Qualification"),
  lostReason: z.string().trim().min(1).max(500).nullish(),
  closedOn: dateOnly.nullish(),
};

export const createOpportunityBody = z.object(opportunityFields);

export const updateOpportunityBody = z.object({
  reference: opportunityFields.reference.optional(),
  title: opportunityFields.title.optional(),
  clientId: optionalId,
  leadId: optionalId,
  ownerEmployeeId: optionalId,
  value: moneyRupees.optional(),
  expectedClose: dateOnly.optional(),
  source: opportunityFields.source.optional(),
  priority: opportunityFields.priority.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const changeOpportunityStageBody = z.object({
  stage: z.enum(OPPORTUNITY_STAGES),
  lostReason: z.string().trim().min(1).max(500).nullish(),
  closedOn: dateOnly.nullish(),
});

export type OpportunityListQuery = z.infer<typeof opportunityListQuery>;
export type CreateOpportunityBody = z.infer<typeof createOpportunityBody>;
export type UpdateOpportunityBody = z.infer<typeof updateOpportunityBody>;
export type ChangeOpportunityStageBody = z.infer<typeof changeOpportunityStageBody>;
