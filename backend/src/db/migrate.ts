import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { loadEnv } from "../config/env.js";
import { ConfigError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { assertErpDatabaseUrl, DatabaseTargetError } from "./target.js";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("errors" in error && Array.isArray(error.errors)) {
    for (const inner of error.errors) {
      const code = errorCode(inner);
      if (code) return code;
    }
  }
  return "";
}

export function migrationFailureMessage(error: unknown): string {
  const code = errorCode(error);
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT" || code === "EAI_AGAIN") {
    return "PostgreSQL is unavailable. Start the database and set DATABASE_URL before running migrations.";
  }
  return "Migration failed. PostgreSQL must be available and DATABASE_URL must be valid. Connection details were omitted.";
}

function logFailure(error: unknown): void {
  if (error instanceof ConfigError || error instanceof DatabaseTargetError) {
    logger.error(error.message);
    return;
  }
  logger.error(migrationFailureMessage(error));
}

async function main(): Promise<void> {
  const env = loadEnv();
  const target = assertErpDatabaseUrl(env.DATABASE_URL);
  logger.info({ host: target.host, database: target.database }, "migration target");
  const sql = postgres(env.DATABASE_URL, {
    max: 1,
    connect_timeout: 5,
    onnotice: () => {},
  });
  try {
    const [current] = await sql`select current_database() as name`;
    if (current?.name === "digicyrus") {
      throw new DatabaseTargetError("Refusing to use the unrelated digicyrus database");
    }
    await migrate(drizzle(sql), { migrationsFolder });
    logger.info("migrations applied");
  } catch (error) {
    logFailure(error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  logFailure(error);
  process.exitCode = 1;
});
