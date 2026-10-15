import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "../lib/errors.js";

type Issue = { path: PropertyKey[]; message: string };

export function fieldsFromIssues(issues: Issue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "request";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

function parseOrNext<T extends ZodType>(schema: T, value: unknown, assign: (data: unknown) => void, next: NextFunction): void {
  const result = schema.safeParse(value);
  if (!result.success) {
    next(new AppError(400, "VALIDATION_ERROR", "Request validation failed", fieldsFromIssues(result.error.issues)));
    return;
  }
  assign(result.data);
  next();
}

export function validateBody<T extends ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    parseOrNext(schema, req.body, (data) => {
      req.body = data;
    }, next);
  };
}

export function validateParams<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    parseOrNext(schema, req.params, (data) => {
      res.locals.validatedParams = data;
    }, next);
  };
}

export function validateQuery<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    parseOrNext(schema, req.query, (data) => {
      res.locals.validatedQuery = data;
    }, next);
  };
}

export function readParams<T>(res: Response): T {
  return res.locals.validatedParams as T;
}

export function readQuery<T>(res: Response): T {
  return res.locals.validatedQuery as T;
}
