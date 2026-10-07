// shared/dashboard/query-dates.ts — Relative date tokens for queries (FR-DASH-04).

import { addDays, toIsoDay } from "../dates";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function addMonths(isoDay: string, months: number): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(d, lastDay));
  return toIsoDay(date);
}

export function parseRelativeDateBound(token: string, today: string): string | undefined {
  const t = token.trim().toLowerCase();
  if (t === "today") return today;
  const m = /^([+-])(\d+)([dwm])$/.exec(t);
  if (!m) return undefined;
  const sign = m[1] === "-" ? -1 : 1;
  const n = sign * Number(m[2]);
  const unit = m[3];
  if (unit === "d") return addDays(today, n);
  if (unit === "w") return addDays(today, n * 7);
  if (unit === "m") return addMonths(today, n);
  return undefined;
}

export function coerceIsoDay(value: unknown, today: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const s = String(value);
  if (ISO_DAY.test(s)) return s;
  return parseRelativeDateBound(s, today);
}
