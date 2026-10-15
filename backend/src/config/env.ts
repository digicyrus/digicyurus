import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import { ConfigError } from "../lib/errors.js";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a postgres connection string",
    }),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.url().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

function present(source: NodeJS.ProcessEnv): Record<string, string> {
  const input: Record<string, string> = {};
  if (source.DATABASE_URL !== undefined) input.DATABASE_URL = source.DATABASE_URL;
  if (source.PORT !== undefined) input.PORT = source.PORT;
  if (source.NODE_ENV !== undefined) input.NODE_ENV = source.NODE_ENV;
  if (source.CORS_ORIGIN !== undefined) input.CORS_ORIGIN = source.CORS_ORIGIN;
  return input;
}

export function applyEnvFile(path = resolve(process.cwd(), ".env")): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key || value.length === 0 || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(present(source));
  if (!parsed.success) {
    const names = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "environment"))),
    ];
    throw new ConfigError(`Invalid environment configuration: ${names.join(", ")}`);
  }
  return parsed.data;
}
