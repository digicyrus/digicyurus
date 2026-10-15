import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

export type Database = {
  sql: postgres.Sql;
  db: PostgresJsDatabase<typeof schema>;
};

export function createDatabase(databaseUrl: string): Database {
  const sql = postgres(databaseUrl, {
    max: 10,
    connect_timeout: 5,
    idle_timeout: 20,
  });
  return { sql, db: drizzle(sql, { schema }) };
}

export async function pingDatabase(sql: postgres.Sql): Promise<void> {
  await sql`SELECT 1`;
}

export async function closeDatabase(sql: postgres.Sql): Promise<void> {
  await sql.end({ timeout: 5 });
}
