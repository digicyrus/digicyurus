import { randomUUID } from "node:crypto";

import { AppError } from "../src/lib/errors.js";
import { rupeesToPaise } from "../src/modules/crm/constants.js";
import type { AuditRequest } from "../src/modules/audit/types.js";
import type { AgreementListQuery, UpdateAgreementBody } from "../src/modules/sales/agreements.schema.js";
import type { AgreementRecord, AgreementStatusEventRecord, AgreementStore, NewAgreement } from "../src/modules/sales/agreements.store.js";
import { isTerminalAgreement, OPEN_OPPORTUNITY_STAGES, type AgreementStatus, type ProposalStatus } from "../src/modules/sales/constants.js";
import type { ForecastStore, StageProbabilityRecord } from "../src/modules/sales/forecast.store.js";
import { summarizeStages, type StageProbabilityInput } from "../src/modules/sales/metrics.js";
import { calculateProposal, type ProposalLineInput } from "../src/modules/sales/money.js";
import type { OpportunityListQuery, UpdateOpportunityBody } from "../src/modules/sales/opportunities.schema.js";
import type { NewOpportunity, OpportunityRecord, OpportunityStore, StageChange, StageEventRecord } from "../src/modules/sales/opportunities.store.js";
import type { ProposalListQuery, UpdateProposalBody } from "../src/modules/sales/proposals.schema.js";
import type { NewProposal, ProposalRecord, ProposalStatusEventRecord, ProposalStore } from "../src/modules/sales/proposals.store.js";
import { agreementStatusStamp, assertAgreementTransition, assertProposalTransition, proposalStatusStamp, resolveOpportunityClose } from "../src/modules/sales/transitions.js";

function paginate<T>(items: T[], page: number, pageSize: number) {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
}

function compare(left: string | number, right: string | number, direction: "asc" | "desc"): number {
  const result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  return direction === "desc" ? -result : result;
}

function includes(search: string | undefined, values: Array<string | null>): boolean {
  if (!search) return true;
  return values.filter((value) => value !== null).join("\n").toLowerCase().includes(search.toLowerCase());
}

async function persistAudit(
  audit: AuditRequest | null | undefined,
  resourceId: string | null,
  metadata: Record<string, unknown>,
  rollback: () => void,
): Promise<void> {
  if (!audit?.persist) return;
  try {
    await audit.persist({
      organizationId: audit.organizationId,
      actorUserId: audit.draft.actorUserId,
      action: audit.draft.action,
      resourceType: audit.draft.resourceType,
      resourceId,
      metadata,
    });
  } catch (error) {
    rollback();
    throw error;
  }
}

function lineInputs(record: ProposalRecord): ProposalLineInput[] {
  return record.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPriceRupees: Math.trunc(line.unitPricePaise / 100),
    discountRupees: Math.trunc(line.discountPaise / 100),
  }));
}

