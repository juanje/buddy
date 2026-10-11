// shared/dashboard/views-v2-model.ts — Chart view models from filtered rows (FR-DASH-11).

import type { SourceDefinition } from "./source-fields";
import type { WidgetSpec } from "./types";
import { ageDaysFromUpdated } from "./inline-source";

export const V2_VIEWS = new Set(["bar", "line", "progress", "calendar", "timeline"]);

export function v2UsesFilteredRows(view: string, raw: Record<string, unknown>): boolean {
  if (view === "bar" || view === "line" || view === "calendar" || view === "timeline") return true;
  if (view === "progress" && raw.max !== undefined) return true;
  return false;
}

export function progressIsCountdown(raw: Record<string, unknown>): boolean {
  return typeof raw.until === "string";
}

function keysInRowOrder(field: string, rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const v = row[field];
    const k = v === undefined || v === null || v === "" ? "null" : String(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

function rowMatchesKey(row: Record<string, unknown>, field: string, key: string): boolean {
  const v = row[field];
  const k = v === undefined || v === null || v === "" ? "null" : String(v);
  return k === key;
}

export type BarSegmentModel = { label: string; value: number };
export type BarChartBarModel = { label: string; total: number; segments: BarSegmentModel[] };
export type BarChartModel = { bars: BarChartBarModel[]; threshold?: number };

export function buildBarChartModel(
  rows: Record<string, unknown>[],
  spec: WidgetSpec,
): BarChartModel | string {
  const raw = spec.raw;
  const group = typeof raw.group === "string" ? raw.group : undefined;
  if (!group) return "Bar view requires key 'group'";
  const count = raw.count === true;
  const sumField = typeof raw.sum === "string" ? raw.sum : undefined;
  if (!count && !sumField) return "Bar view requires 'count: true' or 'sum' with a field name";
  const stackField = typeof raw.stack === "string" ? raw.stack : undefined;
  const threshold =
    typeof raw.threshold === "number" && Number.isFinite(raw.threshold) ? raw.threshold : undefined;

  const groupKeys = keysInRowOrder(group, rows);
  const bars: BarChartBarModel[] = [];

  for (const gKey of groupKeys) {
    const inGroup = rows.filter((r) => rowMatchesKey(r, group, gKey));
    const label = gKey === "null" ? "" : gKey;
    let total = 0;
    const segments: BarSegmentModel[] = [];

    if (count) {
      total = inGroup.length;
      if (stackField) {
        for (const sKey of keysInRowOrder(stackField, inGroup)) {
          const segRows = inGroup.filter((r) => rowMatchesKey(r, stackField, sKey));
          segments.push({
            label: sKey === "null" ? "" : sKey,
            value: segRows.length,
          });
        }
      }
    } else if (sumField) {
      for (const row of inGroup) {
        const v = row[sumField];
        if (typeof v === "number") total += v;
      }
      if (stackField) {
        for (const sKey of keysInRowOrder(stackField, inGroup)) {
          let segTotal = 0;
          for (const row of inGroup.filter((r) => rowMatchesKey(r, stackField, sKey))) {
            const v = row[sumField];
            if (typeof v === "number") segTotal += v;
          }
          segments.push({ label: sKey === "null" ? "" : sKey, value: segTotal });
        }
      }
    }

    bars.push({ label, total, segments });
  }

  return { bars, threshold };
}

export type LinePointModel = { x: string; y: number; series?: string };
export type LineChartModel = { points: LinePointModel[]; seriesNames: string[] };

export function buildLineChartModel(
  rows: Record<string, unknown>[],
  spec: WidgetSpec,
): LineChartModel | string {
  const raw = spec.raw;
  const xField = typeof raw.x === "string" ? raw.x : undefined;
  const yField = typeof raw.y === "string" ? raw.y : undefined;
  if (!xField || !yField) return "Line view requires keys 'x' and 'y'";
  const seriesField = typeof raw.series === "string" ? raw.series : undefined;

  const bucket = new Map<string, number>();
  const seriesSet = new Set<string>();

  for (const row of rows) {
    const xRaw = row[xField];
    const yRaw = row[yField];
    if (typeof yRaw !== "number") continue;
    const x = xRaw === undefined || xRaw === null ? "" : String(xRaw);
    const series =
      seriesField && row[seriesField] !== undefined && row[seriesField] !== null
        ? String(row[seriesField])
        : "";
    if (seriesField) seriesSet.add(series);
    const key = seriesField ? `${series}\0${x}` : x;
    bucket.set(key, (bucket.get(key) ?? 0) + yRaw);
  }

  const points: LinePointModel[] = [];
  for (const [key, y] of bucket.entries()) {
    if (seriesField) {
      const [series, x] = key.split("\0");
      points.push({ x, y, series });
    } else {
      points.push({ x: key, y });
    }
  }
  points.sort((a, b) => a.x.localeCompare(b.x));

  return { points, seriesNames: [...seriesSet].sort() };
}

export type ProgressDataModel = { value: number; max: number; fraction: number };
export type ProgressCountdownModel = { daysRemaining: number; until: string };

export function buildProgressDataModel(
  rows: Record<string, unknown>[],
  spec: WidgetSpec,
): ProgressDataModel | string {
  const raw = spec.raw;
  const max = raw.max;
  if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) {
    return "Progress view requires numeric 'max' greater than zero";
  }
  const count = raw.count === true;
  const sumField = typeof raw.sum === "string" ? raw.sum : undefined;
  if (!count && !sumField) return "Progress view requires 'count: true' or 'sum' with a field name";
  let value = 0;
  if (count) value = rows.length;
  else if (sumField) {
    for (const row of rows) {
      const v = row[sumField];
      if (typeof v === "number") value += v;
    }
  }
  return { value, max, fraction: Math.min(1, value / max) };
}

export function buildProgressCountdownModel(
  spec: WidgetSpec,
  today: string,
): ProgressCountdownModel | string {
  const until = spec.raw.until;
  if (typeof until !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return "Progress countdown requires 'until' as YYYY-MM-DD";
  }
  const daysRemaining = ageDaysFromUpdated(today, until);
  return { daysRemaining, until };
}

export type CalendarCellModel = { date: string; value: number; intensity: number };
export type CalendarChartModel = { cells: CalendarCellModel[]; maxValue: number };

export function buildCalendarChartModel(
  rows: Record<string, unknown>[],
  spec: WidgetSpec,
): CalendarChartModel | string {
  const raw = spec.raw;
  const dateField = typeof raw.date === "string" ? raw.date : undefined;
  if (!dateField) return "Calendar view requires key 'date'";
  const valueField = typeof raw.value === "string" ? raw.value : undefined;

  const byDay = new Map<string, number>();
  for (const row of rows) {
    const d = row[dateField];
    if (d === undefined || d === null || String(d).trim() === "") continue;
    const day = String(d);
    if (valueField) {
      const v = row[valueField];
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isNaN(n)) byDay.set(day, (byDay.get(day) ?? 0) + n);
    } else {
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
  }

  const maxValue = Math.max(0, ...byDay.values());
  const cells = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      value,
      intensity: maxValue > 0 ? value / maxValue : 0,
    }));

  return { cells, maxValue };
}

export type TimelineEventModel = { date: string; label: string; end?: string };
export type TimelineChartModel = { events: TimelineEventModel[] };

export function buildTimelineChartModel(
  rows: Record<string, unknown>[],
  spec: WidgetSpec,
): TimelineChartModel | string {
  const raw = spec.raw;
  const dateField = typeof raw.date === "string" ? raw.date : undefined;
  const labelField = typeof raw.label === "string" ? raw.label : undefined;
  if (!dateField || !labelField) return "Timeline view requires keys 'date' and 'label'";
  const endField = typeof raw.end === "string" ? raw.end : undefined;

  const events: TimelineEventModel[] = rows
    .map((row) => {
      const date = row[dateField];
      const label = row[labelField];
      if (date === undefined || date === null || label === undefined || label === null) return null;
      const ev: TimelineEventModel = { date: String(date), label: String(label) };
      if (endField && row[endField] !== undefined && row[endField] !== null) {
        ev.end = String(row[endField]);
      }
      return ev;
    })
    .filter((e): e is TimelineEventModel => e !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { events };
}
