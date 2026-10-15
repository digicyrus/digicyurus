import { randomUUID } from "node:crypto";

import { rupeesToPaise } from "../src/modules/crm/constants.js";
import type { AssetListQuery } from "../src/modules/assets/assets.schema.js";
import type { AssetRecord, AssetStore, NewAsset } from "../src/modules/assets/assets.store.js";

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

export function createMemoryAssetStore(): AssetStore & { records: AssetRecord[] } {
  const records: AssetRecord[] = [];
  return {
    records,
    async list(organizationId, query: AssetListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.type ? record.type === query.type : true))
        .filter((record) => (query.status ? record.status === query.status : true))
        .filter((record) => (query.from ? record.renewalOn >= query.from : true))
        .filter((record) => (query.to ? record.renewalOn <= query.to : true))
        .filter((record) => includes(query.search, [record.name, record.vendor]))
        .sort((left, right) => {
          const field = { name: left.name, type: left.type, vendor: left.vendor, renewal: left.renewalOn, cost: left.costPaise, status: left.status }[query.sort];
          const other = { name: right.name, type: right.type, vendor: right.vendor, renewal: right.renewalOn, cost: right.costPaise, status: right.status }[query.sort];
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
    async insert(input: NewAsset, audit) {
      const now = new Date();
      const record: AssetRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        type: input.type,
        vendor: input.vendor,
        renewalOn: input.renewalOn,
        costPaise: rupeesToPaise(input.costRupees),
        status: input.status,
        createdAt: now,
        updatedAt: now,
      };
      records.push(record);
      if (!audit?.persist) return record;
      try {
        await audit.persist({
          organizationId: input.organizationId,
          actorUserId: audit.draft.actorUserId,
          action: audit.draft.action,
          resourceType: audit.draft.resourceType,
          resourceId: record.id,
          metadata: audit.draft.metadata ?? {},
        });
        return record;
      } catch (error) {
        records.pop();
        throw error;
      }
    },
    async update(organizationId, id, patch, audit) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      const previous = { ...record };
      if (patch.name !== undefined) record.name = patch.name;
      if (patch.type !== undefined) record.type = patch.type;
      if (patch.vendor !== undefined) record.vendor = patch.vendor;
      if (patch.renewal !== undefined) record.renewalOn = patch.renewal;
      if (patch.cost !== undefined) record.costPaise = rupeesToPaise(patch.cost);
      if (patch.status !== undefined) record.status = patch.status;
      record.updatedAt = new Date();
      if (!audit?.persist) return record;
      try {
        await audit.persist({
          organizationId,
          actorUserId: audit.draft.actorUserId,
          action: audit.draft.action,
          resourceType: audit.draft.resourceType,
          resourceId: id,
          metadata: audit.draft.metadata ?? {},
        });
        return record;
      } catch (error) {
        Object.assign(record, previous);
        throw error;
      }
    },
  };
}
