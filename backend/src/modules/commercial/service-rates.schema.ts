import { z } from "zod";

import { SERVICE_RATE_SORTS } from "./constants.js";
import { idParams, moneyRupees, requiredText } from "./fields.js";

export const serviceRateIdParams = idParams;

export const serviceRateListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  active: z.enum(["true", "false"]).optional(),
  sort: z.enum(SERVICE_RATE_SORTS).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

const serviceRateFields = {
  name: requiredText(200),
  description: z.string().trim().max(2000).default(""),
  unit: requiredText(80),
  rate: moneyRupees,
  active: z.boolean().default(true),
};

export const createServiceRateBody = z.object(serviceRateFields);

export const updateServiceRateBody = z.object({
  name: serviceRateFields.name.optional(),
  description: z.string().trim().max(2000).optional(),
  unit: serviceRateFields.unit.optional(),
  rate: serviceRateFields.rate.optional(),
  active: z.boolean().optional(),
});

export type ServiceRateListQuery = z.infer<typeof serviceRateListQuery>;
export type CreateServiceRateBody = z.infer<typeof createServiceRateBody>;
export type UpdateServiceRateBody = z.infer<typeof updateServiceRateBody>;
