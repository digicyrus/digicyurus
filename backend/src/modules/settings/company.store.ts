import { eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { organizations } from "../../db/schema/index.js";
import type { AuditRequest } from "../audit/types.js";
import { insertAudit } from "../audit/write.js";
import type { UpdateCompanyBody } from "./company.schema.js";

export type CompanyRecord = {
  id: string;
  legalName: string;
  brandName: string;
  gstin: string | null;
  billingEmail: string | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  updatedAt: Date;
};

export type CompanyStore = {
  find(organizationId: string): Promise<CompanyRecord | null>;
  update(organizationId: string, patch: UpdateCompanyBody, audit?: AuditRequest | null): Promise<CompanyRecord | null>;
};

function asCompany(row: typeof organizations.$inferSelect): CompanyRecord {
  return {
    id: row.id,
    legalName: row.legalName,
    brandName: row.brandName,
    gstin: row.gstin,
    billingEmail: row.billingEmail,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleCompanyStore(database: Database): CompanyStore {
  const { db } = database;
  return {
    async find(organizationId) {
      const [row] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
      return row ? asCompany(row) : null;
    },
    async update(organizationId, patch, audit) {
      return db.transaction(async (tx) => {
        const [current] = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1).for("update");
        if (!current) return null;
        const [row] = await tx
          .update(organizations)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(organizations.id, organizationId))
          .returning();
        if (!row) return null;
        if (audit) {
          await insertAudit(tx, {
            organizationId,
            actorUserId: audit.draft.actorUserId,
            action: audit.draft.action,
            resourceType: audit.draft.resourceType,
            resourceId: organizationId,
            metadata: audit.draft.metadata ?? {},
          });
        }
        return asCompany(row);
      });
    },
  };
}
