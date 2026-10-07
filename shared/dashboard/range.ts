// shared/dashboard/range.ts — Parse dashboard date ranges (FR-DASH-04, FR-DASH-10).

import { addDays } from "../dates";
import { parseRelativeDateBound } from "./query-dates";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type DateRange = { start: string; end: string };

export function parseDateRange(range: string, today: string): DateRange | undefined {
  const trimmed = range.trim();
  let start: string | undefined;
  let end: string | undefined;
  if (trimmed.includes("..")) {
    const [a, b] = trimmed.split("..").map((s) => s.trim());
    start = parseRelativeDateBound(a, today) ?? (ISO_DAY.test(a) ? a : undefined);
    end = parseRelativeDateBound(b, today) ?? (ISO_DAY.test(b) ? b : undefined);
  } else {
    start = parseRelativeDateBound(trimmed, today) ?? (ISO_DAY.test(trimmed) ? trimmed : undefined);
    end = today;
  }
  if (!start || !end) return undefined;
  return { start, end };
}

export function daysInclusive(start: string, end: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  return Math.round((b - a) / 86_400_000) + 1;
}

export function previousPeriodOfSameLength(range: DateRange): DateRange {
  const len = daysInclusive(range.start, range.end);
  const prevEnd = addDays(range.start, -1);
  const prevStart = addDays(prevEnd, -(len - 1));
  return { start: prevStart, end: prevEnd };
}
