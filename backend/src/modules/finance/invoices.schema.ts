import { z } from "zod";

import { INVOICE_SORTS, INVOICE_STATUSES } from "./constants.js";
import { dateOnly, idParams, requiredText } from "./fields.js";
import { SUPPLIES } from "./money.js";

export const invoiceIdParams = idParams;

const lineSchema = z.object({
  description: requiredText(200),
  quantity: z.number().int().min(1).max(10_000),
  unitPrice: z.number().int().min(0).max(10_000_000),
});

export const invoiceListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    status: z.enum(INVOICE_STATUSES).optional(),
    clientId: z.uuid("Enter a valid id").optional(),
    issueFrom: dateOnly.optional(),
    issueTo: dateOnly.optional(),
    dueFrom: dateOnly.optional(),
    dueTo: dateOnly.optional(),
    sort: z.enum(INVOICE_SORTS).default("issueDate"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => !value.issueFrom || !value.issueTo || value.issueFrom <= value.issueTo, {
    path: ["issueTo"],
    message: "End date must be on or after the start date",
  })
  .refine((value) => !value.dueFrom || !value.dueTo || value.dueFrom <= value.dueTo, {
    path: ["dueTo"],
    message: "End date must be on or after the start date",
  });

const invoiceFields = {
  number: requiredText(40),
  clientId: z.uuid("Enter a valid id"),
  projectId: z.uuid("Enter a valid id").nullish(),
  issueDate: dateOnly,
  dueDate: dateOnly,
  status: z.enum(["Draft", "Pending"]).default("Draft"),
  supply: z.enum(SUPPLIES),
  rateBps: z.number().int().min(0).max(10_000),
  lines: z.array(lineSchema).min(1).max(50),
};

export const createInvoiceBody = z.object(invoiceFields).refine((value) => value.dueDate >= value.issueDate, {
  path: ["dueDate"],
  message: "Due date must be on or after the issue date",
});

export const updateInvoiceBody = z.object({
  number: invoiceFields.number.optional(),
  clientId: invoiceFields.clientId.optional(),
  projectId: z.uuid("Enter a valid id").nullable().optional(),
  issueDate: dateOnly.optional(),
  dueDate: dateOnly.optional(),
  status: z.enum(["Draft", "Pending"]).optional(),
  supply: z.enum(SUPPLIES).optional(),
  rateBps: invoiceFields.rateBps.optional(),
  lines: z.array(lineSchema).min(1).max(50).optional(),
});

export const recordPaymentBody = z.object({
  paidOn: dateOnly,
  amount: z.number().int().min(1).max(10_000_000),
  method: requiredText(40),
  reference: requiredText(80),
  notes: z.string().trim().max(500).nullish(),
});

export type InvoiceListQuery = z.infer<typeof invoiceListQuery>;
export type CreateInvoiceBody = z.infer<typeof createInvoiceBody>;
export type UpdateInvoiceBody = z.infer<typeof updateInvoiceBody>;
export type RecordPaymentBody = z.infer<typeof recordPaymentBody>;