export function createMemoryOpportunityStore(): OpportunityStore & { records: OpportunityRecord[]; events: StageEventRecord[] } {
  const records: OpportunityRecord[] = [];
  const events: StageEventRecord[] = [];
  return {
    records,
    events,
    async list(organizationId, query: OpportunityListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.stage ? record.stage === query.stage : true))
        .filter((record) => (query.priority ? record.priority === query.priority : true))
        .filter((record) => (query.source ? record.source.toLowerCase() === query.source.toLowerCase() : true))
        .filter((record) => (query.clientId ? record.clientId === query.clientId : true))
        .filter((record) => (query.leadId ? record.leadId === query.leadId : true))
        .filter((record) => (query.ownerEmployeeId ? record.ownerEmployeeId === query.ownerEmployeeId : true))
        .filter((record) => (query.expectedFrom ? record.expectedClose >= query.expectedFrom : true))
        .filter((record) => (query.expectedTo ? record.expectedClose <= query.expectedTo : true))
        .filter((record) => includes(query.search, [record.reference, record.title, record.source]))
        .sort((left, right) => {
          const value = {
            reference: [left.reference, right.reference],
            title: [left.title, right.title],
            stage: [left.stage, right.stage],
            value: [left.valuePaise, right.valuePaise],
            priority: [left.priority, right.priority],
            expectedClose: [left.expectedClose, right.expectedClose],
            source: [left.source, right.source],
          }[query.sort] as [string | number, string | number];
          const primary = compare(value[0], value[1], query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async summary(organizationId) {
      return summarizeStages(records.filter((record) => record.organizationId === organizationId));
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findByReference(organizationId, reference) {
      const record = records.find((item) => item.organizationId === organizationId && item.reference === reference);
      return record ? { id: record.id } : null;
    },
    async history(organizationId, opportunityId) {
      return events
        .filter((event) => event.organizationId === organizationId && event.opportunityId === opportunityId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
    },
    async forecastSources(organizationId) {
      return records
        .filter((record) => record.organizationId === organizationId)
        .map((record) => ({
          stage: record.stage,
          ownerEmployeeId: record.ownerEmployeeId,
          valuePaise: record.valuePaise,
          expectedClose: record.expectedClose,
          closedOn: record.closedOn,
        }));
    },
    async insert(input: NewOpportunity, audit) {
      const close = resolveOpportunityClose(input);
      if (records.some((record) => record.organizationId === input.organizationId && record.reference === input.reference)) {
        throw new AppError(409, "CONFLICT", "This reference is already in use", { reference: "Already in use" });
      }
      const now = new Date();
      const record: OpportunityRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        reference: input.reference,
        title: input.title,
        clientId: input.clientId,
        leadId: input.leadId,
        ownerEmployeeId: input.ownerEmployeeId,
        valuePaise: rupeesToPaise(input.valueRupees),
        expectedClose: input.expectedClose,
        source: input.source,
        priority: input.priority,
        notes: input.notes,
        stage: close.stage,
        lostReason: close.lostReason,
        closedOn: close.closedOn,
        createdAt: now,
        updatedAt: now,
      };
      const event: StageEventRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        opportunityId: record.id,
        fromStage: null,
        toStage: close.stage,
        lostReason: close.lostReason,
        closedOn: close.closedOn,
        createdAt: now,
      };
      records.push(record);
      events.push(event);
      await persistAudit(audit, record.id, audit?.draft.metadata ?? {}, () => {
        records.pop();
        events.pop();
      });
      return record;
    },
    async update(organizationId, id, patch: UpdateOpportunityBody, audit) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      const previous = { ...record };
      if (patch.reference !== undefined && records.some((item) => item.organizationId === organizationId && item.reference === patch.reference && item.id !== id)) {
        throw new AppError(409, "CONFLICT", "This reference is already in use", { reference: "Already in use" });
      }
      if (patch.reference !== undefined) record.reference = patch.reference;
      if (patch.title !== undefined) record.title = patch.title;
      if (patch.clientId !== undefined) record.clientId = patch.clientId;
      if (patch.leadId !== undefined) record.leadId = patch.leadId;
      if (patch.ownerEmployeeId !== undefined) record.ownerEmployeeId = patch.ownerEmployeeId;
      if (patch.value !== undefined) record.valuePaise = rupeesToPaise(patch.value);
      if (patch.expectedClose !== undefined) record.expectedClose = patch.expectedClose;
      if (patch.source !== undefined) record.source = patch.source;
      if (patch.priority !== undefined) record.priority = patch.priority;
      if (patch.notes !== undefined) record.notes = patch.notes;
      record.updatedAt = new Date();
      await persistAudit(audit, id, audit?.draft.metadata ?? {}, () => {
        Object.assign(record, previous);
      });
      return record;
    },
    async changeStage(organizationId, id, input: StageChange, audit) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (record.stage === input.stage) throw new AppError(409, "CONFLICT", "Opportunity is already in this stage");
      const close = resolveOpportunityClose(input);
      const previous = { ...record };
      const now = new Date();
      record.stage = close.stage;
      record.lostReason = close.lostReason;
      record.closedOn = close.closedOn;
      record.updatedAt = now;
      const event: StageEventRecord = {
        id: randomUUID(),
        organizationId,
        opportunityId: id,
        fromStage: previous.stage,
        toStage: close.stage,
        lostReason: close.lostReason,
        closedOn: close.closedOn,
        createdAt: now,
      };
      events.push(event);
      await persistAudit(audit, id, { from: previous.stage, to: close.stage, lostReason: close.lostReason, closedOn: close.closedOn }, () => {
        Object.assign(record, previous);
        events.pop();
      });
      return record;
    },
  };
}

