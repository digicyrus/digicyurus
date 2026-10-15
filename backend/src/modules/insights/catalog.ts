import { FOLLOW_UP_STATUSES, LEAD_STAGES } from "../crm/constants.js";
import { PROJECT_STATUSES, TASK_STATUSES } from "../delivery/constants.js";
import { CONTENT_STATUSES } from "../marketing/constants.js";

export function zeroCounts(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

export function applyCounts(base: Record<string, number>, rows: { key: string; count: number }[]): Record<string, number> {
  for (const row of rows) base[row.key] = row.count;
  return base;
}

export const LEAD_STAGE_COUNTS = () => zeroCounts(LEAD_STAGES);
export const PROJECT_STATUS_COUNTS = () => zeroCounts(PROJECT_STATUSES);
export const TASK_STATUS_COUNTS = () => zeroCounts(TASK_STATUSES);
export const FOLLOW_UP_STATUS_COUNTS = () => zeroCounts(FOLLOW_UP_STATUSES);
export const CONTENT_STATUS_COUNTS = () => zeroCounts(CONTENT_STATUSES);
