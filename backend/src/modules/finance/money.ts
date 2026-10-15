import { paiseToRupees, rupeesToPaise } from "../crm/constants.js";

export const SUPPLIES = ["cgst_sgst", "igst"] as const;
export type Supply = (typeof SUPPLIES)[number];

export function isSupply(value: string): value is Supply {
  return (SUPPLIES as readonly string[]).includes(value);
}

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  unitPriceRupees: number;
};

export type CalculatedLine = {
  description: string;
  quantity: number;
  unitPricePaise: number;
  amountPaise: number;
};

export type CalculatedInvoice = {
  lines: CalculatedLine[];
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
};

export function taxPaise(subtotalPaise: number, rateBps: number): number {
  const whole = Math.floor(subtotalPaise / 10000) * rateBps;
  const remainder = subtotalPaise % 10000;
  return whole + Math.floor((remainder * rateBps + 5000) / 10000);
}

export function splitTax(amountPaise: number, supply: Supply): { cgstPaise: number; sgstPaise: number; igstPaise: number } {
  if (supply === "igst") return { cgstPaise: 0, sgstPaise: 0, igstPaise: amountPaise };
  const cgstPaise = Math.floor(amountPaise / 2);
  return { cgstPaise, sgstPaise: amountPaise - cgstPaise, igstPaise: 0 };
}

export function calculateInvoice(input: { supply: Supply; rateBps: number; lines: InvoiceLineInput[] }): CalculatedInvoice {
  const lines = input.lines.map((line) => {
    const unitPricePaise = rupeesToPaise(line.unitPriceRupees);
    return {
      description: line.description,
      quantity: line.quantity,
      unitPricePaise,
      amountPaise: line.quantity * unitPricePaise,
    };
  });
  const subtotalPaise = lines.reduce((sum, line) => sum + line.amountPaise, 0);
  const tax = taxPaise(subtotalPaise, input.rateBps);
  const split = splitTax(tax, input.supply);
  return {
    lines,
    subtotalPaise,
    ...split,
    taxPaise: tax,
    totalPaise: subtotalPaise + tax,
  };
}

export function rupees(paise: number): number {
  return paiseToRupees(paise);
}
