export const ASSET_TYPES = ["Domain", "Hosting", "SSL", "License", "Subscription"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = ["Active", "Due Soon"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_SORTS = ["name", "type", "vendor", "renewal", "cost", "status"] as const;

export function containsPattern(value: string): string {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}
