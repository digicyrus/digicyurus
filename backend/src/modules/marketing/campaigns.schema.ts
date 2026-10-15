import { z } from "zod";

import { CAMPAIGN_SORTS, CAMPAIGN_STATUSES } from "./constants.js";
import { idParams, moneyRupees, requiredText, roiValue } from "./fields.js";

export const campaignIdParams = idParams;

export const campaignListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  channel: requiredText(80).optional(),
  sort: z.enum(CAMPAIGN_SORTS).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

const campaignFields = {
  name: requiredText(200),
  channel: requiredText(80),
  spend: moneyRupees,
  leads: z.number().int().min(0).max(1_000_000),
  roi: roiValue,
  status: z.enum(CAMPAIGN_STATUSES),
};

export const createCampaignBody = z.object(campaignFields);

export const updateCampaignBody = z.object({
  name: campaignFields.name.optional(),
  channel: campaignFields.channel.optional(),
  spend: campaignFields.spend.optional(),
  leads: campaignFields.leads.optional(),
  roi: campaignFields.roi.optional(),
  status: campaignFields.status.optional(),
});

export type CampaignListQuery = z.infer<typeof campaignListQuery>;
export type CreateCampaignBody = z.infer<typeof createCampaignBody>;
export type UpdateCampaignBody = z.infer<typeof updateCampaignBody>;
