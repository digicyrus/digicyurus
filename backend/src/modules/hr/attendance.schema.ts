import { z } from "zod";

import { ATTENDANCE_SORTS } from "./constants.js";
import { dateOnly, idParams, requiredText } from "./fields.js";

export const attendanceIdParams = idParams;

export const attendanceListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    employeeId: z.uuid("Enter a valid id").optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    sort: z.enum(ATTENDANCE_SORTS).default("date"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "End date must be on or after the start date",
  });

export const createAttendanceBody = z.object({
  employeeId: z.uuid("Enter a valid id"),
  date: dateOnly,
  note: z.string().trim().min(1).max(500).nullish(),
});

export const updateAttendanceBody = z.object({
  employeeId: z.uuid("Enter a valid id").optional(),
  date: dateOnly.optional(),
  note: z.string().trim().min(1).max(500).nullable().optional(),
});

export type AttendanceListQuery = z.infer<typeof attendanceListQuery>;
export type CreateAttendanceBody = z.infer<typeof createAttendanceBody>;
export type UpdateAttendanceBody = z.infer<typeof updateAttendanceBody>;
