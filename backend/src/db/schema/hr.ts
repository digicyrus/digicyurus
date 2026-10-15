import { date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { employees, organizations } from "./identity.js";

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    workDate: date("work_date", { mode: "string" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendance_employee_date_unique").on(table.employeeId, table.workDate),
    index("attendance_org_date_idx").on(table.organizationId, table.workDate),
    index("attendance_org_employee_idx").on(table.organizationId, table.employeeId),
  ],
);
