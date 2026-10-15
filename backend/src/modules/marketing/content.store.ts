import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { contentItems } from "../../db/schema/index.js";
import { containsPattern, type ContentStatus } from "./constants.js";
import type { ContentListQuery, UpdateContentBody } from "./content.schema.js";

export type ContentRecord = {
  id: string;
  organizationId: string;
  title: string;
  channel: string;
  publishDate: string;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type NewContent = {
  organizationId: string;
  title: string;
  channel: string;
  publishDate: string;
  status: ContentStatus;
};

export type ContentStore = {
  list(organizationId: string, query: ContentListQuery): Promise<{ items: ContentRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<ContentRecord | null>;
  insert(input: NewContent): Promise<ContentRecord>;
  update(organizationId: string, id: string, patch: UpdateContentBody): Promise<ContentRecord | null>;
};

function asContent(row: typeof contentItems.$inferSelect): ContentRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    channel: row.channel,
    publishDate: row.publishDate,
    status: row.status as ContentStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function contentWhere(organizationId: string, query: ContentListQuery): SQL | undefined {
  const filters: SQL[] = [eq(contentItems.organizationId, organizationId)];
  if (query.status) filters.push(eq(contentItems.status, query.status));
  if (query.channel) filters.push(sql`lower(${contentItems.channel}) = ${query.channel.toLowerCase()}`);
  if (query.from) filters.push(gte(contentItems.publishDate, query.from));
  if (query.to) filters.push(lte(contentItems.publishDate, query.to));
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${contentItems.title} ilike ${pattern} escape '\\'
      or ${contentItems.channel} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function contentOrder(query: ContentListQuery) {
  const column = {
    date: contentItems.publishDate,
    title: contentItems.title,
    channel: contentItems.channel,
    status: contentItems.status,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(contentItems.id) : asc(contentItems.id);
  return [primary, tie];
}

export function createDrizzleContentStore(database: Database): ContentStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = contentWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(contentItems).where(where);
      const rows = await db
        .select()
        .from(contentItems)
        .where(where)
        .orderBy(...contentOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asContent), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db.select().from(contentItems).where(and(eq(contentItems.organizationId, organizationId), eq(contentItems.id, id))).limit(1);
      return row ? asContent(row) : null;
    },
    async insert(input) {
      const [row] = await db.insert(contentItems).values({
        organizationId: input.organizationId,
        title: input.title,
        channel: input.channel,
        publishDate: input.publishDate,
        status: input.status,
      }).returning();
      if (!row) throw new Error("Insert did not return a row");
      return asContent(row);
    },
    async update(organizationId, id, patch) {
      const [row] = await db.update(contentItems).set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.channel !== undefined ? { channel: patch.channel } : {}),
        ...(patch.date !== undefined ? { publishDate: patch.date } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: new Date(),
      }).where(and(eq(contentItems.organizationId, organizationId), eq(contentItems.id, id))).returning();
      return row ? asContent(row) : null;
    },
  };
}
