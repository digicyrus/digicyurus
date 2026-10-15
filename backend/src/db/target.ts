export class DatabaseTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseTargetError";
  }
}

export function databaseTarget(databaseUrl: string): { host: string; database: string } {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new DatabaseTargetError("DATABASE_URL must be a postgres connection string");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new DatabaseTargetError("DATABASE_URL is missing a database name");
  return { host: url.host, database };
}

export function assertErpDatabaseUrl(databaseUrl: string): { host: string; database: string } {
  const target = databaseTarget(databaseUrl);
  if (target.database === "digicyrus") {
    throw new DatabaseTargetError("Refusing to use the unrelated digicyrus database");
  }
  return target;
}