export function createMemoryForecastStore(): ForecastStore & { records: Array<StageProbabilityRecord & { organizationId: string }> } {
  const records: Array<StageProbabilityRecord & { organizationId: string }> = [];
  const present = (organizationId: string) => records
    .filter((record) => record.organizationId === organizationId)
    .map(({ stage, probability, updatedAt }) => ({ stage, probability, updatedAt }))
    .sort((left, right) => OPEN_OPPORTUNITY_STAGES.indexOf(left.stage) - OPEN_OPPORTUNITY_STAGES.indexOf(right.stage));
  return {
    records,
    async listProbabilities(organizationId) {
      return present(organizationId);
    },
    async replaceProbabilities(organizationId, stages: StageProbabilityInput[], audit) {
      const previous = records.filter((record) => record.organizationId === organizationId);
      const remaining = records.filter((record) => record.organizationId !== organizationId);
      records.splice(0, records.length, ...remaining);
      const now = new Date();
      for (const stage of stages) {
        records.push({ organizationId, stage: stage.stage, probability: stage.probability, updatedAt: now });
      }
      await persistAudit(audit, null, { stages }, () => {
        const others = records.filter((record) => record.organizationId !== organizationId);
        records.splice(0, records.length, ...others, ...previous);
      });
      return present(organizationId);
    },
  };
}

