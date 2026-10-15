export const CLIENT_STATUSES = ["Active", "On Hold", "Prospect"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const LEAD_STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Meeting Scheduled",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_PRIORITIES = ["High", "Medium", "Low"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const FOLLOW_UP_STATUSES = ["Due", "Missed", "Upcoming", "Completed"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const CLIENT_SORTS = ["name", "code", "industry", "status", "rating", "customerSince"] as const;
export const LEAD_SORTS = ["company", "code", "stage", "value", "priority", "closing", "probability"] as const;

export function rupeesToPaise(rupees: number): number {
  return rupees * 100;
}

export function paiseToRupees(paise: number): number {
  return Math.trunc(paise / 100);
}

export function containsPattern(value: string): string {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

export function isClientStatus(value: string): value is ClientStatus {
  return (CLIENT_STATUSES as readonly string[]).includes(value);
}

export function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}

export function isLeadPriority(value: string): value is LeadPriority {
  return (LEAD_PRIORITIES as readonly string[]).includes(value);
}

export function isFollowUpStatus(value: string): value is FollowUpStatus {
  return (FOLLOW_UP_STATUSES as readonly string[]).includes(value);
}
