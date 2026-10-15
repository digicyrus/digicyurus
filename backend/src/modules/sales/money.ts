import { AppError } from "../../lib/errors.js";
import { rupeesToPaise } from "../crm/constants.js";
import { taxPaise } from "../finance/money.js";

export type ProposalLineInput = {
  description: string;
  quantity: number;
  unitPriceRupees: number;
  discountRupees: number;
};

export type CalculatedProposalLine = {
  description: string;
  quantity: number;
  unitPricePaise: number;
  discountPaise: number;
  amountPaise: number;
};

export type CalculatedProposal = {
  lines: CalculatedProposalLine[];
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
};

export function calculateProposal(input: { rateBps: number; lines: ProposalLineInput[] }): CalculatedProposal {
  const lines = input.lines.map((line, index) => {
    const unitPricePaise = rupeesToPaise(line.unitPriceRupees);
    const discountPaise = rupeesToPaise(line.discountRupees);
    const grossPaise = line.quantity * unitPricePaise;
    if (discountPaise > grossPaise) {
      throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
        [`lines.${index}.discount`]: "Discount cannot exceed the line amount",
      });
    }
    return {
      description: line.description,
      quantity: line.quantity,
      unitPricePaise,
      discountPaise,
      amountPaise: grossPaise - discountPaise,
    };
  });
  const subtotalPaise = lines.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);
  const discountPaise = lines.reduce((sum, line) => sum + line.discountPaise, 0);
  const taxablePaise = subtotalPaise - discountPaise;
  const tax = taxPaise(taxablePaise, input.rateBps);
  return {
    lines,
    subtotalPaise,
    discountPaise,
    taxPaise: tax,
    totalPaise: taxablePaise + tax,
  };
}

export function weightedPaise(valuePaise: number, probability: number): number {
  return Math.floor((valuePaise * probability) / 100);
}
