import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError, errorBody } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { fieldsFromIssues } from "./validate.js";

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError && "status" in error && (error as { status?: unknown }).status === 400;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json(errorBody(error.code, error.message, error.fields ?? {}));
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json(errorBody("VALIDATION_ERROR", "Request validation failed", fieldsFromIssues(error.issues)));
    return;
  }

  if (isJsonParseError(error)) {
    res.status(400).json(errorBody("VALIDATION_ERROR", "Request body must be JSON"));
    return;
  }

  logger.error({ name: error instanceof Error ? error.name : "Error" }, "unhandled error");
  res.status(500).json(errorBody("INTERNAL_ERROR", "Something went wrong"));
};
