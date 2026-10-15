import { and, asc, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { opportunityStageProbabilities } from "../../db/schema/index.js";
import type { AuditRequest } from "../audit/types.js";
import { insertAudit } from "../audit/write.js";
import { rethrowConstraint } from "./conflicts.js";
import { isOpenOpportunityStage, OPEN_OPPORTUNITY_STAGES, type OpenOpportunityStage } from "./constants.js";
import type { StageProbabilityInput } from "./metrics.js";

export type StageProbabilityRecord = {
  stage: OpenOpportunityStage;
  probability: number;
  updatedAt: Date;
};

export type ForecastStore = {
  listProbabilities(organizationId: string): Promise<StageProbabilityRecord[]>;
  replaceProbabilities(organizationId: string, stages: StageProbabilityInput[], audit?: AuditRequest | null): Promise<StageProbabilityRecord[]>;
};

function asProbability(row: typeof opportunityStageProbabilities.$inferSelect): StageProbabilityRecord {
  if (!isOpenOpportunityStage(row.stage)) throw new Error("Stored stage probability is invalid");
  return { stage: row.stage, probability: row.probability, updatedAt: row.updatedAt };
}

function byStageOrder(left: StageProbabilityRecord, right: StageProbabilityRecord): number {
  return OPEN_OPPORTUNITY_STAGES.indexOf(left.stage) - OPEN_OPPORTUNITY_STAGES.indexOf(right.stage);
}

export function createDrizzleForecastStore(database: Database): ForecastStore {
  const { db } = database;
  return {
    async listProbabilities(organizationId) {
      const rows = await db
        .select()
        .from(opportunityStageProbabilities)
        .where(eq(opportunityStageProbabilities.organizationId, organizationId))
        .orderBy(asc(opportunityStageProbabilities.stage));
      return rows.map(asProbability).sort(byStageOrder);
    },
    async replaceProbabilities(organizationId, stages, audit) {
      const now = new Date();
      try {
        return await db.transaction(async (tx) => {
          await tx.delete(opportunityStageProbabilities).where(eq(opportunityStageProbabilities.organizationId, organizationId));
          if (stages.length > 0) {
            await tx.insert(opportunityStageProbabilities).values(stages.map((stage) => ({
              organizationId,
              stage: stage.stage,
              probability: stage.probability,
              updatedAt: now,
            })));
          }
          if (audit) {
            await insertAudit(tx, {
              organizationId,
              actorUserId: audit.draft.actorUserId,
              action: audit.draft.action,
              resourceType: audit.draft.resourceType,
              resourceId: null,
              metadata: { stages },
            });
          }
          const rows = await tx
            .select()
            .from(opportunityStageProbabilities)
            .where(eq(opportunityStageProbabilities.organizationId, organizationId));
          return rows.map(asProbability).sort(byStageOrder);
        });
      } catch (error) {
        rethrowConstraint(error);
      }
    },
  };
}
