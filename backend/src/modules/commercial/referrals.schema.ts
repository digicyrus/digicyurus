import { z } from "zod";

import { REFERRAL_SORTS, REFERRAL_STATUSES } from "./constants.js";
import { idParams, moneyRupees, requiredText } from "./fields.js";

export const referralIdParams = idParams;

export const referralListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(REFERRAL_STATUSES).optional(),
  clientId: z.uuid().optional(),
  sort: z.enum(REFERRAL_SORTS).default("partner"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

const referralFields = {
  code: requiredText(40),
  partner: requiredText(200),
  clientId: z.uuid().nullish(),
  deals: z.number().int().min(0).max(1_000_000),
  revenue: moneyRupees,
  commission: moneyRupees,
  status: z.enum(REFERRAL_STATUSES),
};

export const createReferralBody = z.object(referralFields);

export const updateReferralBody = z.object({
  code: referralFields.code.optional(),
  partner: referralFields.partner.optional(),
  clientId: z.uuid().nullable().optional(),
  deals: referralFields.deals.optional(),
  revenue: referralFields.revenue.optional(),
  commission: referralFields.commission.optional(),
  status: referralFields.status.optional(),
});

export type ReferralListQuery = z.infer<typeof referralListQuery>;
export type CreateReferralBody = z.infer<typeof createReferralBody>;
export type UpdateReferralBody = z.infer<typeof updateReferralBody>;
