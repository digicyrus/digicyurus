import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return date.getUTCFullYear() === year && date.getUTCMonth() === (month ?? 0) - 1 && date.getUTCDate() === day;
}, "Enter a valid date");

export const auditIdParams = z.object({
  id: z.uuid("Enter a valid id"),
});

export const auditListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    resourceType: z.string().trim().min(1).max(80).optional(),
    actor: z.uuid().optional(),
    action: z.string().trim().min(1).max(80).optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "End date must be on or after the start date",
  });

export type AuditListQuery = z.infer<typeof auditListQuery>;
