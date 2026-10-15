import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuditLogStore } from "../audit/audit.store.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { ClientStore } from "../crm/clients.store.js";
import type { ProjectStore } from "../delivery/projects.store.js";
import { todayUtc } from "./constants.js";
import { createInvoiceBody, invoiceIdParams, invoiceListQuery, recordPaymentBody, updateInvoiceBody, type CreateInvoiceBody, type InvoiceListQuery, type RecordPaymentBody, type UpdateInvoiceBody } from "./invoices.schema.js";
import type { InvoiceStore } from "./invoices.store.js";
import { presentInvoice, presentInvoiceDetail, presentPayment } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

async function assertRelations(dependencies: { clients: ClientStore; projects: ProjectStore }, orgId: string, clientId: string, projectId: string | null | undefined): Promise<void> {
  const client = await dependencies.clients.find(orgId, clientId);
  if (!client) throw new AppError(404, "NOT_FOUND", "Client not found");
  if (!projectId) return;
  const project = await dependencies.projects.find(orgId, projectId);
  if (!project) throw new AppError(404, "NOT_FOUND", "Project not found");
  if (project.clientId !== clientId) throw new AppError(409, "CONFLICT", "Project does not belong to this client");
}

export function createInvoiceRouter(dependencies: { authStore: AuthStore; clients: ClientStore; projects: ProjectStore; invoices: InvoiceStore; audit?: AuditLogStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/invoices", session, requirePermission("invoices:view"), validateQuery(invoiceListQuery), async (req, res, next) => {
    try {
      const query = readQuery<InvoiceListQuery>(res);
      const today = todayUtc();
      const result = await dependencies.invoices.list(organizationId(req.auth?.organizationId), query, today);
      res.status(200).json({
        data: {
          items: result.items.map((item) => presentInvoice(item, today)),
          page: query.page,
          pageSize: query.pageSize,
          total: result.total,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/invoices/:id", session, requirePermission("invoices:view"), validateParams(invoiceIdParams), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const today = todayUtc();
      const invoice = await dependencies.invoices.find(orgId, readParams<{ id: string }>(res).id);
      if (!invoice) {
        next(new AppError(404, "NOT_FOUND", "Invoice not found"));
        return;
      }
      const payments = await dependencies.invoices.payments(orgId, invoice.id);
      res.status(200).json({ data: presentInvoiceDetail(invoice, payments, today), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/invoices", session, requirePermission("invoices:create"), validateBody(createInvoiceBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const body = req.body as CreateInvoiceBody;
      await assertRelations(dependencies, orgId, body.clientId, body.projectId);
      const existing = await dependencies.invoices.findByNumber(orgId, body.number);
      if (existing) throw new AppError(409, "CONFLICT", "This invoice number is already in use", { number: "Already in use" });
      const created = await dependencies.invoices.insert({
        organizationId: orgId,
        clientId: body.clientId,
        projectId: body.projectId ?? null,
        number: body.number,
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        status: body.status,
        supply: body.supply,
        rateBps: body.rateBps,
        lines: body.lines.map((line) => ({ description: line.description, quantity: line.quantity, unitPriceRupees: line.unitPrice })),
      });
      res.status(201).json({ data: presentInvoiceDetail(created, [], todayUtc()), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/invoices/:id", session, requirePermission("invoices:update"), validateParams(invoiceIdParams), validateBody(updateInvoiceBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const current = await dependencies.invoices.find(orgId, id);
      if (!current) {
        next(new AppError(404, "NOT_FOUND", "Invoice not found"));
        return;
      }
      if (current.status !== "Draft") throw new AppError(409, "CONFLICT", "Issued invoices cannot be edited");
      const body = req.body as UpdateInvoiceBody;
      const clientId = body.clientId ?? current.clientId;
      const projectId = body.projectId === undefined ? current.projectId : body.projectId;
      await assertRelations(dependencies, orgId, clientId, projectId);
      if (body.number) {
        const existing = await dependencies.invoices.findByNumber(orgId, body.number);
        if (existing && existing.id !== id) throw new AppError(409, "CONFLICT", "This invoice number is already in use", { number: "Already in use" });
      }
      const issueDate = body.issueDate ?? current.issueDate;
      const dueDate = body.dueDate ?? current.dueDate;
      if (dueDate < issueDate) throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { dueDate: "Due date must be on or after the issue date" });
      const updated = await dependencies.invoices.update(orgId, id, body);
      if (!updated) throw new AppError(409, "CONFLICT", "Issued invoices cannot be edited");
      const payments = await dependencies.invoices.payments(orgId, id);
      res.status(200).json({ data: presentInvoiceDetail(updated, payments, todayUtc()), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/invoices/:id/payments", session, requirePermission("invoices:record_payment"), validateParams(invoiceIdParams), validateBody(recordPaymentBody), async (req, res, next) => {
    try {
      const orgId = organizationId(req.auth?.organizationId);
      const id = readParams<{ id: string }>(res).id;
      const body = req.body as RecordPaymentBody;
      const recorded = await dependencies.invoices.recordPayment(orgId, id, body, dependencies.audit ? {
        organizationId: orgId,
        draft: {
          actorUserId: req.auth?.id ?? null,
          action: "invoice.payment",
          resourceType: "invoice",
          metadata: { amount: body.amount, paidOn: body.paidOn, reference: body.reference },
        },
        persist: (event) => dependencies.audit!.append(event).then(() => undefined),
      } : null);
      if (!recorded) {
        next(new AppError(404, "NOT_FOUND", "Invoice not found"));
        return;
      }
      const payments = await dependencies.invoices.payments(orgId, id);
      res.status(201).json({
        data: {
          invoice: presentInvoiceDetail(recorded.invoice, payments, todayUtc()),
          payment: presentPayment(recorded.payment),
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
