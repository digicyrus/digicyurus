import { z } from "zod";

import { GSTIN_PATTERN } from "./constants.js";

const requiredName = z.string().trim().min(1, "Enter a name").max(200, "Use at most 200 characters");
const addressLine = z.string().trim().max(200, "Use at most 200 characters");
const place = z.string().trim().max(80, "Use at most 80 characters");
const postalCode = z.string().trim().max(12, "Use at most 12 characters");

const gstin = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => GSTIN_PATTERN.test(value), "Enter a valid GSTIN");

const billingEmail = z.email("Enter a valid email").transform((value) => value.trim().toLowerCase());

export const updateCompanyBody = z
  .object({
    legalName: requiredName.optional(),
    brandName: requiredName.optional(),
    gstin: gstin.nullable().optional(),
    billingEmail: billingEmail.nullable().optional(),
    addressLine1: addressLine.optional(),
    addressLine2: addressLine.optional(),
    city: place.optional(),
    state: place.optional(),
    postalCode: postalCode.optional(),
    country: place.optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Choose a field to update",
  });

export type UpdateCompanyBody = z.infer<typeof updateCompanyBody>;
