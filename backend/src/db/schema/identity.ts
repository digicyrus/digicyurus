import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    singleton: boolean("singleton").notNull().default(true).unique(),
    legalName: text("legal_name").notNull(),
    brandName: text("brand_name").notNull(),
    gstin: text("gstin"),
    billingEmail: text("billing_email"),
    addressLine1: text("address_line1").notNull().default(""),
    addressLine2: text("address_line2").notNull().default(""),
    city: text("city").notNull().default(""),
    state: text("state").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    country: text("country").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "organizations_gstin_check",
      sql`${table.gstin} is null or ${table.gstin} ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'`,
    ),
  ],
);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull().unique(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    jobTitle: text("job_title").notNull(),
    department: text("department").notNull(),
    email: text("email"),
    salaryPaise: bigint("salary_paise", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("employees_org_code_unique").on(table.organizationId, table.code),
    uniqueIndex("employees_email_lower_idx")
      .on(table.organizationId, sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
    index("employees_org_name_idx").on(table.organizationId, table.name),
    index("employees_org_department_idx").on(table.organizationId, table.department),
    check("employees_salary_check", sql`${table.salaryPaise} is null or ${table.salaryPaise} >= 0`),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: uuid("employee_id").unique().references(() => employees.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`),
    check("users_status_check", sql`${table.status} in ('active', 'disabled')`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_expires_idx").on(table.userId, table.expiresAt)],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_preferences_user_category_unique").on(table.organizationId, table.userId, table.category),
    index("notification_preferences_org_user_idx").on(table.organizationId, table.userId),
    check(
      "notification_preferences_category_check",
      sql`${table.category} in ('invoices', 'proposals', 'agreements', 'assets', 'tasks')`,
    ),
  ],
);
