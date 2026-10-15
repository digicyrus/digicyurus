export const CAMPAIGN_STATUSES = ["Running", "Paused"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CONTENT_STATUSES = ["Draft", "Scheduled", "Published"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CAMPAIGN_SORTS = ["name", "channel", "spend", "leads", "status"] as const;
export const CONTENT_SORTS = ["date", "title", "channel", "status"] as const;

export function containsPattern(value: string): string {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

export function roiToHundredths(roi: number): number {
  return Math.round(roi * 100);
}

export function hundredthsToRoi(hundredths: number): number {
  return hundredths / 100;
}
