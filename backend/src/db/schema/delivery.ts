import { sql } from "drizzle-orm";
import { boolean, check, date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { clients } from "./crm.js";
import { employees, organizations, users } from "./identity.js";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    managerEmployeeId: uuid("manager_employee_id").references(() => employees.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull(),
    priority: text("priority").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_org_code_unique").on(table.organizationId, table.code),
    index("projects_org_status_idx").on(table.organizationId, table.status),
    index("projects_org_client_idx").on(table.organizationId, table.clientId),
    index("projects_client_idx").on(table.clientId),
    check("projects_status_check", sql`${table.status} in ('On Track', 'At Risk', 'Delayed', 'Completed')`),
    check("projects_priority_check", sql`${table.priority} in ('High', 'Medium', 'Low')`),
    check("projects_dates_check", sql`${table.dueDate} >= ${table.startDate}`),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    assigneeEmployeeId: uuid("assignee_employee_id").references(() => employees.id),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull(),
    priority: text("priority").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tasks_org_project_idx").on(table.organizationId, table.projectId),
    index("tasks_org_status_idx").on(table.organizationId, table.status),
    index("tasks_org_due_idx").on(table.organizationId, table.dueDate),
    index("tasks_assignee_employee_idx").on(table.assigneeEmployeeId),
    index("tasks_assignee_user_idx").on(table.assigneeUserId),
    check("tasks_status_check", sql`${table.status} in ('Backlog', 'In Progress', 'Review', 'Done')`),
    check("tasks_priority_check", sql`${table.priority} in ('High', 'Medium', 'Low')`),
  ],
);

export const plannerEntries = pgTable(
  "planner_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    timeOfDay: text("time_of_day"),
    done: boolean("done").notNull().default(false),
    tag: text("tag"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("planner_entries_owner_date_idx").on(table.organizationId, table.userId, table.entryDate),
    check(
      "planner_entries_time_check",
      sql`${table.timeOfDay} is null or ${table.timeOfDay} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
  ],
);
