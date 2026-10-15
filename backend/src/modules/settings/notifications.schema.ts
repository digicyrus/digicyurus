import { z } from "zod";

import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS } from "./constants.js";

const categoryFlags = z.object({
  invoices: z.boolean().optional(),
  proposals: z.boolean().optional(),
  agreements: z.boolean().optional(),
  assets: z.boolean().optional(),
  tasks: z.boolean().optional(),
});

export const updateNotificationBody = z
  .object({
    categories: categoryFlags.optional(),
    channels: z.array(z.string().trim().min(1).max(40)).optional(),
  })
  .superRefine((value, context) => {
    const channels = value.channels ?? [];
    const supported = NOTIFICATION_CHANNELS as readonly string[];
    channels.forEach((channel, index) => {
      if (!supported.includes(channel)) {
        context.addIssue({ code: "custom", message: "This channel is not supported", path: ["channels", index] });
      }
    });
    const selected = value.categories ? Object.values(value.categories).some((item) => item !== undefined) : false;
    if (!selected && channels.length === 0) {
      context.addIssue({ code: "custom", message: "Choose a preference to update", path: ["categories"] });
    }
  });

export type UpdateNotificationBody = z.infer<typeof updateNotificationBody>;

export const notificationCategoryKeys = NOTIFICATION_CATEGORIES;
