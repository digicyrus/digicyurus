import { createHash, randomBytes } from "node:crypto";

export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
}
