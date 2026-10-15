import { z } from "zod";

import { ASSET_SORTS, ASSET_STATUSES, ASSET_TYPES } from "./constants.js";
import { dateOnly, idParams, moneyRupees, requiredText } from "./fields.js";

export const assetIdParams = idParams;

export const assetListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    type: z.enum(ASSET_TYPES).optional(),
    status: z.enum(ASSET_STATUSES).optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    sort: z.enum(ASSET_SORTS).default("name"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "End date must be on or after the start date",
  });

const assetFields = {
  name: requiredText(200),
  type: z.enum(ASSET_TYPES),
  vendor: requiredText(200),
  renewal: dateOnly,
  cost: moneyRupees,
  status: z.enum(ASSET_STATUSES),
};

export const createAssetBody = z.object(assetFields);

export const updateAssetBody = z.object({
  name: assetFields.name.optional(),
  type: assetFields.type.optional(),
  vendor: assetFields.vendor.optional(),
  renewal: dateOnly.optional(),
  cost: assetFields.cost.optional(),
  status: assetFields.status.optional(),
});

export type AssetListQuery = z.infer<typeof assetListQuery>;
export type CreateAssetBody = z.infer<typeof createAssetBody>;
export type UpdateAssetBody = z.infer<typeof updateAssetBody>;
