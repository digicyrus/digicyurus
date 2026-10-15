import express, { type Express } from "express";

import { AppError } from "./lib/errors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { createAuditRouter } from "./modules/audit/audit.routes.js";
import type { AuditLogStore } from "./modules/audit/audit.store.js";
import { createAuthRouter, type AuthDependencies } from "./modules/auth/auth.routes.js";
import { createClientRouter } from "./modules/crm/clients.routes.js";
import type { ClientStore } from "./modules/crm/clients.store.js";
import { createFollowUpRouter } from "./modules/crm/follow-ups.routes.js";
import type { FollowUpStore } from "./modules/crm/follow-ups.store.js";
import { createLeadRouter } from "./modules/crm/leads.routes.js";
import type { LeadStore } from "./modules/crm/leads.store.js";
import { createPlannerRouter } from "./modules/delivery/planner.routes.js";
import type { PlannerStore } from "./modules/delivery/planner.store.js";
import { createProjectRouter } from "./modules/delivery/projects.routes.js";
import type { ProjectStore } from "./modules/delivery/projects.store.js";
import { createTaskRouter } from "./modules/delivery/tasks.routes.js";
import type { TaskStore } from "./modules/delivery/tasks.store.js";
import { createExpenseRouter } from "./modules/finance/expenses.routes.js";
import type { ExpenseStore } from "./modules/finance/expenses.store.js";
import { createInvoiceRouter } from "./modules/finance/invoices.routes.js";
import type { InvoiceStore } from "./modules/finance/invoices.store.js";
import { createFinanceSummaryRouter } from "./modules/finance/summary.routes.js";
import type { FinanceSummaryStore } from "./modules/finance/summary.store.js";
import { createAttendanceRouter } from "./modules/hr/attendance.routes.js";
import type { AttendanceStore } from "./modules/hr/attendance.store.js";
import { createEmployeeRouter } from "./modules/hr/employees.routes.js";
import type { EmployeeStore } from "./modules/hr/employees.store.js";
import { createCampaignRouter } from "./modules/marketing/campaigns.routes.js";
import type { CampaignStore } from "./modules/marketing/campaigns.store.js";
import { createContentRouter } from "./modules/marketing/content.routes.js";
import type { ContentStore } from "./modules/marketing/content.store.js";
import { createReferralRouter } from "./modules/commercial/referrals.routes.js";
import type { ReferralStore } from "./modules/commercial/referrals.store.js";
import { createServiceRateRouter } from "./modules/commercial/service-rates.routes.js";
import type { ServiceRateStore } from "./modules/commercial/service-rates.store.js";
import { createAssetRouter } from "./modules/assets/assets.routes.js";
import type { AssetStore } from "./modules/assets/assets.store.js";
import { createAgreementRouter } from "./modules/sales/agreements.routes.js";
import type { AgreementStore } from "./modules/sales/agreements.store.js";
import { createForecastRouter } from "./modules/sales/forecast.routes.js";
import type { ForecastStore } from "./modules/sales/forecast.store.js";
import { createOpportunityRouter } from "./modules/sales/opportunities.routes.js";
import type { OpportunityStore } from "./modules/sales/opportunities.store.js";
import { createProposalRouter } from "./modules/sales/proposals.routes.js";
import type { ProposalStore } from "./modules/sales/proposals.store.js";
import { createCompanyRouter } from "./modules/settings/company.routes.js";
import type { CompanyStore } from "./modules/settings/company.store.js";
import { createNotificationRouter } from "./modules/settings/notifications.routes.js";
import type { NotificationStore } from "./modules/settings/notifications.store.js";
import { createRoleSettingsRouter } from "./modules/settings/roles.routes.js";
import type { RoleStore } from "./modules/settings/roles.store.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { createDashboardRouter } from "./modules/insights/dashboard.routes.js";
import type { InsightStore } from "./modules/insights/insight.store.js";
import { createReportRouter } from "./modules/insights/reports.routes.js";

export type AppDependencies = {
  checkDatabase?: () => Promise<void>;
  corsOrigin?: string;
  auth?: AuthDependencies;
  audit?: AuditLogStore;
  crm?: {
    clients: ClientStore;
    leads: LeadStore;
    followUps: FollowUpStore;
  };
  delivery?: {
    clients: ClientStore;
    projects: ProjectStore;
    tasks: TaskStore;
    planner: PlannerStore;
  };
  finance?: {
    clients: ClientStore;
    projects: ProjectStore;
    invoices: InvoiceStore;
    expenses: ExpenseStore;
    summary: FinanceSummaryStore;
  };
  hr?: {
    employees: EmployeeStore;
    attendance: AttendanceStore;
  };
  marketing?: {
    campaigns: CampaignStore;
    content: ContentStore;
  };
  commercial?: {
    clients: ClientStore;
    referrals: ReferralStore;
    serviceRates: ServiceRateStore;
  };
  insights?: {
    store: InsightStore;
  };
  assets?: {
    assets: AssetStore;
  };
  sales?: {
    clients: ClientStore;
    leads: LeadStore;
    employees: EmployeeStore;
    opportunities: OpportunityStore;
    forecast: ForecastStore;
    proposals: ProposalStore;
    agreements: AgreementStore;
  };
  settings?: {
    company: CompanyStore;
    roles: RoleStore;
    notifications: NotificationStore;
  };
  beforeNotFound?: (app: Express) => void;
};

