import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { logger } from "../lib/logger.js";
import { hashPassword } from "../modules/auth/passwords.js";
import * as schema from "./schema/index.js";
import { organizations, roles, users } from "./schema/index.js";
import { migrationHashes, readSeedConfig, runSeed, SEED_LOCK_KEY, SeedError, type SeedAdapter, type SeedTransaction } from "./seed-lib.js";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

function safeFailure(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
      return "PostgreSQL is unavailable. Start the database and set DATABASE_URL before seeding.";
    }
  }
  return "Seed failed. Connection details were omitted.";
}

function createAdapter(sqlClient: postgres.Sql): SeedAdapter {
  const db = drizzle(sqlClient, { schema });
  return {
    async currentDatabase() {
      const [row] = await sqlClient`select current_database() as name`;
      return String(row?.name ?? "");
    },
    async blockedPublicTables() {
      const rows = await sqlClient`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in ('agents', 'workspaces')
      `;
      return rows.map((row) => String(row.table_name));
    },
    async appliedMigrationHashes() {
      try {
        const rows = await sqlClient`select hash from drizzle.__drizzle_migrations`;
        return rows.map((row) => String(row.hash));
      } catch {
        throw new SeedError("Refusing to seed: required ERP migrations are missing");
      }
    },
    transaction(run) {
      return db.transaction(async (tx) => {
        const seedTx: SeedTransaction = {
          async lock() {
            await tx.execute(sql`select pg_advisory_xact_lock(${SEED_LOCK_KEY})`);
          },
          async countUsers() {
            const [row] = await tx.select({ value: sql<number>`cast(count(*) as int)` }).from(users);
            return Number(row?.value ?? 0);
          },
          async findOrganizationId() {
            const [row] = await tx.select({ id: organizations.id }).from(organizations).limit(1);
            return row?.id ?? null;
          },
          async insertOrganization(input) {
            const [row] = await tx
              .insert(organizations)
              .values({ legalName: input.legalName, brandName: input.brandName, singleton: true })
              .returning({ id: organizations.id });
            if (!row) throw new SeedError("Seed failed. Connection details were omitted.");
            return row.id;
          },
          async findRoleId(key) {
            const [row] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, key)).limit(1);
            return row?.id ?? null;
          },
          async insertUser(input) {
            await tx.insert(users).values({
              organizationId: input.organizationId,
              roleId: input.roleId,
              employeeId: null,
              email: input.email,
              name: input.name,
              passwordHash: input.passwordHash,
              status: "active",
            });
          },
        };
        return run(seedTx);
      });
    },
  };
}

async function main(): Promise<void> {
  try {
    const config = readSeedConfig(process.env);
    const sqlClient = postgres(config.databaseUrl, { max: 1, connect_timeout: 5, onnotice: () => {} });
    try {
      await runSeed({
        env: process.env,
        adapter: createAdapter(sqlClient),
        hashPassword,
        expectedHashes: migrationHashes(migrationsFolder),
        log: {
          info: (data, message) => logger.info(data, message),
          error: (message) => logger.error(message),
        },
      });
    } finally {
      await sqlClient.end({ timeout: 5 });
    }
  } catch (error) {
    logger.error(error instanceof SeedError ? error.message : safeFailure(error));
    process.exitCode = 1;
  }
}

void main();
