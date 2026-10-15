import { and, asc, eq, gte, lte } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { plannerEntries } from "../../db/schema/index.js";
import type { PlannerListQuery, UpdatePlannerBody } from "./planner.schema.js";

export type PlannerRecord = {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  entryDate: string;
  timeOfDay: string | null;
  done: boolean;
  tag: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewPlannerEntry = Omit<PlannerRecord, "id" | "createdAt" | "updatedAt">;

export type PlannerStore = {
  list(organizationId: string, userId: string, query: PlannerListQuery): Promise<PlannerRecord[]>;
  find(organizationId: string, userId: string, id: string): Promise<PlannerRecord | null>;
  insert(input: NewPlannerEntry): Promise<PlannerRecord>;
  update(organizationId: string, userId: string, id: string, patch: UpdatePlannerBody): Promise<PlannerRecord | null>;
};

function asPlanner(row: typeof plannerEntries.$inferSelect): PlannerRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    title: row.title,
    entryDate: row.entryDate,
    timeOfDay: row.timeOfDay,
    done: row.done,
    tag: row.tag,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzlePlannerStore(database: Database): PlannerStore {
  const { db } = database;
  return {
    async list(organizationId, userId, query) {
      const rows = await db
        .select()
        .from(plannerEntries)
        .where(and(
          eq(plannerEntries.organizationId, organizationId),
          eq(plannerEntries.userId, userId),
          gte(plannerEntries.entryDate, query.from),
          lte(plannerEntries.entryDate, query.to),
        ))
        .orderBy(asc(plannerEntries.entryDate), asc(plannerEntries.timeOfDay), asc(plannerEntries.id));
      return rows.map(asPlanner);
    },
    async find(organizationId, userId, id) {
      const [row] = await db
        .select()
        .from(plannerEntries)
        .where(and(eq(plannerEntries.organizationId, organizationId), eq(plannerEntries.userId, userId), eq(plannerEntries.id, id)))
        .limit(1);
      return row ? asPlanner(row) : null;
    },
    async insert(input) {
      const [row] = await db.insert(plannerEntries).values(input).returning();
      if (!row) throw new Error("Insert did not return a row");
      return asPlanner(row);
    },
    async update(organizationId, userId, id, patch) {
      const [row] = await db
        .update(plannerEntries)
        .set({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.entryDate !== undefined ? { entryDate: patch.entryDate } : {}),
          ...(patch.time !== undefined ? { timeOfDay: patch.time } : {}),
          ...(patch.done !== undefined ? { done: patch.done } : {}),
          ...(patch.tag !== undefined ? { tag: patch.tag } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(plannerEntries.organizationId, organizationId), eq(plannerEntries.userId, userId), eq(plannerEntries.id, id)))
        .returning();
      return row ? asPlanner(row) : null;
    },
  };
}
