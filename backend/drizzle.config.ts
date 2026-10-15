import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

let databaseName = "";
try {
  databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
} catch {
  throw new Error("DATABASE_URL must be a postgres connection string");
}
if (!databaseName) throw new Error("DATABASE_URL is missing a database name");
if (databaseName === "digicyrus") throw new Error("Refusing to use the unrelated digicyrus database");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
