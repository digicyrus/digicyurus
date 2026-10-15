import { AppError } from "../../lib/errors.js";
import type { AgreementStatus, OpportunityStage, ProposalStatus } from "./constants.js";

export type CloseState = {
  stage: OpportunityStage;
  lostReason: string | null;
  closedOn: string | null;
};

const PROPOSAL_TRANSITIONS: Record<ProposalStatus, readonly ProposalStatus[]> = {
  Draft: ["Sent"],
  Sent: ["Accepted", "Rejected", "Expired"],
  Accepted: [],
  Rejected: [],
  Expired: [],
};

const AGREEMENT_TRANSITIONS: Record<AgreementStatus, readonly AgreementStatus[]> = {
  Draft: ["Active"],
  Active: ["Completed", "Terminated", "Expired"],
  Completed: [],
  Terminated: [],
  Expired: [],
};

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveOpportunityClose(input: {
  stage: OpportunityStage;
  lostReason?: string | null;
  closedOn?: string | null;
  today: string;
}): CloseState {
  const lostReason = blankToNull(input.lostReason);
  if (input.stage === "Lost") {
    if (!lostReason) {
      throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { lostReason: "Lost reason is required" });
    }
    return { stage: "Lost", lostReason, closedOn: input.closedOn ?? input.today };
  }
  if (lostReason) {
    throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { lostReason: "Lost reason applies only when the stage is Lost" });
  }
  if (input.stage === "Won") {
    return { stage: "Won", lostReason: null, closedOn: input.closedOn ?? input.today };
  }
  if (input.closedOn) {
    throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { closedOn: "Closed date applies only when the stage is Won or Lost" });
  }
  return { stage: input.stage, lostReason: null, closedOn: null };
}

export function assertProposalTransition(from: ProposalStatus, to: ProposalStatus): void {
  if (from === to) throw new AppError(409, "CONFLICT", `This proposal is already ${to}`);
  if (!PROPOSAL_TRANSITIONS[from].includes(to)) {
    throw new AppError(409, "CONFLICT", `Cannot change this proposal from ${from} to ${to}`);
  }
}

export function assertAgreementTransition(from: AgreementStatus, to: AgreementStatus): void {
  if (from === to) throw new AppError(409, "CONFLICT", `This agreement is already ${to}`);
  if (!AGREEMENT_TRANSITIONS[from].includes(to)) {
    throw new AppError(409, "CONFLICT", `Cannot change this agreement from ${from} to ${to}`);
  }
}

export function proposalStatusStamp(status: ProposalStatus, now: Date): {
  sentAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  expiredAt?: Date;
} {
  if (status === "Sent") return { sentAt: now };
  if (status === "Accepted") return { acceptedAt: now };
  if (status === "Rejected") return { rejectedAt: now };
  if (status === "Expired") return { expiredAt: now };
  return {};
}

export function agreementStatusStamp(status: AgreementStatus, now: Date): {
  activatedAt?: Date;
  completedAt?: Date;
  terminatedAt?: Date;
  expiredAt?: Date;
} {
  if (status === "Active") return { activatedAt: now };
  if (status === "Completed") return { completedAt: now };
  if (status === "Terminated") return { terminatedAt: now };
  if (status === "Expired") return { expiredAt: now };
  return {};
}
