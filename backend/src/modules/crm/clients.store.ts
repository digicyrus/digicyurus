import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { clients } from "../../db/schema/index.js";
import type { ClientStatus } from "./constants.js";
import { containsPattern, isClientStatus } from "./constants.js";
import type { ClientListQuery, UpdateClientBody } from "./clients.schema.js";
import { rethrowConstraint } from "./conflicts.js";

export type ClientRecord = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  contactName: string;
  industry: string;
  status: ClientStatus;
  rating: number;
  customerSince: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewClient = Omit<ClientRecord, "id" | "createdAt" | "updatedAt">;

export type ClientStore = {
  list(organizationId: string, query: ClientListQuery): Promise<{ items: ClientRecord[]; total: number }>;
  find(organizationId: string, id: string): Promise<ClientRecord | null>;
  findByCode(organizationId: string, code: string): Promise<ClientRecord | null>;
  findByEmail(organizationId: string, email: string): Promise<ClientRecord | null>;
  insert(input: NewClient): Promise<ClientRecord>;
  update(organizationId: string, id: string, patch: UpdateClientBody): Promise<ClientRecord | null>;
};

function asClient(row: typeof clients.$inferSelect): ClientRecord {
  if (!isClientStatus(row.status)) throw new Error("Stored client status is invalid");
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    contactName: row.contactName,
    industry: row.industry,
    status: row.status,
    rating: row.rating,
    customerSince: row.customerSince,
    email: row.email,
    phone: row.phone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function clientWhere(organizationId: string, query: ClientListQuery): SQL | undefined {
  const filters: SQL[] = [eq(clients.organizationId, organizationId)];
  if (query.status) filters.push(eq(clients.status, query.status));
  if (query.industry) filters.push(sql`lower(${clients.industry}) = ${query.industry.toLowerCase()}`);
  if (query.search) {
    const pattern = containsPattern(query.search);
    filters.push(sql`(
      ${clients.name} ilike ${pattern} escape '\\'
      or ${clients.contactName} ilike ${pattern} escape '\\'
      or ${clients.industry} ilike ${pattern} escape '\\'
      or ${clients.code} ilike ${pattern} escape '\\'
    )`);
  }
  return and(...filters);
}

function clientOrder(query: ClientListQuery) {
  const column = {
    name: clients.name,
    code: clients.code,
    industry: clients.industry,
    status: clients.status,
    rating: clients.rating,
    customerSince: clients.customerSince,
  }[query.sort];
  const primary = query.direction === "desc" ? desc(column) : asc(column);
  const tie = query.direction === "desc" ? desc(clients.id) : asc(clients.id);
  return [primary, tie];
}

export function createDrizzleClientStore(database: Database): ClientStore {
  const { db } = database;
  return {
    async list(organizationId, query) {
      const where = clientWhere(organizationId, query);
      const [counted] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(clients).where(where);
      const rows = await db
        .select()
        .from(clients)
        .where(where)
        .orderBy(...clientOrder(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items: rows.map(asClient), total: Number(counted?.value ?? 0) };
    },
    async find(organizationId, id) {
      const [row] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.organizationId, organizationId), eq(clients.id, id)))
        .limit(1);
      return row ? asClient(row) : null;
    },
    async findByCode(organizationId, code) {
      const [row] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.organizationId, organizationId), eq(clients.code, code)))
        .limit(1);
      return row ? asClient(row) : null;
    },
    async findByEmail(organizationId, email) {
      const [row] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.organizationId, organizationId), sql`lower(${clients.email}) = ${email.toLowerCase()}`))
        .limit(1);
      return row ? asClient(row) : null;
    },
    async insert(input) {
      try {
        const [row] = await db.insert(clients).values(input).returning();
        if (!row) throw new Error("Insert did not return a row");
        return asClient(row);
      } catch (error) {
        rethrowConstraint(error);
      }
    },
    async update(organizationId, id, patch) {
      try {
        const [row] = await db
          .update(clients)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(clients.organizationId, organizationId), eq(clients.id, id)))
          .returning();
        return row ? asClient(row) : null;
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
