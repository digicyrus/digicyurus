import { paiseToRupees } from "../crm/constants.js";
import { hundredthsToRoi } from "./constants.js";
import type { CampaignRecord } from "./campaigns.store.js";
import type { ContentRecord } from "./content.store.js";

export function presentCampaign(record: CampaignRecord) {
  return {
    id: record.id,
    name: record.name,
    channel: record.channel,
    spend: paiseToRupees(record.spendPaise),
    leads: record.leads,
    roi: hundredthsToRoi(record.roiHundredths),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentContent(record: ContentRecord) {
  return {
    id: record.id,
    title: record.title,
    channel: record.channel,
    date: record.publishDate,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