function corsAllowlist(origin: string): express.RequestHandler {
  return (req, res, next) => {
    if (req.header("origin") === origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  if (dependencies.corsOrigin) app.use(corsAllowlist(dependencies.corsOrigin));
  app.use(requestLogger);
  app.use(healthRouter(dependencies.checkDatabase));
  if (dependencies.auth) app.use(createAuthRouter({ ...dependencies.auth, audit: dependencies.audit }));
  if (dependencies.auth && dependencies.crm) {
    const authStore = dependencies.auth.store;
    app.use(createClientRouter({ authStore, clients: dependencies.crm.clients }));
    app.use(createLeadRouter({ authStore, leads: dependencies.crm.leads, audit: dependencies.audit }));
    app.use(createFollowUpRouter({
      authStore,
      clients: dependencies.crm.clients,
      leads: dependencies.crm.leads,
      followUps: dependencies.crm.followUps,
    }));
  }
  if (dependencies.auth && dependencies.delivery) {
    const authStore = dependencies.auth.store;
    app.use(createProjectRouter({ authStore, clients: dependencies.delivery.clients, projects: dependencies.delivery.projects }));
    app.use(createTaskRouter({ authStore, projects: dependencies.delivery.projects, tasks: dependencies.delivery.tasks }));
    app.use(createPlannerRouter({ authStore, planner: dependencies.delivery.planner }));
  }
  if (dependencies.auth && dependencies.finance) {
    const authStore = dependencies.auth.store;
    app.use(createInvoiceRouter({
      authStore,
      clients: dependencies.finance.clients,
      projects: dependencies.finance.projects,
      invoices: dependencies.finance.invoices,
      audit: dependencies.audit,
    }));
    app.use(createExpenseRouter({ authStore, expenses: dependencies.finance.expenses }));
    app.use(createFinanceSummaryRouter({ authStore, summary: dependencies.finance.summary }));
  }
  if (dependencies.auth && dependencies.hr) {
    const authStore = dependencies.auth.store;
    app.use(createEmployeeRouter({ authStore, employees: dependencies.hr.employees }));
    app.use(createAttendanceRouter({ authStore, employees: dependencies.hr.employees, attendance: dependencies.hr.attendance }));
  }
  if (dependencies.auth && dependencies.marketing) {
    const authStore = dependencies.auth.store;
    app.use(createCampaignRouter({ authStore, campaigns: dependencies.marketing.campaigns }));
    app.use(createContentRouter({ authStore, content: dependencies.marketing.content }));
  }
  if (dependencies.auth && dependencies.commercial) {
    const authStore = dependencies.auth.store;
    app.use(createReferralRouter({ authStore, clients: dependencies.commercial.clients, referrals: dependencies.commercial.referrals }));
    app.use(createServiceRateRouter({ authStore, serviceRates: dependencies.commercial.serviceRates }));
  }
  if (dependencies.auth && dependencies.insights) {
    const authStore = dependencies.auth.store;
    app.use(createDashboardRouter({ authStore, insights: dependencies.insights.store }));
    app.use(createReportRouter({ authStore, insights: dependencies.insights.store }));
  }
  if (dependencies.auth && dependencies.assets) {
    app.use(createAssetRouter({ authStore: dependencies.auth.store, assets: dependencies.assets.assets, audit: dependencies.audit }));
  }
  if (dependencies.auth && dependencies.sales) {
    const authStore = dependencies.auth.store;
    const sales = dependencies.sales;
    app.use(createOpportunityRouter({
      authStore,
      clients: sales.clients,
      leads: sales.leads,
      employees: sales.employees,
      opportunities: sales.opportunities,
      audit: dependencies.audit,
    }));
    app.use(createForecastRouter({ authStore, opportunities: sales.opportunities, forecast: sales.forecast, audit: dependencies.audit }));
    app.use(createProposalRouter({
      authStore,
      clients: sales.clients,
      opportunities: sales.opportunities,
      proposals: sales.proposals,
      audit: dependencies.audit,
    }));
    app.use(createAgreementRouter({
      authStore,
      clients: sales.clients,
      opportunities: sales.opportunities,
      proposals: sales.proposals,
      agreements: sales.agreements,
      audit: dependencies.audit,
    }));
  }
  if (dependencies.auth && dependencies.settings) {
    const authStore = dependencies.auth.store;
    const settings = dependencies.settings;
    app.use(createCompanyRouter({ authStore, company: settings.company, audit: dependencies.audit }));
    app.use(createRoleSettingsRouter({ authStore, roles: settings.roles, audit: dependencies.audit }));
    app.use(createNotificationRouter({ authStore, notifications: settings.notifications, audit: dependencies.audit }));
  }
  if (dependencies.auth && dependencies.audit) {
    app.use(createAuditRouter({ authStore: dependencies.auth.store, audit: dependencies.audit }));
  }
  dependencies.beforeNotFound?.(app);
  app.use((_req, _res, next) => {
    next(new AppError(404, "NOT_FOUND", "Route not found"));
  });
  app.use(errorHandler);
  return app;
}