export function createMemoryProposalStore(): ProposalStore & { records: ProposalRecord[]; events: ProposalStatusEventRecord[] } {
  const records: ProposalRecord[] = [];
  const events: ProposalStatusEventRecord[] = [];
  return {
    records,
    events,
    async list(organizationId, query: ProposalListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.status ? record.status === query.status : true))
        .filter((record) => (query.clientId ? record.clientId === query.clientId : true))
        .filter((record) => (query.opportunityId ? record.opportunityId === query.opportunityId : true))
        .filter((record) => (query.validityFrom ? record.validityDate >= query.validityFrom : true))
        .filter((record) => (query.validityTo ? record.validityDate <= query.validityTo : true))
        .filter((record) => includes(query.search, [record.number, record.title]))
        .sort((left, right) => {
          const value = {
            number: [left.number, right.number],
            title: [left.title, right.title],
            status: [left.status, right.status],
            total: [left.totalPaise, right.totalPaise],
            validity: [left.validityDate, right.validityDate],
          }[query.sort] as [string | number, string | number];
          const primary = compare(value[0], value[1], query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered.map((record) => ({ ...record, lines: [] })), query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findByNumber(organizationId, number) {
      const record = records.find((item) => item.organizationId === organizationId && item.number === number);
      return record ? { id: record.id } : null;
    },
    async history(organizationId, proposalId) {
      return events
        .filter((event) => event.organizationId === organizationId && event.proposalId === proposalId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
    },
    async insert(input: NewProposal, audit) {
      if (records.some((record) => record.organizationId === input.organizationId && record.number === input.number)) {
        throw new AppError(409, "CONFLICT", "This proposal number is already in use", { number: "Already in use" });
      }
      const totals = calculateProposal(input);
      const now = new Date();
      const record: ProposalRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        number: input.number,
        title: input.title,
        clientId: input.clientId,
        opportunityId: input.opportunityId,
        status: "Draft",
        validityDate: input.validityDate,
        notes: input.notes,
        rateBps: input.rateBps,
        subtotalPaise: totals.subtotalPaise,
        discountPaise: totals.discountPaise,
        taxPaise: totals.taxPaise,
        totalPaise: totals.totalPaise,
        lines: totals.lines.map((line) => ({ id: randomUUID(), ...line })),
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        expiredAt: null,
        statusChangedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const event: ProposalStatusEventRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        proposalId: record.id,
        fromStatus: null,
        toStatus: "Draft",
        createdAt: now,
      };
      records.push(record);
      events.push(event);
      await persistAudit(audit, record.id, audit?.draft.metadata ?? {}, () => {
        records.pop();
        events.pop();
      });
      return record;
    },
    async update(organizationId, id, patch: UpdateProposalBody, audit) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (record.status !== "Draft") throw new AppError(409, "CONFLICT", "Only draft proposals can be edited");
      if (patch.number !== undefined && records.some((item) => item.organizationId === organizationId && item.number === patch.number && item.id !== id)) {
        throw new AppError(409, "CONFLICT", "This proposal number is already in use", { number: "Already in use" });
      }
      const previous = { ...record, lines: record.lines.map((line) => ({ ...line })) };
      if (patch.number !== undefined) record.number = patch.number;
      if (patch.title !== undefined) record.title = patch.title;
      if (patch.clientId !== undefined) record.clientId = patch.clientId;
      if (patch.opportunityId !== undefined) record.opportunityId = patch.opportunityId;
      if (patch.validityDate !== undefined) record.validityDate = patch.validityDate;
      if (patch.notes !== undefined) record.notes = patch.notes;
      if (patch.rateBps !== undefined) record.rateBps = patch.rateBps;
      if (patch.lines !== undefined || patch.rateBps !== undefined) {
        const totals = calculateProposal({
          rateBps: record.rateBps,
          lines: patch.lines
            ? patch.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPriceRupees: line.unitPrice,
              discountRupees: line.discount,
            }))
            : lineInputs(previous),
        });
        record.subtotalPaise = totals.subtotalPaise;
        record.discountPaise = totals.discountPaise;
        record.taxPaise = totals.taxPaise;
        record.totalPaise = totals.totalPaise;
        if (patch.lines !== undefined) record.lines = totals.lines.map((line) => ({ id: randomUUID(), ...line }));
      }
      record.updatedAt = new Date();
      await persistAudit(audit, id, audit?.draft.metadata ?? {}, () => {
        Object.assign(record, previous);
        record.lines = previous.lines;
      });
      return record;
    },
    async changeStatus(organizationId, id, status: ProposalStatus, audit) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      assertProposalTransition(record.status, status);
      const previous = { ...record };
      const now = new Date();
      record.status = status;
      record.statusChangedAt = now;
      record.updatedAt = now;
      Object.assign(record, proposalStatusStamp(status, now));
      const event: ProposalStatusEventRecord = {
        id: randomUUID(),
        organizationId,
        proposalId: id,
        fromStatus: previous.status,
        toStatus: status,
        createdAt: now,
      };
      events.push(event);
      await persistAudit(audit, id, { from: previous.status, to: status }, () => {
        Object.assign(record, previous);
        events.pop();
      });
      return record;
    },
  };
}

