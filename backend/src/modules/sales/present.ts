import { paiseToRupees } from "../crm/constants.js";
import type { AgreementRecord, AgreementStatusEventRecord } from "./agreements.store.js";
import type { StageSummary } from "./metrics.js";
import type { ForecastMetrics } from "./metrics.js";
import type { OpportunityRecord, StageEventRecord } from "./opportunities.store.js";
import type { ProposalRecord, ProposalStatusEventRecord } from "./proposals.store.js";
import type { StageProbabilityRecord } from "./forecast.store.js";

function rupeesOrNull(value: number | null): number | null {
  return value === null ? null : paiseToRupees(value);
}

export function presentOpportunity(record: OpportunityRecord) {
  return {
    id: record.id,
    reference: record.reference,
    title: record.title,
    clientId: record.clientId,
    leadId: record.leadId,
    ownerEmployeeId: record.ownerEmployeeId,
    value: paiseToRupees(record.valuePaise),
    expectedClose: record.expectedClose,
    source: record.source,
    priority: record.priority,
    notes: record.notes,
    stage: record.stage,
    lostReason: record.lostReason,
    closedOn: record.closedOn,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentStageEvent(record: StageEventRecord) {
  return {
    id: record.id,
    fromStage: record.fromStage,
    toStage: record.toStage,
    lostReason: record.lostReason,
    closedOn: record.closedOn,
    createdAt: record.createdAt.toISOString(),
  };
}

export function presentOpportunityDetail(record: OpportunityRecord, history: StageEventRecord[]) {
  return {
    ...presentOpportunity(record),
    stageHistory: history.map(presentStageEvent),
  };
}

export function presentPipelineSummary(stages: StageSummary[]) {
  const open = stages.filter((stage) => stage.stage !== "Won" && stage.stage !== "Lost");
  const closed = stages.filter((stage) => stage.stage === "Won" || stage.stage === "Lost");
  const total = (rows: StageSummary[]) => ({
    count: rows.reduce((sum, row) => sum + row.count, 0),
    value: paiseToRupees(rows.reduce((sum, row) => sum + row.valuePaise, 0)),
  });
  return {
    stages: stages.map((stage) => ({
      stage: stage.stage,
      count: stage.count,
      value: paiseToRupees(stage.valuePaise),
    })),
    open: total(open),
    closed: total(closed),
  };
}

export function presentForecast(metrics: ForecastMetrics, period: { from: string; to: string }) {
  return {
    period,
    pipelineCount: metrics.pipelineCount,
    pipelineValue: paiseToRupees(metrics.pipelineValuePaise),
    periodPipelineCount: metrics.periodPipelineCount,
    periodPipelineValue: paiseToRupees(metrics.periodPipelineValuePaise),
    weightedForecast: rupeesOrNull(metrics.weightedForecastPaise),
    periodWeightedForecast: rupeesOrNull(metrics.periodWeightedForecastPaise),
    weighting: metrics.weighting,
    unweightedPipelineValue: paiseToRupees(metrics.unweightedPipelineValuePaise),
    closedDeals: {
      basis: "opportunity_closed_value",
      wonCount: metrics.wonCount,
      wonValue: paiseToRupees(metrics.wonValuePaise),
      lostCount: metrics.lostCount,
      lostValue: paiseToRupees(metrics.lostValuePaise),
    },
    byStage: metrics.byStage.map((stage) => ({
      stage: stage.stage,
      count: stage.count,
      value: paiseToRupees(stage.valuePaise),
      probability: stage.probability,
      weightedForecast: rupeesOrNull(stage.weightedForecastPaise),
    })),
    byOwner: metrics.byOwner.map((owner) => ({
      ownerEmployeeId: owner.ownerEmployeeId,
      count: owner.count,
      pipelineValue: paiseToRupees(owner.pipelineValuePaise),
      weightedForecast: rupeesOrNull(owner.weightedForecastPaise),
    })),
    byExpectedCloseMonth: metrics.byExpectedCloseMonth.map((month) => ({
      month: month.month,
      count: month.count,
      pipelineValue: paiseToRupees(month.pipelineValuePaise),
      weightedForecast: rupeesOrNull(month.weightedForecastPaise),
    })),
  };
}

export function presentProbabilities(records: StageProbabilityRecord[]) {
  return {
    stages: records.map((record) => ({
      stage: record.stage,
      probability: record.probability,
      updatedAt: record.updatedAt.toISOString(),
    })),
  };
}

export function presentProposal(record: ProposalRecord) {
  return {
    id: record.id,
    number: record.number,
    title: record.title,
    clientId: record.clientId,
    opportunityId: record.opportunityId,
    status: record.status,
    validityDate: record.validityDate,
    notes: record.notes,
    rateBps: record.rateBps,
    subtotal: paiseToRupees(record.subtotalPaise),
    discount: paiseToRupees(record.discountPaise),
    tax: paiseToRupees(record.taxPaise),
    total: paiseToRupees(record.totalPaise),
    sentAt: record.sentAt?.toISOString() ?? null,
    acceptedAt: record.acceptedAt?.toISOString() ?? null,
    rejectedAt: record.rejectedAt?.toISOString() ?? null,
    expiredAt: record.expiredAt?.toISOString() ?? null,
    statusChangedAt: record.statusChangedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentProposalDetail(record: ProposalRecord, history: ProposalStatusEventRecord[]) {
  return {
    ...presentProposal(record),
    lines: record.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: line.quantity,
      unitPrice: paiseToRupees(line.unitPricePaise),
      discount: paiseToRupees(line.discountPaise),
      amount: paiseToRupees(line.amountPaise),
    })),
    statusHistory: history.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export function presentAgreement(record: AgreementRecord) {
  return {
    id: record.id,
    number: record.number,
    title: record.title,
    description: record.description,
    clientId: record.clientId,
    opportunityId: record.opportunityId,
    proposalId: record.proposalId,
    startDate: record.startDate,
    endDate: record.endDate,
    value: paiseToRupees(record.valuePaise),
    status: record.status,
    activatedAt: record.activatedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    terminatedAt: record.terminatedAt?.toISOString() ?? null,
    expiredAt: record.expiredAt?.toISOString() ?? null,
    statusChangedAt: record.statusChangedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentAgreementDetail(record: AgreementRecord, history: AgreementStatusEventRecord[]) {
  return {
    ...presentAgreement(record),
    statusHistory: history.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
