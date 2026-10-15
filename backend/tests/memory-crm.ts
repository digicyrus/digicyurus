import { randomUUID } from "node:crypto";

import type { ClientListQuery } from "../src/modules/crm/clients.schema.js";
import type { ClientRecord, ClientStore, NewClient } from "../src/modules/crm/clients.store.js";
import type { FollowUpListQuery } from "../src/modules/crm/follow-ups.schema.js";
import type { FollowUpRecord, FollowUpStore, NewFollowUp } from "../src/modules/crm/follow-ups.store.js";
import { rupeesToPaise } from "../src/modules/crm/constants.js";
import type { LeadListQuery } from "../src/modules/crm/leads.schema.js";
import type { LeadRecord, LeadStore, NewLead } from "../src/modules/crm/leads.store.js";

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

export function createMemoryClientStore(): ClientStore & { records: ClientRecord[] } {
  const records: ClientRecord[] = [];
  return {
    records,
    async list(organizationId, query: ClientListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.status ? record.status === query.status : true))
        .filter((record) => (query.industry ? record.industry.toLowerCase() === query.industry.toLowerCase() : true))
        .filter((record) => includes(query.search, [record.name, record.contactName, record.industry, record.code]))
        .sort((left, right) => {
          const field = {
            name: left.name,
            code: left.code,
            industry: left.industry,
            status: left.status,
            rating: left.rating,
            customerSince: left.customerSince,
          }[query.sort];
          const other = {
            name: right.name,
            code: right.code,
            industry: right.industry,
            status: right.status,
            rating: right.rating,
            customerSince: right.customerSince,
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
    async findByEmail(organizationId, email) {
      return records.find((record) => record.organizationId === organizationId && record.email?.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async insert(input: NewClient) {
      const now = new Date();
      const record: ClientRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.code !== undefined) record.code = patch.code;
      if (patch.name !== undefined) record.name = patch.name;
      if (patch.contactName !== undefined) record.contactName = patch.contactName;
      if (patch.industry !== undefined) record.industry = patch.industry;
      if (patch.status !== undefined) record.status = patch.status;
      if (patch.rating !== undefined) record.rating = patch.rating;
      if (patch.customerSince !== undefined) record.customerSince = patch.customerSince;
      if (patch.email !== undefined) record.email = patch.email;
      if (patch.phone !== undefined) record.phone = patch.phone;
      record.updatedAt = new Date();
      return record;
    },
  };
}

export function createMemoryLeadStore(): LeadStore & { records: LeadRecord[] } {
  const records: LeadRecord[] = [];
  return {
    records,
    async list(organizationId, query: LeadListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.stage ? record.stage === query.stage : true))
        .filter((record) => (query.priority ? record.priority === query.priority : true))
        .filter((record) => (query.source ? record.source.toLowerCase() === query.source.toLowerCase() : true))
        .filter((record) => includes(query.search, [record.company, record.person, record.code]))
        .sort((left, right) => {
          const value = {
            company: [left.company, right.company],
            code: [left.code, right.code],
            stage: [left.stage, right.stage],
            value: [left.valuePaise, right.valuePaise],
            priority: [left.priority, right.priority],
            closing: [left.expectedClose, right.expectedClose],
            probability: [left.probability, right.probability],
          }[query.sort] as [string | number, string | number];
          const primary = compare(value[0], value[1], query.direction);
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
    async insert(input: NewLead) {
      const now = new Date();
      const record: LeadRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        clientId: null,
        code: input.code,
        company: input.company,
        person: input.person,
        stage: "New",
        valuePaise: rupeesToPaise(input.value),
        source: input.source,
        priority: input.priority,
        expectedClose: input.expectedClose,
        probability: input.probability,
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
      if (patch.company !== undefined) record.company = patch.company;
      if (patch.person !== undefined) record.person = patch.person;
      if (patch.value !== undefined) record.valuePaise = rupeesToPaise(patch.value);
      if (patch.source !== undefined) record.source = patch.source;
      if (patch.priority !== undefined) record.priority = patch.priority;
      if (patch.closing !== undefined) record.expectedClose = patch.closing;
      if (patch.probability !== undefined) record.probability = patch.probability;
      record.updatedAt = new Date();
      return record;
    },
    async moveStage(organizationId, id, stage, audit) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      const previous = record.stage;
      record.stage = stage;
      record.updatedAt = new Date();
      if (!audit?.persist) return record;
      try {
        await audit.persist({
          organizationId,
          actorUserId: audit.draft.actorUserId,
          action: audit.draft.action,
          resourceType: audit.draft.resourceType,
          resourceId: id,
          metadata: { from: previous, to: stage },
        });
        return record;
      } catch (error) {
        record.stage = previous;
        throw error;
      }
    },
  };
}

export function createMemoryFollowUpStore(): FollowUpStore & { records: FollowUpRecord[]; employees: { id: string; organizationId: string }[] } {
  const records: FollowUpRecord[] = [];
  const employees: { id: string; organizationId: string }[] = [];
  return {
    records,
    employees,
    async list(organizationId, query: FollowUpListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.clientId ? record.clientId === query.clientId : true))
        .filter((record) => (query.leadId ? record.leadId === query.leadId : true))
        .filter((record) => (query.status ? record.status === query.status : true))
        .sort((left, right) => compare(left.dueAt.toISOString(), right.dueAt.toISOString(), "asc") || compare(left.id, right.id, "asc"));
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findEmployee(organizationId, id) {
      return employees.find((employee) => employee.organizationId === organizationId && employee.id === id) ?? null;
    },
    async insert(input: NewFollowUp) {
      const now = new Date();
      const record: FollowUpRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      records.push(record);
      return record;
    },
    async update(organizationId, id, patch) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (patch.clientId !== undefined) record.clientId = patch.clientId ?? null;
      if (patch.leadId !== undefined) record.leadId = patch.leadId ?? null;
      if (patch.ownerEmployeeId !== undefined) record.ownerEmployeeId = patch.ownerEmployeeId;
      if (patch.dueAt !== undefined) record.dueAt = new Date(patch.dueAt);
      if (patch.status !== undefined) record.status = patch.status;
      record.updatedAt = new Date();
      return record;
    },
  };
}
