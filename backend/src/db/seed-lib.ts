import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { assertErpDatabaseUrl, DatabaseTargetError } from "./target.js";

export const SEED_LOCK_KEY = 2148202612;
export const ORGANIZATION_LEGAL_NAME = "DigiCyrus Technologies Pvt Ltd";
export const ORGANIZATION_BRAND_NAME = "DigiCyrus";
export const SUPER_ADMIN_NAME = "Super Admin";

export class SeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedError";
  }
}

export type SeedConfig = {
  databaseUrl: string;
  host: string;
  database: string;
  email: string;
  password: string;
};

export type SeedTransaction = {
  lock(): Promise<void>;
  countUsers(): Promise<number>;
  findOrganizationId(): Promise<string | null>;
  insertOrganization(input: { legalName: string; brandName: string }): Promise<string>;
  findRoleId(key: string): Promise<string | null>;
  insertUser(input: {
    organizationId: string;
    roleId: string;
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<void>;
};

export type SeedAdapter = {
  currentDatabase(): Promise<string>;
  blockedPublicTables(): Promise<string[]>;
  appliedMigrationHashes(): Promise<string[]>;
  transaction<T>(run: (tx: SeedTransaction) => Promise<T>): Promise<T>;
};

export type SeedLog = {
  info(data: Record<string, unknown>, message: string): void;
  error(message: string): void;
};

export function readSeedConfig(env: NodeJS.ProcessEnv): SeedConfig {
  const databaseUrl = env.DATABASE_URL ?? "";
  const email = (env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? "";
  if (!databaseUrl) throw new SeedError("DATABASE_URL is required");
  if (!email) throw new SeedError("ADMIN_EMAIL is required");
  if (!password) throw new SeedError("ADMIN_PASSWORD is required");
  if (password.length < 10) throw new SeedError("ADMIN_PASSWORD must be at least 10 characters");
  try {
    const target = assertErpDatabaseUrl(databaseUrl);
    return { databaseUrl, host: target.host, database: target.database, email, password };
  } catch (error) {
    if (error instanceof DatabaseTargetError) throw new SeedError(error.message);
    throw error;
  }
}

export function migrationHashes(migrationsFolder: string): string[] {
  const journal = JSON.parse(readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  return journal.entries.map((entry) => {
    const query = readFileSync(path.join(migrationsFolder, `${entry.tag}.sql`)).toString();
    return createHash("sha256").update(query).digest("hex");
  });
}

const BLOCKED_TABLES = new Set(["agents", "workspaces"]);

export async function runSeed(input: {
  env: NodeJS.ProcessEnv;
  adapter: SeedAdapter;
  hashPassword: (password: string) => Promise<string>;
  expectedHashes: string[];
  log: SeedLog;
}): Promise<"created" | "skipped"> {
  const config = readSeedConfig(input.env);
  input.log.info({ host: config.host, database: config.database }, "seed target");
  const current = await input.adapter.currentDatabase();
  if (current === "digicyrus") throw new SeedError("Refusing to use the unrelated digicyrus database");
  const blocked = (await input.adapter.blockedPublicTables()).filter((name) => BLOCKED_TABLES.has(name));
  if (blocked.length > 0) {
    throw new SeedError("Refusing to seed: target database contains unrelated application tables");
  }
  const applied = new Set(await input.adapter.appliedMigrationHashes());
  if (input.expectedHashes.some((hash) => !applied.has(hash))) {
    throw new SeedError("Refusing to seed: required ERP migrations are missing");
  }
  return input.adapter.transaction(async (tx) => {
    await tx.lock();
    if ((await tx.countUsers()) > 0) {
      input.log.info({}, "seed skipped: users already exist");
      return "skipped";
    }
    let organizationId = await tx.findOrganizationId();
    if (!organizationId) {
      organizationId = await tx.insertOrganization({
        legalName: ORGANIZATION_LEGAL_NAME,
        brandName: ORGANIZATION_BRAND_NAME,
      });
    }
    const roleId = await tx.findRoleId("super_admin");
    if (!roleId) throw new SeedError("super_admin role is missing");
    const passwordHash = await input.hashPassword(config.password);
    await tx.insertUser({
      organizationId,
      roleId,
      email: config.email,
      name: SUPER_ADMIN_NAME,
      passwordHash,
    });
    input.log.info({ email: config.email }, "Super Admin provisioned");
    return "created";
  });
}
