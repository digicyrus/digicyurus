import { paiseToRupees } from "../crm/constants.js";
import type { AssetRecord } from "./assets.store.js";

export function presentAsset(record: AssetRecord) {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    vendor: record.vendor,
    renewal: record.renewalOn,
    cost: paiseToRupees(record.costPaise),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
