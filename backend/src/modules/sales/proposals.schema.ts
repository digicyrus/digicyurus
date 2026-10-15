import { z } from "zod";

import { PROPOSAL_SORTS, PROPOSAL_STATUSES } from "./constants.js";
import { dateOnly, idParams, moneyRupees, optionalId, requiredText } from "./fields.js";

export const proposalIdParams = idParams;

const lineSchema = z.object({
  description: requiredText(200),
  quantity: z.number().int().min(1).max(10_000),
  unitPrice: moneyRupees,
  discount: moneyRupees.default(0),
}).refine((line) => line.discount <= line.quantity * line.unitPrice, {
  path: ["discount"],
  message: "Discount cannot exceed the line amount",
});

export const proposalListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    status: z.enum(PROPOSAL_STATUSES).optional(),
    clientId: z.uuid("Enter a valid id").optional(),
    opportunityId: z.uuid("Enter a valid id").optional(),
    validityFrom: dateOnly.optional(),
    validityTo: dateOnly.optional(),
    sort: z.enum(PROPOSAL_SORTS).default("number"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => !value.validityFrom || !value.validityTo || value.validityFrom <= value.validityTo, {
    path: ["validityTo"],
    message: "End date must be on or after the start date",
  });

const proposalFields = {
  number: requiredText(40),
  title: requiredText(200),
  clientId: z.uuid("Enter a valid id"),
  opportunityId: optionalId,
  validityDate: dateOnly,
  notes: z.string().trim().max(2000).default(""),
  rateBps: z.number().int().min(0).max(10_000),
  lines: z.array(lineSchema).min(1).max(50),
};

export const createProposalBody = z.object(proposalFields);

export const updateProposalBody = z.object({
  number: proposalFields.number.optional(),
  title: proposalFields.title.optional(),
  clientId: proposalFields.clientId.optional(),
  opportunityId: optionalId,
  validityDate: dateOnly.optional(),
  notes: z.string().trim().max(2000).optional(),
  rateBps: proposalFields.rateBps.optional(),
  lines: proposalFields.lines.optional(),
});

export const changeProposalStatusBody = z.object({
  status: z.enum(PROPOSAL_STATUSES),
});

export type ProposalListQuery = z.infer<typeof proposalListQuery>;
export type CreateProposalBody = z.infer<typeof createProposalBody>;
export type UpdateProposalBody = z.infer<typeof updateProposalBody>;
export type ChangeProposalStatusBody = z.infer<typeof changeProposalStatusBody>;
