import { randomUUID } from "node:crypto";

import { rupeesToPaise } from "../src/modules/crm/constants.js";
import { roiToHundredths } from "../src/modules/marketing/constants.js";
import type { CampaignListQuery } from "../src/modules/marketing/campaigns.schema.js";
import type { CampaignRecord, CampaignStore, NewCampaign } from "../src/modules/marketing/campaigns.store.js";
import type { ContentListQuery } from "../src/modules/marketing/content.schema.js";
import type { ContentRecord, ContentStore, NewContent } from "../src/modules/marketing/content.store.js";

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

export function createMemoryCampaignStore(): CampaignStore & { records: CampaignRecord[] } {
  const records: CampaignRecord[] = [];
  return {
    records,
    async list(organizationId, query: CampaignListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.status ? record.status === query.status : true))
        .filter((record) => (query.channel ? record.channel.toLowerCase() === query.channel.toLowerCase() : true))
        .filter((record) => includes(query.search, [record.name, record.channel]))
        .sort((left, right) => {
          const field = { name: left.name, channel: left.channel, spend: left.spendPaise, leads: left.leads, status: left.status }[query.sort];
          const other = { name: right.name, channel: right.channel, spend: right.spendPaise, leads: right.leads, status: right.status }[query.sort];
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
    async insert(input: NewCampaign) {
      const now = new Date();
      const record: CampaignRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        channel: input.channel,
        spendPaise: rupeesToPaise(input.spendRupees),
        leads: input.leads,
        roiHundredths: roiToHundredths(input.roi),
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
      if (patch.name !== undefined) record.name = patch.name;
      if (patch.channel !== undefined) record.channel = patch.channel;
      if (patch.spend !== undefined) record.spendPaise = rupeesToPaise(patch.spend);
      if (patch.leads !== undefined) record.leads = patch.leads;
      if (patch.roi !== undefined) record.roiHundredths = roiToHundredths(patch.roi);
      if (patch.status !== undefined) record.status = patch.status;
      record.updatedAt = new Date();
      return record;
    },
  };
}

export function createMemoryContentStore(): ContentStore & { records: ContentRecord[] } {
  const records: ContentRecord[] = [];
  return {
    records,
    async list(organizationId, query: ContentListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.status ? record.status === query.status : true))
        .filter((record) => (query.channel ? record.channel.toLowerCase() === query.channel.toLowerCase() : true))
        .filter((record) => (query.from ? record.publishDate >= query.from : true))
        .filter((record) => (query.to ? record.publishDate <= query.to : true))
        .filter((record) => includes(query.search, [record.title, record.channel]))
        .sort((left, right) => {
          const field = { date: left.publishDate, title: left.title, channel: left.channel, status: left.status }[query.sort];
          const other = { date: right.publishDate, title: right.title, channel: right.channel, status: right.status }[query.sort];
          const primary = compare(field, other, query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async insert(input: NewContent) {
      const now = new Date();
      const record: ContentRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.title !== undefined) record.title = patch.title;
      if (patch.channel !== undefined) record.channel = patch.channel;
      if (patch.date !== undefined) record.publishDate = patch.date;
      if (patch.status !== undefined) record.status = patch.status;
      record.updatedAt = new Date();
      return record;
    },
  };
}
