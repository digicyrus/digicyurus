import { z } from "zod";

import { AGREEMENT_SORTS, AGREEMENT_STATUSES } from "./constants.js";
import { dateOnly, idParams, moneyRupees, optionalId, requiredText } from "./fields.js";

export const agreementIdParams = idParams;

export const agreementListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    status: z.enum(AGREEMENT_STATUSES).optional(),
    clientId: z.uuid("Enter a valid id").optional(),
    opportunityId: z.uuid("Enter a valid id").optional(),
    proposalId: z.uuid("Enter a valid id").optional(),
    endFrom: dateOnly.optional(),
    endTo: dateOnly.optional(),
    sort: z.enum(AGREEMENT_SORTS).default("number"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => !value.endFrom || !value.endTo || value.endFrom <= value.endTo, {
    path: ["endTo"],
    message: "End date must be on or after the start date",
  });

const agreementFields = {
  number: requiredText(40),
  title: requiredText(200),
  description: z.string().trim().max(4000).default(""),
  clientId: z.uuid("Enter a valid id"),
  opportunityId: optionalId,
  proposalId: optionalId,
  startDate: dateOnly,
  endDate: dateOnly,
  value: moneyRupees,
};

export const createAgreementBody = z.object(agreementFields).refine((value) => value.endDate >= value.startDate, {
  path: ["endDate"],
  message: "End date must be on or after the start date",
});

export const updateAgreementBody = z.object({
  number: agreementFields.number.optional(),
  title: agreementFields.title.optional(),
  description: z.string().trim().max(4000).optional(),
  clientId: agreementFields.clientId.optional(),
  opportunityId: optionalId,
  proposalId: optionalId,
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
  value: moneyRupees.optional(),
});

export const changeAgreementStatusBody = z.object({
  status: z.enum(AGREEMENT_STATUSES),
});

export type AgreementListQuery = z.infer<typeof agreementListQuery>;
export type CreateAgreementBody = z.infer<typeof createAgreementBody>;
export type UpdateAgreementBody = z.infer<typeof updateAgreementBody>;
export type ChangeAgreementStatusBody = z.infer<typeof changeAgreementStatusBody>;
