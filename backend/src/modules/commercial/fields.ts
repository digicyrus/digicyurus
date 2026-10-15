import { z } from "zod";

export const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const idParams = z.object({
  id: z.uuid("Enter a valid id"),
});

export const moneyRupees = z.number().int().min(0).max(10_000_000);
