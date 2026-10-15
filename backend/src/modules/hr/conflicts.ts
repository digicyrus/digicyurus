import { AppError } from "../../lib/errors.js";

export function uniqueConflict(constraint: string | undefined): AppError | null {
  if (constraint === "employees_org_code_unique") {
    return new AppError(409, "CONFLICT", "This code is already in use", { code: "Already in use" });
  }
  if (constraint === "employees_email_lower_idx") {
    return new AppError(409, "CONFLICT", "This email is already in use", { email: "Already in use" });
  }
  if (constraint === "attendance_employee_date_unique") {
    return new AppError(409, "CONFLICT", "Attendance for this employee and date already exists", { date: "Already recorded" });
  }
  return null;
}

export function constraintName(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    const record = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (record.code === "23505" && typeof record.constraint_name === "string") return record.constraint_name;
    current = record.cause;
  }
  return undefined;
}

export function rethrowConstraint(error: unknown): never {
  const conflict = uniqueConflict(constraintName(error));
  if (conflict) throw conflict;
  throw error;
}
