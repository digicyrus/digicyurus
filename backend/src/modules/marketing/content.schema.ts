import { z } from "zod";

import { CONTENT_SORTS, CONTENT_STATUSES } from "./constants.js";
import { dateOnly, idParams, requiredText } from "./fields.js";

export const contentIdParams = idParams;

export const contentListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    status: z.enum(CONTENT_STATUSES).optional(),
    channel: requiredText(80).optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    sort: z.enum(CONTENT_SORTS).default("date"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "End date must be on or after the start date",
  });

const contentFields = {
  title: requiredText(200),
  channel: requiredText(80),
  date: dateOnly,
  status: z.enum(CONTENT_STATUSES),
};

export const createContentBody = z.object(contentFields);

export const updateContentBody = z.object({
  title: contentFields.title.optional(),
  channel: contentFields.channel.optional(),
  date: dateOnly.optional(),
  status: contentFields.status.optional(),
});

export type ContentListQuery = z.infer<typeof contentListQuery>;
export type CreateContentBody = z.infer<typeof createContentBody>;
export type UpdateContentBody = z.infer<typeof updateContentBody>;
