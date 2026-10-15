import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readParams, readQuery, validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import { createExpenseBody, expenseIdParams, expenseListQuery, updateExpenseBody, type CreateExpenseBody, type ExpenseListQuery, type UpdateExpenseBody } from "./expenses.schema.js";
import type { ExpenseStore } from "./expenses.store.js";
import { presentExpense } from "./present.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

export function createExpenseRouter(dependencies: { authStore: AuthStore; expenses: ExpenseStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);

  router.get("/api/expenses", session, requirePermission("expenses:view"), validateQuery(expenseListQuery), async (req, res, next) => {
    try {
      const query = readQuery<ExpenseListQuery>(res);
      const result = await dependencies.expenses.list(organizationId(req.auth?.organizationId), query);
      res.status(200).json({
        data: {
          items: result.items.map(presentExpense),
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

  router.get("/api/expenses/:id", session, requirePermission("expenses:view"), validateParams(expenseIdParams), async (req, res, next) => {
    try {
      const expense = await dependencies.expenses.find(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id);
      if (!expense) {
        next(new AppError(404, "NOT_FOUND", "Expense not found"));
        return;
      }
      res.status(200).json({ data: presentExpense(expense), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/expenses", session, requirePermission("expenses:create"), validateBody(createExpenseBody), async (req, res, next) => {
    try {
      const body = req.body as CreateExpenseBody;
      const created = await dependencies.expenses.insert({
        organizationId: organizationId(req.auth?.organizationId),
        category: body.category,
        vendor: body.vendor ?? null,
        description: body.description,
        amountRupees: body.amount,
        spentOn: body.date,
      });
      res.status(201).json({ data: presentExpense(created), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/expenses/:id", session, requirePermission("expenses:update"), validateParams(expenseIdParams), validateBody(updateExpenseBody), async (req, res, next) => {
    try {
      const updated = await dependencies.expenses.update(organizationId(req.auth?.organizationId), readParams<{ id: string }>(res).id, req.body as UpdateExpenseBody);
      if (!updated) {
        next(new AppError(404, "NOT_FOUND", "Expense not found"));
        return;
      }
      res.status(200).json({ data: presentExpense(updated), error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
