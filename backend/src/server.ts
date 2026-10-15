import { createApp } from "./app.js";
import { applyEnvFile, loadEnv } from "./config/env.js";
import { closeDatabase, createDatabase, pingDatabase } from "./db/client.js";
import { ConfigError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { createLoginRateLimiter } from "./middleware/login-rate-limit.js";
import { argon2Verifier } from "./modules/auth/auth.routes.js";
import { createDrizzleAuthStore } from "./modules/auth/auth.store.js";
import { createDrizzleClientStore } from "./modules/crm/clients.store.js";
import { createDrizzleFollowUpStore } from "./modules/crm/follow-ups.store.js";
import { createDrizzleLeadStore } from "./modules/crm/leads.store.js";
import { createDrizzlePlannerStore } from "./modules/delivery/planner.store.js";
import { createDrizzleProjectStore } from "./modules/delivery/projects.store.js";
import { createDrizzleTaskStore } from "./modules/delivery/tasks.store.js";
import { createDrizzleExpenseStore } from "./modules/finance/expenses.store.js";
import { createDrizzleInvoiceStore } from "./modules/finance/invoices.store.js";
import { createDrizzleFinanceSummaryStore } from "./modules/finance/summary.store.js";
import { createDrizzleAttendanceStore } from "./modules/hr/attendance.store.js";
import { createDrizzleEmployeeStore } from "./modules/hr/employees.store.js";
import { createDrizzleCampaignStore } from "./modules/marketing/campaigns.store.js";
import { createDrizzleContentStore } from "./modules/marketing/content.store.js";
import { createDrizzleReferralStore } from "./modules/commercial/referrals.store.js";
import { createDrizzleServiceRateStore } from "./modules/commercial/service-rates.store.js";
import { createDrizzleAuditStore } from "./modules/audit/audit.store.js";
import { createDrizzleAssetStore } from "./modules/assets/assets.store.js";
import { createDrizzleInsightStore } from "./modules/insights/insight.store.js";
import { createDrizzleAgreementStore } from "./modules/sales/agreements.store.js";
import { createDrizzleForecastStore } from "./modules/sales/forecast.store.js";
import { createDrizzleOpportunityStore } from "./modules/sales/opportunities.store.js";
import { createDrizzleProposalStore } from "./modules/sales/proposals.store.js";
import { createDrizzleCompanyStore } from "./modules/settings/company.store.js";
import { createDrizzleNotificationStore } from "./modules/settings/notifications.store.js";
import { createDrizzleRoleStore } from "./modules/settings/roles.store.js";

async function main(): Promise<void> {
  applyEnvFile();
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    logger.error(error instanceof ConfigError ? error.message : "Invalid environment configuration");
    process.exit(1);
  }

  const database = createDatabase(env.DATABASE_URL);
  const clients = createDrizzleClientStore(database);
  const leads = createDrizzleLeadStore(database);
  const employees = createDrizzleEmployeeStore(database);
  const projects = createDrizzleProjectStore(database);
  const opportunities = createDrizzleOpportunityStore(database);
  const proposals = createDrizzleProposalStore(database);
  const app = createApp({
    corsOrigin: env.CORS_ORIGIN,
    checkDatabase: () => pingDatabase(database.sql),
    auth: {
      store: createDrizzleAuthStore(database),
      verifier: argon2Verifier,
      secureCookies: env.NODE_ENV === "production",
      rateLimiter: createLoginRateLimiter(),
    },
    audit: createDrizzleAuditStore(database),
    crm: {
      clients,
      leads,
      followUps: createDrizzleFollowUpStore(database),
    },
    delivery: {
      clients,
      projects,
      tasks: createDrizzleTaskStore(database),
      planner: createDrizzlePlannerStore(database),
    },
    finance: {
      clients,
      projects,
      invoices: createDrizzleInvoiceStore(database),
      expenses: createDrizzleExpenseStore(database),
      summary: createDrizzleFinanceSummaryStore(database),
    },
    hr: {
      employees,
      attendance: createDrizzleAttendanceStore(database),
    },
    marketing: {
      campaigns: createDrizzleCampaignStore(database),
      content: createDrizzleContentStore(database),
    },
    commercial: {
      clients,
      referrals: createDrizzleReferralStore(database),
      serviceRates: createDrizzleServiceRateStore(database),
    },
    insights: {
      store: createDrizzleInsightStore(database),
    },
    assets: {
      assets: createDrizzleAssetStore(database),
    },
    sales: {
      clients,
      leads,
      employees,
      opportunities,
      forecast: createDrizzleForecastStore(database),
      proposals,
      agreements: createDrizzleAgreementStore(database),
    },
    settings: {
      company: createDrizzleCompanyStore(database),
      roles: createDrizzleRoleStore(database),
      notifications: createDrizzleNotificationStore(database),
    },
  });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "server listening");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "server stopping");
    server.close();
    await closeDatabase(database.sql);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void main();
