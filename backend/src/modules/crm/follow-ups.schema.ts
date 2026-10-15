import { z } from "zod";

import { FOLLOW_UP_STATUSES } from "./constants.js";

const subject = z.object({
  clientId: z.uuid("Enter a valid id").nullish(),
  leadId: z.uuid("Enter a valid id").nullish(),
  ownerEmployeeId: z.uuid("Enter a valid id"),
  dueAt: z.string().refine((value) => value.includes("T") && !Number.isNaN(Date.parse(value)), "Enter a valid date and time"),
  status: z.enum(FOLLOW_UP_STATUSES),
});

export const followUpIdParams = z.object({
  id: z.uuid("Enter a valid id"),
});

export const followUpListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  clientId: z.uuid("Enter a valid id").optional(),
  leadId: z.uuid("Enter a valid id").optional(),
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
});

export const createFollowUpBody = subject.refine((value) => Boolean(value.clientId || value.leadId), {
  path: ["clientId"],
  message: "Choose a client or a lead",
});

export const updateFollowUpBody = z.object({
  clientId: z.uuid("Enter a valid id").nullish(),
  leadId: z.uuid("Enter a valid id").nullish(),
  ownerEmployeeId: z.uuid("Enter a valid id").optional(),
  dueAt: subject.shape.dueAt.optional(),
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
});

export type FollowUpListQuery = z.infer<typeof followUpListQuery>;
export type CreateFollowUpBody = z.infer<typeof createFollowUpBody>;
export type UpdateFollowUpBody = z.infer<typeof updateFollowUpBody>;
