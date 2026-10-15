import { randomUUID } from "node:crypto";

import { rupeesToPaise } from "../src/modules/crm/constants.js";
import type { ReferralListQuery } from "../src/modules/commercial/referrals.schema.js";
import type { NewReferral, ReferralRecord, ReferralStore } from "../src/modules/commercial/referrals.store.js";
import type { ServiceRateListQuery } from "../src/modules/commercial/service-rates.schema.js";
import type { NewServiceRate, ServiceRateRecord, ServiceRateStore } from "../src/modules/commercial/service-rates.store.js";

function paginate<T>(items: T[], page: number, pageSize: number) {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
}

function compare(left: string | number, right: string | number, direction: "asc" | "desc"): number {
  const result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  return direction === "desc" ? -result : result;
}

function includes(search: string | undefined, values: string[]): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return values.join("\n").toLowerCase().includes(needle);
}

export function createMemoryReferralStore(): ReferralStore & { records: ReferralRecord[] } {
  const records: ReferralRecord[] = [];
  return {
    records,
    async list(organizationId, query: ReferralListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.status ? record.status === query.status : true))
        .filter((record) => (query.clientId ? record.clientId === query.clientId : true))
        .filter((record) => includes(query.search, [record.partner, record.code]))
        .sort((left, right) => {
          const field = {
            partner: left.partner,
            code: left.code,
            deals: left.deals,
            revenue: left.revenuePaise,
            commission: left.commissionPaise,
            status: left.status,
          }[query.sort];
          const other = {
            partner: right.partner,
            code: right.code,
            deals: right.deals,
            revenue: right.revenuePaise,
            commission: right.commissionPaise,
            status: right.status,
          }[query.sort];
          const primary = compare(field, other, query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findByCode(organizationId, code) {
      return records.find((record) => record.organizationId === organizationId && record.code === code) ?? null;
    },
    async insert(input: NewReferral) {
      const now = new Date();
      const record: ReferralRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        code: input.code,
        partner: input.partner,
        clientId: input.clientId,
        deals: input.deals,
        revenuePaise: rupeesToPaise(input.revenueRupees),
        commissionPaise: rupeesToPaise(input.commissionRupees),
        status: input.status,
        createdAt: now,
        updatedAt: now,
      };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.code !== undefined) record.code = patch.code;
      if (patch.partner !== undefined) record.partner = patch.partner;
      if (patch.clientId !== undefined) record.clientId = patch.clientId;
      if (patch.deals !== undefined) record.deals = patch.deals;
      if (patch.revenue !== undefined) record.revenuePaise = rupeesToPaise(patch.revenue);
      if (patch.commission !== undefined) record.commissionPaise = rupeesToPaise(patch.commission);
      if (patch.status !== undefined) record.status = patch.status;
      record.updatedAt = new Date();
      return record;
    },
  };
}

export function createMemoryServiceRateStore(): ServiceRateStore & { records: ServiceRateRecord[] } {
  const records: ServiceRateRecord[] = [];
  return {
    records,
    async list(organizationId, query: ServiceRateListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.active ? record.active === (query.active === "true") : true))
        .filter((record) => includes(query.search, [record.name, record.description, record.unit]))
        .sort((left, right) => {
          const field = { name: left.name, unit: left.unit, rate: left.ratePaise, active: Number(left.active) }[query.sort];
          const other = { name: right.name, unit: right.unit, rate: right.ratePaise, active: Number(right.active) }[query.sort];
          const primary = compare(field, other, query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findByName(organizationId, name) {
      return records.find((record) => record.organizationId === organizationId && record.name.toLowerCase() === name.toLowerCase()) ?? null;
    },
    async insert(input: NewServiceRate) {
      const now = new Date();
      const record: ServiceRateRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        unit: input.unit,
        ratePaise: rupeesToPaise(input.rateRupees),
        active: input.active,
        createdAt: now,
        updatedAt: now,
      };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.name !== undefined) record.name = patch.name;
      if (patch.description !== undefined) record.description = patch.description;
      if (patch.unit !== undefined) record.unit = patch.unit;
      if (patch.rate !== undefined) record.ratePaise = rupeesToPaise(patch.rate);
      if (patch.active !== undefined) record.active = patch.active;
      record.updatedAt = new Date();
      return record;
    },
  };
}
