export const REFERRAL_STATUSES = ["Pending", "Paid"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REFERRAL_SORTS = ["partner", "code", "deals", "revenue", "commission", "status"] as const;
export const SERVICE_RATE_SORTS = ["name", "unit", "rate", "active"] as const;

export function containsPattern(value: string): string {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}
