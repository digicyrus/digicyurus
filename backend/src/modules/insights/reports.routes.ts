import { Router } from "express";

import { AppError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { readQuery, validateQuery } from "../../middleware/validate.js";
import type { AuthStore } from "../auth/auth.store.js";
import type { InsightStore } from "./insight.store.js";
import { presentCampaignSummary, presentFinance, presentLeadSummary, presentStatusSummary } from "./present.js";
import { reportQuery, type ReportQuery } from "./query.js";
import { loadInsight } from "./sections.js";

function organizationId(value: string | undefined): string {
  if (!value) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return value;
}

function allows(permissions: readonly string[] | undefined, key: string): boolean {
  return permissions?.includes(key) ?? false;
}

export function createReportRouter(dependencies: { authStore: AuthStore; insights: InsightStore }): Router {
  const router = Router();
  const session = authenticate(dependencies.authStore);
  const view = requirePermission("reports:view");

  router.get("/api/reports/overview", session, view, validateQuery(reportQuery), async (req, res, next) => {
    try {
      const query = readQuery<ReportQuery>(res);
      const data = await loadInsight(dependencies.insights, organizationId(req.auth?.organizationId), query, req.auth?.permissions ?? [], true);
      res.status(200).json({ data, error: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports/finance", session, view, requirePermission("finance:view"), validateQuery(reportQuery), async (req, res, next) => {
    try {
      const query = readQuery<ReportQuery>(res);
      const summary = await dependencies.insights.financeSummary(organizationId(req.auth?.organizationId), query);
      res.status(200).json({ data: presentFinance(summary, true), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports/sales", session, view, requirePermission("leads:view"), validateQuery(reportQuery), async (req, res, next) => {
    try {
      const query = readQuery<ReportQuery>(res);
      const summary = await dependencies.insights.leadSummary(organizationId(req.auth?.organizationId), query);
      res.status(200).json({ data: presentLeadSummary(summary), error: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports/projects", session, view, requirePermission("projects:view"), validateQuery(reportQuery), async (req, res, next) => {
    try {
      const query = readQuery<ReportQuery>(res);
      const orgId = organizationId(req.auth?.organizationId);
      const projects = presentStatusSummary(await dependencies.insights.projectSummary(orgId, query));
      const taskSummary = allows(req.auth?.permissions, "tasks:view")
        ? presentStatusSummary(await dependencies.insights.taskSummary(orgId, query))
        : null;
      res.status(200).json({ data: { ...projects, tasks: taskSummary }, error: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports/marketing", session, view, requirePermission("campaigns:view"), validateQuery(reportQuery), async (req, res, next) => {
    try {
      const query = readQuery<ReportQuery>(res);
      const orgId = organizationId(req.auth?.organizationId);
      const campaigns = presentCampaignSummary(await dependencies.insights.campaignSummary(orgId, query));
      const content = allows(req.auth?.permissions, "content:view")
        ? presentStatusSummary(await dependencies.insights.contentSummary(orgId, query))
        : null;
      res.status(200).json({ data: { campaigns, content }, error: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/reports/hr", session, view, validateQuery(reportQuery), async (req, res, next) => {
    try {
      const permissions = req.auth?.permissions ?? [];
      const employeesAllowed = allows(permissions, "employees:view");
      const attendanceAllowed = allows(permissions, "attendance:view");
      if (!employeesAllowed && !attendanceAllowed) {
        next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
        return;
      }
      const query = readQuery<ReportQuery>(res);
      const orgId = organizationId(req.auth?.organizationId);
      const employees = employeesAllowed ? await dependencies.insights.countEmployees(orgId, query) : null;
      const attendance = attendanceAllowed ? await dependencies.insights.countAttendance(orgId, query) : null;
      res.status(200).json({ data: { employees, attendance }, error: null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
