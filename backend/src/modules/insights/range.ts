export type DateRange = {
  from?: string;
  to?: string;
};

export function rangeStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function rangeEndExclusive(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
}

export function timestampInRange(value: Date, range: DateRange): boolean {
  if (range.from && value < rangeStart(range.from)) return false;
  if (range.to && value >= rangeEndExclusive(range.to)) return false;
  return true;
}

export function dateInRange(value: string | null, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!value) return false;
  if (range.from && value < range.from) return false;
  if (range.to && value > range.to) return false;
  return true;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}
