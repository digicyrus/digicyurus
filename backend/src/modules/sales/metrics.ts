import {
  isOpenOpportunityStage,
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGES,
  type OpenOpportunityStage,
  type OpportunityStage,
} from "./constants.js";
import { weightedPaise } from "./money.js";

export type ForecastSource = {
  stage: OpportunityStage;
  ownerEmployeeId: string | null;
  valuePaise: number;
  expectedClose: string;
  closedOn: string | null;
};

export type StageProbabilityInput = {
  stage: OpenOpportunityStage;
  probability: number;
};

export type Weighting = "unconfigured" | "partial" | "complete";

export type StageSummary = {
  stage: OpportunityStage;
  count: number;
  valuePaise: number;
};

export type ForecastMetrics = {
  pipelineCount: number;
  pipelineValuePaise: number;
  periodPipelineCount: number;
  periodPipelineValuePaise: number;
  weightedForecastPaise: number | null;
  periodWeightedForecastPaise: number | null;
  weighting: Weighting;
  unweightedPipelineValuePaise: number;
  wonCount: number;
  wonValuePaise: number;
  lostCount: number;
  lostValuePaise: number;
  byStage: Array<{
    stage: OpportunityStage;
    count: number;
    valuePaise: number;
    probability: number | null;
    weightedForecastPaise: number | null;
  }>;
  byOwner: Array<{
    ownerEmployeeId: string | null;
    count: number;
    pipelineValuePaise: number;
    weightedForecastPaise: number | null;
  }>;
  byExpectedCloseMonth: Array<{
    month: string;
    count: number;
    pipelineValuePaise: number;
    weightedForecastPaise: number | null;
  }>;
};

export function summarizeStages(rows: Array<{ stage: OpportunityStage; valuePaise: number }>): StageSummary[] {
  return OPPORTUNITY_STAGES.map((stage) => {
    const matching = rows.filter((row) => row.stage === stage);
    return {
      stage,
      count: matching.length,
      valuePaise: matching.reduce((total, row) => total + row.valuePaise, 0),
    };
  });
}

export function weightingFor(probabilities: StageProbabilityInput[]): Weighting {
  if (probabilities.length === 0) return "unconfigured";
  const configured = new Set(probabilities.map((item) => item.stage));
  return OPEN_OPPORTUNITY_STAGES.every((stage) => configured.has(stage)) ? "complete" : "partial";
}

function inPeriod(value: string | null, from: string, to: string): boolean {
  return value !== null && value >= from && value <= to;
}

function sumWeighted(rows: ForecastSource[], probabilities: Map<OpenOpportunityStage, number>, weighting: Weighting): number | null {
  if (weighting === "unconfigured") return null;
  return rows.reduce((total, row) => {
    if (!isOpenOpportunityStage(row.stage)) return total;
    const probability = probabilities.get(row.stage);
    if (probability === undefined) return total;
    return total + weightedPaise(row.valuePaise, probability);
  }, 0);
}

export function buildForecast(sources: ForecastSource[], probabilities: StageProbabilityInput[], period: { from: string; to: string }): ForecastMetrics {
  const probabilityByStage = new Map(probabilities.map((item) => [item.stage, item.probability]));
  const weighting = weightingFor(probabilities);
  const open = sources.filter((row) => isOpenOpportunityStage(row.stage));
  const periodOpen = open.filter((row) => inPeriod(row.expectedClose, period.from, period.to));
  const won = sources.filter((row) => row.stage === "Won" && inPeriod(row.closedOn, period.from, period.to));
  const lost = sources.filter((row) => row.stage === "Lost" && inPeriod(row.closedOn, period.from, period.to));
  const unweightedPipelineValuePaise = open
    .filter((row) => isOpenOpportunityStage(row.stage) && !probabilityByStage.has(row.stage))
    .reduce((total, row) => total + row.valuePaise, 0);

  const byStage = OPPORTUNITY_STAGES.map((stage) => {
    if (isOpenOpportunityStage(stage)) {
      const rows = open.filter((row) => row.stage === stage);
      const probability = probabilityByStage.get(stage) ?? null;
      const valuePaise = rows.reduce((total, row) => total + row.valuePaise, 0);
      return {
        stage,
        count: rows.length,
        valuePaise,
        probability,
        weightedForecastPaise: probability === null ? null : weightedPaise(valuePaise, probability),
      };
    }
    const rows = sources.filter((row) => row.stage === stage && inPeriod(row.closedOn, period.from, period.to));
    return {
      stage,
      count: rows.length,
      valuePaise: rows.reduce((total, row) => total + row.valuePaise, 0),
      probability: null,
      weightedForecastPaise: null,
    };
  });

  const owners = new Map<string | null, ForecastSource[]>();
  for (const row of open) {
    const group = owners.get(row.ownerEmployeeId) ?? [];
    group.push(row);
    owners.set(row.ownerEmployeeId, group);
  }
  const byOwner = [...owners.entries()]
    .map(([ownerEmployeeId, rows]) => ({
      ownerEmployeeId,
      count: rows.length,
      pipelineValuePaise: rows.reduce((total, row) => total + row.valuePaise, 0),
      weightedForecastPaise: sumWeighted(rows, probabilityByStage, weighting),
    }))
    .sort((left, right) => {
      if (left.ownerEmployeeId === right.ownerEmployeeId) return 0;
      if (left.ownerEmployeeId === null) return 1;
      if (right.ownerEmployeeId === null) return -1;
      return left.ownerEmployeeId.localeCompare(right.ownerEmployeeId);
    });

  const months = new Map<string, ForecastSource[]>();
  for (const row of periodOpen) {
    const month = row.expectedClose.slice(0, 7);
    const group = months.get(month) ?? [];
    group.push(row);
    months.set(month, group);
  }
  const byExpectedCloseMonth = [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, rows]) => ({
      month,
      count: rows.length,
      pipelineValuePaise: rows.reduce((total, row) => total + row.valuePaise, 0),
      weightedForecastPaise: sumWeighted(rows, probabilityByStage, weighting),
    }));

  return {
    pipelineCount: open.length,
    pipelineValuePaise: open.reduce((total, row) => total + row.valuePaise, 0),
    periodPipelineCount: periodOpen.length,
    periodPipelineValuePaise: periodOpen.reduce((total, row) => total + row.valuePaise, 0),
    weightedForecastPaise: sumWeighted(open, probabilityByStage, weighting),
    periodWeightedForecastPaise: sumWeighted(periodOpen, probabilityByStage, weighting),
    weighting,
    unweightedPipelineValuePaise,
    wonCount: won.length,
    wonValuePaise: won.reduce((total, row) => total + row.valuePaise, 0),
    lostCount: lost.length,
    lostValuePaise: lost.reduce((total, row) => total + row.valuePaise, 0),
    byStage,
    byOwner,
    byExpectedCloseMonth,
  };
}
