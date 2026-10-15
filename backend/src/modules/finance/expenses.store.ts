import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { expenses } from "../../db/schema/index.js";
import { rupeesToPaise } from "../crm/constants.js";
import { containsPattern } from "./constants.js";
import type { ExpenseListQuery, UpdateExpenseBody } from "./expenses.schema.js";

export type ExpenseRecord = {
  id: string;
  organizationId: string;
  category: string;
  vendor: string | null;
  description: string;
  amountPaise: number;
  spentOn: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewExpense = {
  organizationId: string;
  category: string;
  vendor: string | null;
  description: string;
  amountRupees: number;
  spentOn: string;
};

export type ExpenseStore = {
  list(organizationId: string, query: ExpenseListQuery): Promise<{ items: ExpenseRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<ExpenseRecord | null>;
  insert(input: NewExpense): Promise<ExpenseRecord>;
  update(organizationId: string, id: string, patch: UpdateExpenseBody): Promise<ExpenseRecord | null>;
};

function asExpense(row: typeof expenses.$inferSelect): ExpenseRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    category: row.category,
    vendor: row.vendor,
    description: row.description,
    amountPaise: row.amountPaise,
    spentOn: row.spentOn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function expenseWhere(organizationId: string, query: ExpenseListQuery): SQL | undefined {
  const filters: SQL[] = [eq(expenses.organizationId, organizationId)];
  if (query.category) filters.push(sql`lower(${expenses.category}) = ${query.category.toLowerCase()}`);
  if (query.from) filters.push(gte(expenses.spentOn, query.from));
  if (query.to) filters.push(lte(expenses.spentOn, query.to));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${expenses.category} ilike ${pattern} escape '\\'
      or ${expenses.description} ilike ${pattern} escape '\\'
      or ${expenses.vendor} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function expenseOrder(query: ExpenseListQuery) {
  const column = {
    category: expenses.category,
    amount: expenses.amountPaise,
    date: expenses.spentOn,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(expenses.id) : asc(expenses.id);
  return [primary, tie];
}

export function createDrizzleExpenseStore(database: Database): ExpenseStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = expenseWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(expenses).where(where);
      const rows = await db
        .select()
        .from(expenses)
        .where(where)
        .orderBy(...expenseOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asExpense), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(expenses).where(and(eq(expenses.organizationId, organizationId), eq(expenses.id, id))).limit(1);
      return row ? asExpense(row) : null;
    },
    async insert(input) {
      const [row] = await db.insert(expenses).values({
        organizationId: input.organizationId,
        category: input.category,
        vendor: input.vendor,
        description: input.description,
        amountPaise: rupeesToPaise(input.amountRupees),
        spentOn: input.spentOn,
      }).returning();
      if (!row) throw new Error("Insert did not return a row");
      return asExpense(row);
    },
    async update(organizationId, id, patch) {
      const [row] = await db.update(expenses).set({
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.vendor !== undefined ? { vendor: patch.vendor } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.amount !== undefined ? { amountPaise: rupeesToPaise(patch.amount) } : {}),
        ...(patch.date !== undefined ? { spentOn: patch.date } : {}),
        updatedAt: new Date(),
      }).where(and(eq(expenses.organizationId, organizationId), eq(expenses.id, id))).returning();
      return row ? asExpense(row) : null;
    },
  };
}
