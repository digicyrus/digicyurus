import pino from "pino";

const level = process.env.NODE_ENV === "test" ? "silent" : "info";

export const loggerRedact = {
  censor: "[Redacted]",
  paths: [
    "password",
    "*.password",
    "req.headers.authorization",
    "req.headers.cookie",
    "headers.authorization",
    "headers.cookie",
    "authorization",
    "*.authorization",
    "cookie",
    "*.cookie",
    "DATABASE_URL",
    "*.DATABASE_URL",
    "password_hash",
    "*.password_hash",
    "passwordHash",
    "*.passwordHash",
    "token",
    "*.token",
    "ADMIN_PASSWORD",
    "*.ADMIN_PASSWORD",
    "set-cookie",
    "*.set-cookie",
    "req.headers.set-cookie",
    "res.headers.set-cookie",
  ],
};

export const logger = pino({
  level,
  redact: loggerRedact,
});
