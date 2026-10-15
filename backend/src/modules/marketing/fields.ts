import { z } from "zod";

export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return date.getUTCFullYear() === year && date.getUTCMonth() === (month ?? 0) - 1 && date.getUTCDate() === day;
}, "Enter a valid date");

export const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const idParams = z.object({
  id: z.uuid("Enter a valid id"),
});

export const roiValue = z.number().min(0).max(1_000).refine((value) => {
  const scaled = Math.round(value * 100);
  return Math.abs(value * 100 - scaled) < 1e-6;
}, "Use at most 2 decimal places");

export const moneyRupees = z.number().int().min(0).max(10_000_000);