export function createMemoryAgreementStore(): AgreementStore & { records: AgreementRecord[]; events: AgreementStatusEventRecord[] } {
  const records: AgreementRecord[] = [];
  const events: AgreementStatusEventRecord[] = [];
  return {
    records,
    events,
    async list(organizationId, query: AgreementListQuery) {
      const filtered = records
        .filter((record) => record.organizationId === organizationId)
        .filter((record) => (query.status ? record.status === query.status : true))
        .filter((record) => (query.clientId ? record.clientId === query.clientId : true))
        .filter((record) => (query.opportunityId ? record.opportunityId === query.opportunityId : true))
        .filter((record) => (query.proposalId ? record.proposalId === query.proposalId : true))
        .filter((record) => (query.endFrom ? record.endDate >= query.endFrom : true))
        .filter((record) => (query.endTo ? record.endDate <= query.endTo : true))
        .filter((record) => includes(query.search, [record.number, record.title]))
        .sort((left, right) => {
          const value = {
            number: [left.number, right.number],
            title: [left.title, right.title],
            status: [left.status, right.status],
            value: [left.valuePaise, right.valuePaise],
            startDate: [left.startDate, right.startDate],
            endDate: [left.endDate, right.endDate],
          }[query.sort] as [string | number, string | number];
          const primary = compare(value[0], value[1], query.direction);
          return primary === 0 ? compare(left.id, right.id, query.direction) : primary;
        });
      return paginate(filtered, query.page, query.pageSize);
    },
    async find(organizationId, id) {
      return records.find((record) => record.organizationId === organizationId && record.id === id) ?? null;
    },
    async findByNumber(organizationId, number) {
      const record = records.find((item) => item.organizationId === organizationId && item.number === number);
      return record ? { id: record.id } : null;
    },
    async history(organizationId, agreementId) {
      return events
        .filter((event) => event.organizationId === organizationId && event.agreementId === agreementId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
    },
    async insert(input: NewAgreement, audit) {
      if (input.endDate < input.startDate) {
        throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { endDate: "End date must be on or after the start date" });
      }
      if (records.some((record) => record.organizationId === input.organizationId && record.number === input.number)) {
        throw new AppError(409, "CONFLICT", "This agreement number is already in use", { number: "Already in use" });
      }
      const now = new Date();
      const record: AgreementRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        number: input.number,
        title: input.title,
        description: input.description,
        clientId: input.clientId,
        opportunityId: input.opportunityId,
        proposalId: input.proposalId,
        startDate: input.startDate,
        endDate: input.endDate,
        valuePaise: rupeesToPaise(input.valueRupees),
        status: "Draft",
        activatedAt: null,
        completedAt: null,
        terminatedAt: null,
        expiredAt: null,
        statusChangedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const event: AgreementStatusEventRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        agreementId: record.id,
        fromStatus: null,
        toStatus: "Draft",
        createdAt: now,
      };
      records.push(record);
      events.push(event);
      await persistAudit(audit, record.id, audit?.draft.metadata ?? {}, () => {
        records.pop();
        events.pop();
      });
      return record;
    },
    async update(organizationId, id, patch: UpdateAgreementBody, audit) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      if (isTerminalAgreement(record.status)) throw new AppError(409, "CONFLICT", "Closed agreements cannot be edited");
      if (record.status === "Active" && (patch.number !== undefined || patch.clientId !== undefined || patch.opportunityId !== undefined || patch.proposalId !== undefined)) {
        throw new AppError(409, "CONFLICT", "Active agreements can only change title, description, dates, and value");
      }
      const startDate = patch.startDate ?? record.startDate;
      const endDate = patch.endDate ?? record.endDate;
      if (endDate < startDate) {
        throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { endDate: "End date must be on or after the start date" });
      }
      if (patch.number !== undefined && records.some((item) => item.organizationId === organizationId && item.number === patch.number && item.id !== id)) {
        throw new AppError(409, "CONFLICT", "This agreement number is already in use", { number: "Already in use" });
      }
      const previous = { ...record };
      if (patch.number !== undefined) record.number = patch.number;
      if (patch.title !== undefined) record.title = patch.title;
      if (patch.description !== undefined) record.description = patch.description;
      if (patch.clientId !== undefined) record.clientId = patch.clientId;
      if (patch.opportunityId !== undefined) record.opportunityId = patch.opportunityId;
      if (patch.proposalId !== undefined) record.proposalId = patch.proposalId;
      if (patch.startDate !== undefined) record.startDate = patch.startDate;
      if (patch.endDate !== undefined) record.endDate = patch.endDate;
      if (patch.value !== undefined) record.valuePaise = rupeesToPaise(patch.value);
      record.updatedAt = new Date();
      await persistAudit(audit, id, audit?.draft.metadata ?? {}, () => {
        Object.assign(record, previous);
      });
      return record;
    },
    async changeStatus(organizationId, id, status: AgreementStatus, audit) {
      const record = records.find((item) => item.organizationId === organizationId && item.id === id);
      if (!record) return null;
      assertAgreementTransition(record.status, status);
      const previous = { ...record };
      const now = new Date();
      record.status = status;
      record.statusChangedAt = now;
      record.updatedAt = now;
      Object.assign(record, agreementStatusStamp(status, now));
      const event: AgreementStatusEventRecord = {
        id: randomUUID(),
        organizationId,
        agreementId: id,
        fromStatus: previous.status,
        toStatus: status,
        createdAt: now,
      };
      events.push(event);
      await persistAudit(audit, id, { from: previous.status, to: status }, () => {
        Object.assign(record, previous);
        events.pop();
      });
      return record;
    },
  };
}
