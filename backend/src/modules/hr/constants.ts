export const EMPLOYEE_SORTS = ["name", "code", "jobTitle", "department"] as const;
export const ATTENDANCE_SORTS = ["date", "employee"] as const;

export function containsPattern(value: string): string {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}
