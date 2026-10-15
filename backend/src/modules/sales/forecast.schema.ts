import { z } from "zod";

import { OPEN_OPPORTUNITY_STAGES } from "./constants.js";
import { dateOnly } from "./fields.js";

export const forecastQuery = z
  .object({
    from: dateOnly,
    to: dateOnly,
  })
  .refine((value) => value.from <= value.to, {
    path: ["to"],
    message: "End date must be on or after the start date",
  });

export const replaceProbabilitiesBody = z.object({
  stages: z.array(z.object({
    stage: z.enum(OPEN_OPPORTUNITY_STAGES),
    probability: z.number().int().min(0).max(100),
  })).max(OPEN_OPPORTUNITY_STAGES.length),
});

export type ForecastQuery = z.infer<typeof forecastQuery>;
export type ReplaceProbabilitiesBody = z.infer<typeof replaceProbabilitiesBody>;
